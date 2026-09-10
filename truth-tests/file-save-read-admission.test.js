import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { MAX_SAVE_BYTES, readSave } from "../runtime/file-save-store.js";

function makeFixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "axm-theme-park-save-read-"));
}

function removeFixture(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test("a validated save path cannot be swapped to another file before the read", { skip: process.platform === "win32" }, () => {
  const dir = makeFixture();
  const target = path.join(dir, "park.json");
  const original = path.join(dir, "park.original.json");
  const other = path.join(dir, "other.json");
  fs.writeFileSync(target, '{"park":"expected"}\n', "utf8");
  fs.writeFileSync(other, '{"park":"other-file"}\n', "utf8");

  const originalStatSync = fs.statSync;
  const originalLstatSync = fs.lstatSync;
  let swapped = false;

  function maybeSwap(filePath) {
    if (!swapped && path.resolve(String(filePath)) === path.resolve(target)) {
      swapped = true;
      fs.renameSync(target, original);
      fs.symlinkSync(other, target);
    }
  }

  fs.statSync = function injectedStat(filePath, ...args) {
    const stat = originalStatSync.call(fs, filePath, ...args);
    maybeSwap(filePath);
    return stat;
  };
  fs.lstatSync = function injectedLstat(filePath, ...args) {
    const stat = originalLstatSync.call(fs, filePath, ...args);
    maybeSwap(filePath);
    return stat;
  };

  try {
    assert.throws(
      () => readSave(target),
      (error) => error?.code === "AXM_SAVE_PATH_CHANGED"
    );
  } finally {
    fs.statSync = originalStatSync;
    fs.lstatSync = originalLstatSync;
    removeFixture(dir);
  }

  assert.equal(swapped, true, "the test must force a path replacement between validation and open");
});

test("a save path that is already a symlink is refused instead of followed", { skip: process.platform === "win32" }, () => {
  const dir = makeFixture();
  const target = path.join(dir, "park.json");
  const link = path.join(dir, "park-link.json");
  fs.writeFileSync(target, '{"park":"target"}\n', "utf8");
  fs.symlinkSync(target, link);

  try {
    assert.throws(
      () => readSave(link),
      (error) => error?.code === "AXM_SAVE_PATH_SYMLINK"
    );
  } finally {
    removeFixture(dir);
  }
});

test("invalid UTF-8 save bytes are refused instead of replacement-decoded", () => {
  const dir = makeFixture();
  const target = path.join(dir, "park.json");
  fs.writeFileSync(target, Buffer.from([0x7b, 0x22, 0x70, 0x61, 0x72, 0x6b, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]));

  try {
    assert.throws(
      () => readSave(target),
      (error) => error?.code === "AXM_SAVE_INVALID_UTF8"
    );
  } finally {
    removeFixture(dir);
  }
});

test("oversize save admission exposes a stable failure code", () => {
  const dir = makeFixture();
  const target = path.join(dir, "park.json");
  const fd = fs.openSync(target, "w", 0o600);
  fs.ftruncateSync(fd, MAX_SAVE_BYTES + 1);
  fs.closeSync(fd);

  try {
    assert.throws(
      () => readSave(target),
      (error) => error?.code === "AXM_SAVE_TOO_LARGE"
    );
  } finally {
    removeFixture(dir);
  }
});

test("an ordinary regular UTF-8 save still returns exact text", () => {
  const dir = makeFixture();
  const target = path.join(dir, "park.json");
  const expected = '{"park":"ordinary","emoji":"🎢"}\n';
  fs.writeFileSync(target, expected, "utf8");

  try {
    assert.equal(readSave(target), expected);
  } finally {
    removeFixture(dir);
  }
});
