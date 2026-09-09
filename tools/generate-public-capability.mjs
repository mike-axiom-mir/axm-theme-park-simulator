#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = path.join(ROOT, "registry", "capabilities.jsonl");
const RECEIPT_PATH = path.join(ROOT, "registry", "capabilities.receipt.json");
const SOURCE_PATHS = [
  "package.json",
  "runtime/index.js",
  "runtime/package-metadata.js",
  "LICENSE",
  "tools/generate-public-capability.mjs",
];

function fail(message) {
  throw new Error(message);
}

function readRegular(relativePath) {
  const target = path.join(ROOT, relativePath);
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) fail(`source symlink rejected: ${relativePath}`);
  if (!stat.isFile()) fail(`source must be a regular file: ${relativePath}`);
  return fs.readFileSync(target);
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash("sha1").update(header).update(buffer).digest("hex");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, sortValue(value[key])]),
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function build() {
  const packageDocument = JSON.parse(readRegular("package.json").toString("utf8"));
  const capability = packageDocument.axmCapability;
  if (!capability || capability.schema !== "axm.capability/v1") {
    fail("package.json must expose axmCapability using axm.capability/v1");
  }
  if (packageDocument.private !== true) fail("package must remain private to block accidental registry publication");
  if (packageDocument.license !== "Apache-2.0") fail("public capability license drifted from Apache-2.0");
  if (capability.id !== "axm.theme-park.headless-simulator") fail("capability id drift");
  if (capability.status !== "WORKING") fail("public status must preserve the provider's WORKING status");
  if (capability.runtime?.kind !== "node" || capability.runtime?.networkRequired !== false) {
    fail("headless capability must remain an offline Node runtime");
  }
  if (capability.authority?.canonical !== false) fail("capability must not claim canonical authority");
  if (capability.authority?.cliWritesNewFilesOnly !== true) fail("CLI write boundary drift");

  const publicCapability = {
    schema: "axm.public-capability/v1",
    id: capability.id,
    version: capability.version,
    status: capability.status,
    summary: packageDocument.description,
    providers: ["mike-axiom-mir/axm-theme-park-simulator"],
    consumers: [],
    runtime: {
      kind: capability.runtime.kind,
      minimumVersion: capability.runtime.minimumVersion,
      networkRequired: capability.runtime.networkRequired,
      dependencies: [],
    },
    entrypoints: capability.entrypoints,
    contracts: capability.contracts,
    license: packageDocument.license,
    source: {
      metadata: "package.json",
      descriptor: "runtime/package-metadata.js",
      library: "runtime/index.js",
      license: "LICENSE",
    },
    authority: {
      discoveryOnly: true,
      execution: false,
      automaticInstall: false,
      automaticSelection: false,
      merge: false,
      canon: false,
    },
  };

  const registry = `${stableJson(publicCapability)}\n`;
  const sourceBlobs = {};
  for (const relativePath of SOURCE_PATHS) {
    sourceBlobs[relativePath] = gitBlobSha(readRegular(relativePath));
  }
  const receipt = {
    schema: "axm.public-capability-receipt/v1",
    generator: "tools/generate-public-capability.mjs",
    capabilityId: publicCapability.id,
    registrySha256: sha256(Buffer.from(registry)),
    sourceBlobs,
    truth: {
      sourceBacked: true,
      publicDiscoveryOnly: true,
      executionAuthority: false,
      automaticInstall: false,
      automaticSelection: false,
      mergeAuthority: false,
      canonAuthority: false,
    },
  };
  return {
    registry,
    receipt: `${JSON.stringify(sortValue(receipt), null, 2)}\n`,
  };
}

function checkFile(target, expected, label) {
  if (!fs.existsSync(target)) fail(`${label} is missing; run with --write`);
  const actual = fs.readFileSync(target, "utf8");
  if (actual !== expected) fail(`${label} drifted; run with --write and review the source change`);
}

const mode = process.argv[2] ?? "--check";
if (!["--check", "--write"].includes(mode)) {
  console.error("usage: node tools/generate-public-capability.mjs [--check|--write]");
  process.exit(2);
}

try {
  const built = build();
  if (mode === "--write") {
    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    fs.writeFileSync(REGISTRY_PATH, built.registry);
    fs.writeFileSync(RECEIPT_PATH, built.receipt);
    console.log("public capability registry written");
  } else {
    checkFile(REGISTRY_PATH, built.registry, "registry/capabilities.jsonl");
    checkFile(RECEIPT_PATH, built.receipt, "registry/capabilities.receipt.json");
    console.log("public capability registry exact: PASS");
  }
} catch (error) {
  console.error(`public capability registry: FAIL: ${error.message}`);
  process.exit(1);
}
