import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  deriveGuestBodyLanguage, describeGuestBodyLanguage, GUEST_BODY_LANGUAGE_SCHEMA
} from "../src/presentation/guestBodyLanguage.js";
import {
  deriveParkVisionPlan, nextParkVisionMode, PARK_VISION_MARKER_LIMIT, PARK_VISION_MODES
} from "../src/render/expressiveWorldRenderer.js";

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
    hunger: 0.1,
    thirst: 0.1,
    toilet: 0.1,
    ...overrides
  };
}

function visionState(overrides = {}) {
  return {
    visitors: [
      visitor({ id: "visitor-1", state: "walking" }),
      visitor({ id: "visitor-2", state: "queueing", activityRemaining: 50, thirst: 0.9 }),
      visitor({ id: "visitor-3", energy: 0.3 })
    ],
    world: {
      entities: [
        {
          id: "ride-1", x: 4, z: 5, accessCell: [4, 6], queueCapacity: 8,
          queueWaitMinutes: 30, queue: ["visitor-2"], condition: 76
        },
        {
          id: "ride-2", x: 8, z: 9, accessCell: [8, 10], queueCapacity: 8,
          queueWaitMinutes: 0, queue: [], condition: 100
        }
      ],
      litter: [{ id: "litter-1", cell: [6, 6], amount: 2 }]
    },
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

test("Park Vision cycles through bounded management views deterministically", () => {
  assert.deepEqual(PARK_VISION_MODES, ["off", "guests", "queues", "needs", "operations"]);
  assert.equal(nextParkVisionMode("off"), "guests");
  assert.equal(nextParkVisionMode("operations"), "off");

  const state = visionState();
  const before = structuredClone(state);
  for (const mode of PARK_VISION_MODES) {
    const first = deriveParkVisionPlan(state, mode);
    const second = deriveParkVisionPlan(state, mode);
    assert.deepEqual(first, second, `${mode} plan drifted`);
    assert.ok(first.markerCount <= PARK_VISION_MARKER_LIMIT);
    assert.ok(Object.isFrozen(first));
    assert.ok(Object.isFrozen(first.markers));
  }
  assert.deepEqual(state, before, "Park Vision must not mutate authoritative state");
});

test("Park Vision reuses real queue, need, condition and litter evidence", () => {
  const state = visionState();
  const queues = deriveParkVisionPlan(state, "queues");
  assert.equal(queues.markerCount, 1);
  assert.equal(queues.markers[0].id, "queue:ride-1");
  assert.deepEqual(queues.markers[0].cell, [4, 6]);

  const needs = deriveParkVisionPlan(state, "needs");
  assert.ok(needs.markers.some((marker) => marker.id === "need:visitor-2" && marker.kind === "drink"));
  assert.ok(needs.markers.some((marker) => marker.id === "need:visitor-3" && marker.kind === "rest"));

  const operations = deriveParkVisionPlan(state, "operations");
  assert.ok(operations.markers.some((marker) => marker.id === "condition:ride-1"));
  assert.ok(operations.markers.some((marker) => marker.id === "litter:litter-1"));
  assert.ok(!operations.markers.some((marker) => marker.id === "condition:ride-2"));
});

test("Park Vision marker budget stays hard under crowd pressure", () => {
  const visitors = Array.from({ length: 120 }, (_, index) => visitor({
    id: `visitor-${index + 1}`,
    state: index % 3 === 0 ? "queueing" : "walking",
    activityRemaining: index % 3 === 0 ? 50 : 0
  }));
  const plan = deriveParkVisionPlan(visionState({ visitors }), "guests");
  assert.equal(plan.markerCount, PARK_VISION_MARKER_LIMIT);
});

test("expressive renderer remains presentation-only and explains explicit selections", () => {
  const renderer = read("../src/render/expressiveWorldRenderer.js");
  const main = read("../src/main.js");
  assert.match(renderer, /extends BaseWorldRenderer/);
  assert.match(renderer, /super\.syncVisitors\(time\)/);
  assert.match(renderer, /super\.syncStaffAndLitter\(time\)/);
  assert.match(renderer, /super\.selectVisitor\(visitorId\)/);
  assert.match(renderer, /deriveGuestBodyLanguage/);
  assert.match(renderer, /describeGuestBodyLanguage/);
  assert.match(renderer, /deriveParkVisionPlan/);
  assert.match(renderer, /PARK_VISION_MARKER_LIMIT = 40/);
  assert.match(renderer, /onWorldMessage/);
  assert.match(main, /vision-button/);
  assert.match(main, /KeyV/);
  assert.doesNotMatch(renderer, /advanceOneMinute|applyAction|saveToSlot|stateHash/);
});
