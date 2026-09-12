import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { writeNewSave } from "../runtime/file-save-store.js";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "axm-theme-park-save-publication-"));
  const target = path.join(dir, "park.json");
  return { dir, target };
}

function siblingTemps(dir, target) {
  const prefix = `.${path.basename(target)}.axm-save-`;
  return fs.readdirSync(dir).filter((name) => name.startsWith(prefix));
}

test("an interrupted write never publishes a partial final save", () => {
  const { dir, target } = makeFixture();
  const originalWriteFileSync = fs.writeFileSync;
  let intercepted = false;

  fs.writeFileSync = function interruptedWrite(file, data, options) {
    if (!intercepted) {
      intercepted = true;
      const text = String(data);
      const partial = text.slice(0, Math.max(1, Math.floor(text.length / 2)));
      originalWriteFileSync.call(fs, file, partial, options);
      const error = new Error("simulated interrupted save write");
      error.code = "AXM_TEST_INTERRUPTED_SAVE_WRITE";
      throw error;
    }
    return originalWriteFileSync.call(fs, file, data, options);
  };

  try {
    assert.throws(
      () => writeNewSave(target, '{"park":"complete-save"}\n'),
      (error) => error?.code === "AXM_TEST_INTERRUPTED_SAVE_WRITE"
    );
  } finally {
    fs.writeFileSync = originalWriteFileSync;
  }

  assert.equal(intercepted, true);
  assert.equal(fs.existsSync(target), false, "failed publication must leave the final path absent");
  assert.deepEqual(siblingTemps(dir, target), [], "failed publication must clean its own sibling temp");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("successful publication exposes exact bytes and preserves create-only authority", () => {
  const { dir, target } = makeFixture();
  const first = '{"park":"first"}\n';

  assert.equal(writeNewSave(target, first), path.resolve(target));
  assert.equal(fs.readFileSync(target, "utf8"), first);
  assert.deepEqual(siblingTemps(dir, target), []);

  assert.throws(
    () => writeNewSave(target, '{"park":"replacement"}\n'),
    (error) => error?.code === "EEXIST"
  );
  assert.equal(fs.readFileSync(target, "utf8"), first, "an existing save must never be replaced");
  assert.deepEqual(siblingTemps(dir, target), []);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("oversize admission fails before any destination or temp file is created", () => {
  const { dir, target } = makeFixture();
  const oversized = "x".repeat(64 * 1024 * 1024 + 1);

  assert.throws(() => writeNewSave(target, oversized), /Save exceeds 67108864 bytes/);
  assert.equal(fs.existsSync(target), false);
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.rmSync(dir, { recursive: true, force: true });
});
