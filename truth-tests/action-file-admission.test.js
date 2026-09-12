import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "runtime", "cli.js");

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

function createInitial(temp) {
  const initial = path.join(temp, "initial.json");
  const created = runCli(["new", initial, "action-admission", "sandbox", "Admission Park"]);
  assert.equal(created.status, 0, created.stderr || created.stdout);
  return initial;
}

function requireHeld({ writeAction, expectedCode }) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "axm-theme-action-admission-"));
  try {
    const initial = createInitial(temp);
    const output = path.join(temp, "output.json");
    const action = path.join(temp, "action.json");
    writeAction(action, temp);

    const completed = runCli(["action", initial, output, action]);
    assert.notEqual(completed.status, 0, "unsafe action input crossed CLI admission");
    assert.equal(fs.existsSync(output), false, "held action must not publish a new save");
    assert.match(completed.stderr, new RegExp(`\\[${expectedCode}\\]`));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test("CLI refuses duplicate decoded action member names", () => {
  requireHeld({
    expectedCode: "AXM_ACTION_DUPLICATE_KEY",
    writeAction(action) {
      fs.writeFileSync(action, '{"type":"renamePark","name":"First","name":"Second"}', "utf8");
    }
  });
});

test("CLI refuses escaped-equivalent duplicate action member names", () => {
  requireHeld({
    expectedCode: "AXM_ACTION_DUPLICATE_KEY",
    writeAction(action) {
      fs.writeFileSync(action, '{"type":"renamePark","name":"First","na\\u006de":"Second"}', "utf8");
    }
  });
});

test("CLI refuses malformed UTF-8 instead of replacement-decoding action bytes", () => {
  requireHeld({
    expectedCode: "AXM_ACTION_INVALID_UTF8",
    writeAction(action) {
      fs.writeFileSync(action, Buffer.concat([
        Buffer.from('{"type":"renamePark","name":"Bad ', "utf8"),
        Buffer.from([0xff]),
        Buffer.from('"}', "utf8")
      ]));
    }
  });
});

test("CLI refuses a symbolic-link action path", { skip: process.platform === "win32" }, () => {
  requireHeld({
    expectedCode: "AXM_ACTION_PATH_SYMLINK",
    writeAction(action, temp) {
      const target = path.join(temp, "actual-action.json");
      fs.writeFileSync(target, JSON.stringify({ type: "renamePark", name: "Symlink Park" }), "utf8");
      fs.symlinkSync(target, action);
    }
  });
});

test("CLI exposes stable oversize action refusal identity", () => {
  requireHeld({
    expectedCode: "AXM_ACTION_TOO_LARGE",
    writeAction(action) {
      fs.writeFileSync(action, Buffer.alloc(1024 * 1024 + 1, 0x20));
    }
  });
});
