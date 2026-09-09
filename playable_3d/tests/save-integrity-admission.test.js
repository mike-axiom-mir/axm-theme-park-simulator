import test from "node:test";
import assert from "node:assert/strict";

import { createNewGame } from "../src/core/simulation.js";
import { deserializeGame, serializeGame, SAVE_VERSION } from "../src/core/save.js";

test("current saves require their declared state hash", () => {
  const payload = JSON.parse(serializeGame(createNewGame({ seed: "required-save-hash" })));
  assert.equal(payload.version, SAVE_VERSION);

  delete payload.state.stateHash;
  assert.throws(
    () => deserializeGame(JSON.stringify(payload)),
    (error) => error?.code === "AXM_SAVE_INTEGRITY_REQUIRED"
  );
});

test("legacy saves may still migrate when no hash was recorded", () => {
  const payload = JSON.parse(serializeGame(createNewGame({ seed: "legacy-save-hash" })));
  payload.version = 2;
  delete payload.state.stateHash;

  const restored = deserializeGame(JSON.stringify(payload));
  assert.equal(restored.schemaVersion, 3);
  assert.equal(typeof restored.stateHash, "string");
  assert.equal(restored.stateHash.length, 8);
});
