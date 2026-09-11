import assert from "node:assert/strict";
import test from "node:test";
import { HeadlessSimulator } from "../runtime/headless-simulator.js";

function validSaveText() {
  return HeadlessSimulator.create({
    seed: "save-json-admission",
    mode: "sandbox",
    parkName: "Unambiguous Park"
  }).serialize();
}

test("save admission refuses duplicate envelope members before last-key-wins parsing", () => {
  const text = validSaveText().replace(
    '"version": 3,',
    '"version": 999,\n  "version": 3,'
  );

  assert.throws(
    () => HeadlessSimulator.fromSerialized(text),
    (error) => error?.code === "AXM_SAVE_DUPLICATE_KEY"
  );
});

test("save admission refuses escaped-equivalent duplicate state members", () => {
  const text = validSaveText().replace(
    '"schemaVersion": 3,',
    '"schemaVersion": 999,\n    "schema\\u0056ersion": 3,'
  );

  assert.throws(
    () => HeadlessSimulator.fromSerialized(text),
    (error) => error?.code === "AXM_SAVE_DUPLICATE_KEY"
  );
});

test("save admission bounds JSON nesting before semantic state traversal", () => {
  const text = validSaveText();
  const nested = `${"[".repeat(257)}null${"]".repeat(257)}`;
  const ambiguous = text.replace('"savedAt":', `"extra": ${nested},\n  "savedAt":`);

  assert.throws(
    () => HeadlessSimulator.fromSerialized(ambiguous),
    (error) => error?.code === "AXM_SAVE_JSON_TOO_DEEP"
  );
});

test("ordinary serialized saves still round-trip exactly once", () => {
  const simulator = HeadlessSimulator.fromSerialized(validSaveText());
  assert.equal(simulator.summary().parkName, "Unambiguous Park");
  assert.equal(simulator.summary().tick, 0);
});
