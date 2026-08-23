import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const metadataPath = path.join(repoRoot, ".axm-intake", "SOURCE_ARCHIVES.json");
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const issues = [];
const localPatchesPath = path.join(repoRoot, ".axm-intake", "LOCAL_PATCHES.json");
const localPatchManifest = fs.existsSync(localPatchesPath)
  ? JSON.parse(fs.readFileSync(localPatchesPath, "utf8"))
  : { patches: [] };
const localPatches = new Map();
const seenLocalPatches = new Set();

for (const patch of localPatchManifest.patches ?? []) {
  const key = `${patch.index}\0${patch.path}`;
  if (localPatches.has(key)) issues.push(`duplicate local patch entry: ${patch.index} ${patch.path}`);
  if (!/^[0-9a-f]{64}$/.test(patch.originalSha256 ?? "")) {
    issues.push(`local patch has invalid original hash: ${patch.path}`);
  }
  if (!/^[0-9a-f]{64}$/.test(patch.currentSha256 ?? "")) {
    issues.push(`local patch has invalid current hash: ${patch.path}`);
  }
  localPatches.set(key, patch);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function countFiles(target, { ignorePythonCache = false } = {}) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) throw new Error(`Symbolic links are outside the intake seal: ${target}`);
  if (stat.isFile()) return 1;
  if (!stat.isDirectory()) return 0;
  return fs.readdirSync(target, { withFileTypes: true })
    .filter((entry) => !ignorePythonCache || entry.name !== "__pycache__")
    .reduce((total, entry) => total + countFiles(path.join(target, entry.name), { ignorePythonCache }), 0);
}

function verifyIndex(root, indexName, expectedRows) {
  const indexPath = path.join(root, indexName);
  const rows = fs.readFileSync(indexPath, "utf8").split(/\r?\n/).filter((line) => line.trim());
  if (rows.length !== expectedRows) issues.push(`${indexName}: expected ${expectedRows} rows, found ${rows.length}`);
  let passed = 0;
  let locallyPatched = 0;
  for (const line of rows) {
    const match = /^([0-9a-fA-F]{64})\s{2,}(.+)$/.exec(line);
    if (!match) {
      issues.push(`${indexName}: malformed row`);
      continue;
    }
    const relative = match[2].replaceAll("\\", "/");
    if (relative.startsWith("/") || /^[A-Za-z]:/.test(relative) || relative.split("/").includes("..")) {
      issues.push(`${indexName}: unsafe path ${relative}`);
      continue;
    }
    const target = path.resolve(root, ...relative.split("/"));
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`) || !fs.existsSync(target)) {
      issues.push(`${indexName}: missing or escaped path ${relative}`);
      continue;
    }
    const actual = sha256(target);
    const original = match[1].toLowerCase();
    const patchKey = `${indexName}\0${relative}`;
    const patch = localPatches.get(patchKey);
    if (actual === original) {
      if (patch) issues.push(`${indexName}: obsolete local patch entry ${relative}`);
      passed += 1;
      continue;
    }
    if (patch?.originalSha256 === original && patch.currentSha256 === actual) {
      passed += 1;
      locallyPatched += 1;
      seenLocalPatches.add(patchKey);
      continue;
    }
    issues.push(`${indexName}: hash mismatch ${relative}`);
  }
  return { index: indexName, rows: rows.length, passed, locallyPatched };
}

const active = metadata.lineages.active;
const activeCount = active.topLevelEntries.reduce((total, entry) => {
  const target = path.join(repoRoot, entry);
  if (!fs.existsSync(target)) {
    issues.push(`active source entry missing: ${entry}`);
    return total;
  }
  return total + countFiles(target);
}, 0);
if (activeCount !== active.sourceFiles) {
  issues.push(`active source count: expected ${active.sourceFiles}, found ${activeCount}`);
}

const donorRoot = path.join(repoRoot, ...metadata.lineages.donor.root.split("/"));
const donorCount = countFiles(donorRoot, { ignorePythonCache: true });
if (donorCount !== metadata.lineages.donor.sourceFiles) {
  issues.push(`donor source count: expected ${metadata.lineages.donor.sourceFiles}, found ${donorCount}`);
}

const indexes = [
  verifyIndex(repoRoot, "CHECKSUMS.sha256", 96),
  verifyIndex(repoRoot, "PLAYABLE_3D_V0_4_6_CHECKSUMS.sha256", 46),
  verifyIndex(donorRoot, "CHECKSUMS.sha256", 201)
];

for (const key of localPatches.keys()) {
  if (!seenLocalPatches.has(key)) {
    const patch = localPatches.get(key);
    issues.push(`local patch does not match an indexed changed file: ${patch.index} ${patch.path}`);
  }
}

const playableManifest = JSON.parse(fs.readFileSync(path.join(repoRoot, "playable_3d", "PLAYABLE_3D_MODULE_MANIFEST.json"), "utf8"));
if (playableManifest.version !== "0.4.6") issues.push(`playable manifest version is ${playableManifest.version}`);
if (!playableManifest.runtime?.authoritative_simulation_tick_separate_from_visual_frame) {
  issues.push("playable manifest does not declare simulation/render separation");
}
for (const required of [
  "runtime/cli.js",
  "runtime/headless-simulator.js",
  "runtime/file-save-store.js",
  "donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py"
]) {
  if (!fs.existsSync(path.join(repoRoot, ...required.split("/")))) issues.push(`missing required path: ${required}`);
}

const report = {
  schema: "axm.theme-park-local-intake-verification/v1",
  pass: issues.length === 0,
  active: { version: active.version, sourceFiles: activeCount },
  donor: { version: metadata.lineages.donor.version, sourceFiles: donorCount },
  checksumIndexes: indexes,
  localPatches: {
    manifest: fs.existsSync(localPatchesPath),
    declared: localPatches.size,
    verified: seenLocalPatches.size,
    archiveChecksumIndexesModified: false
  },
  boundary: {
    standaloneSiblingSimulator: true,
    workshopRuntimeRequired: false,
    browserRole: "OPTIONAL_WEBGL_CLIENT",
    headlessFilesystemRuntime: true,
    canon: false
  },
  issues
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (issues.length) process.exitCode = 1;
