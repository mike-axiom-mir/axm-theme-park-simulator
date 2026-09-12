import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_LOG_RETAINED_LIMIT,
  appendRetainedEvent,
  eventStreamSummary,
  validateEventStream
} from "../src/core/eventStream.js";
import { createNewGame } from "../src/core/simulation.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";
import { stateHash } from "../src/core/random.js";
import { validateState } from "../../runtime/headless-simulator.js";

test("retained history never reuses canonical event sequence identity", () => {
  const state = createNewGame({ seed: "event-window-proof" });
  const initialSequence = state.eventStream.lastSequence;
  for (let index = 0; index < EVENT_LOG_RETAINED_LIMIT + 37; index += 1) {
    appendRetainedEvent(state, {
      tick: state.tick + index,
      type: "test.window.event",
      subjectId: `subject-${index}`,
      data: { index }
    });
  }
  const sequences = state.eventLog.map((record) => record.sequence);
  assert.equal(state.eventLog.length, EVENT_LOG_RETAINED_LIMIT);
  assert.equal(new Set(sequences).size, EVENT_LOG_RETAINED_LIMIT);
  assert.equal(sequences.at(-1), initialSequence + EVENT_LOG_RETAINED_LIMIT + 37);
  assert.ok(sequences.every((sequence, index) => index === 0 || sequence > sequences[index - 1]));
  assert.deepEqual(eventStreamSummary(state), {
    schema: "axm.theme-park.event-stream/v1",
    lastSequence: initialSequence + EVENT_LOG_RETAINED_LIMIT + 37,
    retained: EVENT_LOG_RETAINED_LIMIT,
    retainedLimit: EVENT_LOG_RETAINED_LIMIT,
    firstRetainedSequence: initialSequence + 38,
    lastRetainedSequence: initialSequence + EVENT_LOG_RETAINED_LIMIT + 37,
    sequenceFloorBeforeWindow: initialSequence + 37,
    continuity: "continuous"
  });
});

test("save round trip preserves the cursor and the next identity", () => {
  const state = createNewGame({ seed: "event-cursor-roundtrip" });
  for (let index = 0; index < 420; index += 1) {
    appendRetainedEvent(state, { tick: index, type: "test.roundtrip", subjectId: "park" });
  }
  const restored = deserializeGame(serializeGame(state));
  const before = restored.eventStream.lastSequence;
  const record = appendRetainedEvent(restored, { tick: 421, type: "test.after-restart", subjectId: "park" });
  assert.equal(record.sequence, before + 1);
  assert.equal(validateEventStream(restored).length, 0);
});

test("legacy duplicate identity is preserved and bounded instead of rewritten", () => {
  const legacy = createNewGame({ seed: "legacy-event-ambiguity" });
  delete legacy.eventStream;
  legacy.eventLog = [
    { sequence: 400, tick: 1, type: "legacy", subjectId: "park", data: {} },
    { sequence: 401, tick: 2, type: "legacy", subjectId: "park", data: {} },
    { sequence: 401, tick: 3, type: "legacy", subjectId: "park", data: {} }
  ];
  legacy.stateHash = stateHash(legacy);
  const restored = deserializeGame(JSON.stringify({
    schema: "axm.theme-park.playable-save",
    version: 3,
    savedAt: "2026-09-09T00:00:00.000Z",
    state: legacy
  }));
  assert.equal(restored.eventStream.continuity, "legacy_sequence_ambiguity");
  assert.deepEqual(restored.eventLog.map((record) => record.sequence), [400, 401, 401]);
  const next = appendRetainedEvent(restored, { tick: 4, type: "new", subjectId: "park" });
  assert.equal(next.sequence, 402);
});

test("headless admission rejects cursor and retention-policy drift", () => {
  const state = createNewGame({ seed: "event-cursor-admission" });
  state.eventStream.lastSequence -= 1;
  state.eventStream.retainedLimit = 999;
  state.stateHash = stateHash(state);
  assert.deepEqual(validateEventStream(state), [
    `eventStream.retainedLimit must be ${EVENT_LOG_RETAINED_LIMIT}`,
    "eventStream.lastSequence must match the newest retained sequence"
  ]);
  assert.throws(() => validateState(state), /retainedLimit.*newest retained sequence/);
});
