import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { describeCapability } from "../runtime/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  const completed = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" }
  });
  assert.equal(completed.status, 0, completed.stderr || completed.stdout);
  return completed;
}

test("capability metadata describes a bounded offline consumer surface", () => {
  const capability = describeCapability();
  assert.equal(capability.schema, "axm.capability/v1");
  assert.equal(capability.id, "axm.theme-park.headless-simulator");
  assert.equal(capability.runtime.networkRequired, false);
  assert.equal(capability.contracts.save, "axm.theme-park.playable-save/v3");
  assert.equal(capability.authority.canonical, false);
});

test("packed tarball installs offline and works outside the checkout", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "axm-theme-park-package-"));
  const pack = run("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", temp]);
  const [packed] = JSON.parse(pack.stdout);
  const names = packed.files.map((entry) => entry.path).sort();

  assert.ok(packed.size < 250_000, `package is unexpectedly large: ${packed.size} bytes`);
  assert.ok(names.includes("runtime/index.js"));
  assert.ok(names.includes("playable_3d/src/core/simulation.js"));
  assert.ok(names.includes("HEADLESS_CONSUMER.md"));
  assert.ok(names.includes("LICENSE"));
  assert.ok(names.includes("THIRD_PARTY.json"));
  assert.equal(names.some((name) => name.startsWith("donor/")), false);
  assert.equal(names.some((name) => name.startsWith("playable_3d/dist/")), false);
  assert.equal(names.some((name) => name.startsWith("intake-tests/")), false);

  const archive = path.join(temp, packed.filename);
  const consumer = path.join(temp, "consumer");
  run("npm", ["install", "--offline", "--ignore-scripts", "--prefix", consumer, archive]);

  const imported = run(process.execPath, [
    "--input-type=module",
    "-e",
    [
      "import { HeadlessSimulator, describeCapability } from 'axm-theme-park-simulator-local';",
      "const first = HeadlessSimulator.create({ seed: 'external-consumer', mode: 'sandbox' });",
      "const second = HeadlessSimulator.create({ seed: 'external-consumer', mode: 'sandbox' });",
      "process.stdout.write(JSON.stringify({",
      "  id: describeCapability().id,",
      "  deterministic: first.summary().stateHash === second.summary().stateHash,",
      "  summary: first.summary()",
      "}));"
    ].join("\n")
  ], { cwd: consumer });
  const importedResult = JSON.parse(imported.stdout);
  assert.equal(importedResult.id, "axm.theme-park.headless-simulator");
  assert.equal(importedResult.deterministic, true);
  assert.equal(importedResult.summary.schema, "axm.theme-park.headless-summary/v1");

  const command = path.join(consumer, "node_modules", ".bin", "axm-theme-park-headless");
  const described = run(command, ["describe"], { cwd: consumer });
  assert.equal(JSON.parse(described.stdout).capability.id, "axm.theme-park.headless-simulator");

  const save = path.join(consumer, "external-park.json");
  const created = run(command, ["new", save, "external-cli", "campaign", "External Park"], { cwd: consumer });
  assert.equal(JSON.parse(created.stdout).parkName, "External Park");
  assert.equal(fs.existsSync(save), true);
});
