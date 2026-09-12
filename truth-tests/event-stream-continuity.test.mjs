import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_LOG_RETAINED_LIMIT,
  EVENT_STREAM_SCHEMA,
  appendRetainedEvent,
  validateEventStream
} from "../playable_3d/src/core/eventStream.js";

function streamState({ lastSequence, continuity = "continuous", sequences }) {
  return {
    eventStream: {
      schema: EVENT_STREAM_SCHEMA,
      lastSequence,
      retainedLimit: EVENT_LOG_RETAINED_LIMIT,
      continuity
    },
    eventLog: sequences.map((sequence) => ({
      sequence,
      tick: sequence,
      type: "test.event",
      subjectId: "park",
      data: {}
    }))
  };
}

test("continuous event streams admit only an exact retained suffix", () => {
  const missingMiddle = streamState({ lastSequence: 3, sequences: [1, 3] });
  assert.deepEqual(validateEventStream(missingMiddle), [
    "continuous eventLog must be a contiguous suffix ending at eventStream.lastSequence"
  ]);
  assert.throws(
    () => appendRetainedEvent(missingMiddle, {
      tick: 4,
      type: "test.after-gap",
      subjectId: "park"
    }),
    /contiguous suffix/
  );

  const retainedWindow = streamState({
    lastSequence: EVENT_LOG_RETAINED_LIMIT + 37,
    sequences: Array.from(
      { length: EVENT_LOG_RETAINED_LIMIT },
      (_, index) => index + 38
    )
  });
  assert.deepEqual(validateEventStream(retainedWindow), []);
});

test("an empty retained log cannot carry a continuous nonzero cursor", () => {
  const impossibleEmptyWindow = streamState({ lastSequence: 12, sequences: [] });
  assert.deepEqual(validateEventStream(impossibleEmptyWindow), [
    "eventStream.lastSequence must be 0 when eventLog is empty"
  ]);
});

test("declared legacy retained windows preserve strictly increasing gaps", () => {
  const legacyWindow = streamState({
    lastSequence: 903,
    continuity: "legacy_retained_window",
    sequences: [900, 903]
  });
  assert.deepEqual(validateEventStream(legacyWindow), []);
});
