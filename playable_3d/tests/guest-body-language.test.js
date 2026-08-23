import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  deriveGuestBodyLanguage, describeGuestBodyLanguage, GUEST_BODY_LANGUAGE_SCHEMA
} from "../src/presentation/guestBodyLanguage.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const closeTo = (actual, expected, tolerance = 1e-12) => Math.abs(actual - expected) <= tolerance;

function visitor(overrides = {}) {
  return {
    id: "visitor-17",
    state: "idle",
    activityRemaining: 0,
    patience: 48,
    energy: 0.9,
    happiness: 72,
    ...overrides
  };
}

test("guest body language is deterministic, frozen and does not mutate visitor evidence", () => {
  const input = visitor({ state: "queueing", activityRemaining: 48 });
  const before = structuredClone(input);
  const first = deriveGuestBodyLanguage(input);
  const second = deriveGuestBodyLanguage(input);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(first.schema, GUEST_BODY_LANGUAGE_SCHEMA);
  assert.equal(first.pose, "impatient");
  assert.ok(closeTo(first.intensity, 0.5));
  assert.ok(Object.isFrozen(first));
});

test("committed activity poses take priority over softer mood cues", () => {
  assert.equal(deriveGuestBodyLanguage(visitor({
    state: "resting", energy: 0.1, happiness: 10, activityRemaining: 80
  })).pose, "resting");
  assert.equal(deriveGuestBodyLanguage(visitor({
    state: "usingService", energy: 0.1, happiness: 10
  })).pose, "service");
});

test("tired and disappointed postures reuse existing simulation thresholds", () => {
  const tired = deriveGuestBodyLanguage(visitor({ energy: 0.39, happiness: 20 }));
  const disappointed = deriveGuestBodyLanguage(visitor({ energy: 0.8, happiness: 30 }));
  const neutral = deriveGuestBodyLanguage(visitor({ energy: 0.58, happiness: 45 }));
  assert.equal(tired.pose, "tired");
  assert.ok(closeTo(tired.intensity, 0.5));
  assert.equal(disappointed.pose, "disappointed");
  assert.ok(closeTo(disappointed.intensity, 0.5));
  assert.equal(neutral.pose, "neutral");
});

test("human-readable cue is derived from the exact same body-language descriptor", () => {
  const input = visitor({ state: "queueing", activityRemaining: 48 });
  const cue = describeGuestBodyLanguage(input);
  assert.equal(cue.pose, deriveGuestBodyLanguage(input).pose);
  assert.equal(cue.label, "Impatient");
  assert.equal(cue.reason, "long queue");
  assert.equal(cue.strength, 50);
  assert.ok(Object.isFrozen(cue));

  const neutral = describeGuestBodyLanguage(visitor());
  assert.equal(neutral.label, "Neutral");
  assert.equal(neutral.reason, "no urgent posture cue");
  assert.equal(neutral.strength, 0);
});

test("expressive renderer remains presentation-only and explains explicit selections", () => {
  const renderer = read("../src/render/expressiveWorldRenderer.js");
  assert.match(renderer, /extends BaseWorldRenderer/);
  assert.match(renderer, /super\.syncVisitors\(time\)/);
  assert.match(renderer, /super\.selectVisitor\(visitorId\)/);
  assert.match(renderer, /deriveGuestBodyLanguage/);
  assert.match(renderer, /describeGuestBodyLanguage/);
  assert.match(renderer, /onWorldMessage/);
  assert.doesNotMatch(renderer, /advanceOneMinute|applyAction|saveToSlot|stateHash/);
});
