import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = path.join(ROOT, "registry", "capabilities.jsonl");
const RECEIPT = path.join(ROOT, "registry", "capabilities.receipt.json");

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash("sha1").update(header).update(buffer).digest("hex");
}

function runGenerator(root, mode = "--check") {
  return spawnSync(process.execPath, [path.join(root, "tools", "generate-public-capability.mjs"), mode], {
    cwd: root,
    encoding: "utf8",
  });
}

function makeFixture() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "axm-theme-park-discovery-"));
  for (const relativePath of [
    "package.json",
    "runtime/index.js",
    "runtime/package-metadata.js",
    "LICENSE",
    "tools/generate-public-capability.mjs",
    "registry/capabilities.jsonl",
    "registry/capabilities.receipt.json",
  ]) {
    const source = path.join(ROOT, relativePath);
    const target = path.join(temp, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return temp;
}

test("committed public capability output is exact", () => {
  const result = runGenerator(ROOT);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /exact: PASS/);
});

test("public record mirrors the real package descriptor without execution authority", () => {
  const described = spawnSync(process.execPath, [path.join(ROOT, "runtime", "cli.js"), "describe"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(described.status, 0, described.stderr);
  const provider = JSON.parse(described.stdout).capability;
  const records = fs.readFileSync(REGISTRY, "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(records.length, 1);
  const record = records[0];
  assert.equal(record.id, provider.id);
  assert.equal(record.version, provider.version);
  assert.equal(record.status, provider.status);
  assert.deepEqual(record.entrypoints, provider.entrypoints);
  assert.deepEqual(record.contracts, provider.contracts);
  assert.equal(record.runtime.networkRequired, false);
  assert.deepEqual(record.runtime.dependencies, []);
  assert.deepEqual(record.consumers, []);
  assert.deepEqual(record.authority, {
    automaticInstall: false,
    automaticSelection: false,
    canon: false,
    discoveryOnly: true,
    execution: false,
    merge: false,
  });
});

test("receipt binds registry and every declared source to exact bytes", () => {
  const receipt = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
  assert.equal(
    receipt.registrySha256,
    crypto.createHash("sha256").update(fs.readFileSync(REGISTRY)).digest("hex"),
  );
  for (const [relativePath, expected] of Object.entries(receipt.sourceBlobs)) {
    assert.equal(gitBlobSha(fs.readFileSync(path.join(ROOT, relativePath))), expected, relativePath);
  }
  assert.equal(receipt.truth.sourceBacked, true);
  assert.equal(receipt.truth.executionAuthority, false);
  assert.equal(receipt.truth.mergeAuthority, false);
  assert.equal(receipt.truth.canonAuthority, false);
});

test("generator fails closed if the provider widens to a network-required runtime", () => {
  const temp = makeFixture();
  try {
    const packagePath = path.join(temp, "package.json");
    const document = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    document.axmCapability.runtime.networkRequired = true;
    fs.writeFileSync(packagePath, `${JSON.stringify(document, null, 2)}\n`);
    const result = runGenerator(temp, "--write");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /offline Node runtime/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("generator fails closed if a source path becomes a symlink", () => {
  const temp = makeFixture();
  try {
    const source = path.join(temp, "runtime", "index.js");
    fs.rmSync(source);
    fs.symlinkSync("../package.json", source);
    const result = runGenerator(temp, "--write");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source symlink rejected/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
