import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readSave, writeNewSave } from "../runtime/file-save-store.js";
import { HeadlessSimulator, validateState } from "../runtime/headless-simulator.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "runtime", "cli.js");

test("active v0.4.6 state runs without browser globals", () => {
  assert.equal(globalThis.window, undefined);
  assert.equal(globalThis.document, undefined);
  assert.equal(globalThis.localStorage, undefined);
  const simulator = HeadlessSimulator.create({ seed: "no-browser", parkName: "No Browser Park" });
  assert.equal(validateState(simulator.state), true);
  assert.equal(simulator.summary().parkName, "No Browser Park");
});

test("same seed and options create byte-equivalent authoritative state", () => {
  const options = { seed: "deterministic-start", mode: "sandbox", parkName: "Seed Park" };
  const first = HeadlessSimulator.create(options);
  const second = HeadlessSimulator.create(options);
  assert.deepEqual(first.state, second.state);
  assert.equal(first.summary().stateHash, second.summary().stateHash);
});

test("filesystem save round-trips and refuses overwrite", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "axm-theme-park-headless-"));
  try {
    const savePath = path.join(temp, "park.json");
    const simulator = HeadlessSimulator.create({ seed: "file-roundtrip" });
    const serialized = simulator.serialize();
    assert.equal(writeNewSave(savePath, serialized), path.resolve(savePath));
    assert.equal(readSave(savePath), serialized);
    assert.deepEqual(HeadlessSimulator.fromSerialized(readSave(savePath)).state, simulator.state);
    assert.throws(() => writeNewSave(savePath, serialized), /EEXIST/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("time advancement remains deterministic", () => {
  const first = HeadlessSimulator.create({ seed: "step-proof" });
  const second = HeadlessSimulator.create({ seed: "step-proof" });
  first.advance(240);
  second.advance(240);
  assert.deepEqual(first.state, second.state);
  assert.equal(first.state.tick, 240);
  assert.equal(first.summary().stateHash, second.summary().stateHash);
});

test("action application advances the authoritative state hash", () => {
  const simulator = HeadlessSimulator.create({ seed: "action-proof" });
  const before = simulator.summary().stateHash;
  const result = simulator.apply({ type: "renamePark", name: "Filesystem Kingdom" });
  assert.equal(result.ok, true);
  assert.equal(simulator.state.park.name, "Filesystem Kingdom");
  assert.notEqual(simulator.summary().stateHash, before);
});

test("headless adapter rejects non-finite state introduced by an action", () => {
  const simulator = HeadlessSimulator.create({ seed: "finite-proof" });
  assert.throws(() => simulator.apply({ type: "setTicketPrice", value: "not-a-number" }), /must be finite/);
});

test("CLI creates, steps, inspects, and acts without browser APIs", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "axm-theme-park-cli-"));
  try {
    const initial = path.join(temp, "initial.json");
    const stepped = path.join(temp, "stepped.json");
    const renamed = path.join(temp, "renamed.json");
    const action = path.join(temp, "action.json");
    fs.writeFileSync(action, JSON.stringify({ type: "renamePark", name: "CLI Park" }), "utf8");

    const created = spawnSync(process.execPath, [cliPath, "new", initial, "cli-seed", "sandbox", "Initial Park"], {
      cwd: repoRoot, encoding: "utf8"
    });
    assert.equal(created.status, 0, created.stderr);
    assert.equal(JSON.parse(created.stdout).tick, 0);

    const advanced = spawnSync(process.execPath, [cliPath, "step", initial, stepped, "90"], {
      cwd: repoRoot, encoding: "utf8"
    });
    assert.equal(advanced.status, 0, advanced.stderr);
    assert.equal(JSON.parse(advanced.stdout).tick, 90);

    const inspected = spawnSync(process.execPath, [cliPath, "inspect", stepped], {
      cwd: repoRoot, encoding: "utf8"
    });
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.equal(JSON.parse(inspected.stdout).tick, 90);

    const acted = spawnSync(process.execPath, [cliPath, "action", stepped, renamed, action], {
      cwd: repoRoot, encoding: "utf8"
    });
    assert.equal(acted.status, 0, acted.stderr);
    assert.equal(JSON.parse(acted.stdout).parkName, "CLI Park");
    assert.equal(HeadlessSimulator.fromSerialized(readSave(renamed)).state.park.name, "CLI Park");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
