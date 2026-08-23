import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PARK_MOTION_SCHEMA, deriveRideMotion, deriveServiceMotion
} from "../src/presentation/parkMotion.js";
import { createEntityModel } from "../src/render/models.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("ride motion is deterministic, frozen, state-aware, and render-only", () => {
  const queuedRide = { open: true, cycleRemaining: 0, queue: ["guest-a", "guest-b"], riders: [] };
  const before = structuredClone(queuedRide);
  const waiting = deriveRideMotion(queuedRide, 3.5);
  assert.equal(waiting.schema, PARK_MOTION_SCHEMA);
  assert.equal(waiting.waiting, true);
  assert.equal(waiting.active, false);
  assert.ok(waiting.speed > 0);
  assert.ok(Object.isFrozen(waiting));
  assert.deepEqual(waiting, deriveRideMotion(queuedRide, 3.5));
  assert.deepEqual(queuedRide, before);

  const active = deriveRideMotion({ ...queuedRide, cycleRemaining: 4 }, 3.5);
  const closed = deriveRideMotion({ ...queuedRide, open: false }, 3.5);
  assert.ok(active.speed > waiting.speed);
  assert.equal(active.boardingPulse, 1);
  assert.equal(deriveRideMotion({ ...queuedRide, cycleRemaining: 4, riders: ["r1", "r2"] }, 3.5).riderCount, 2);
  assert.equal(closed.speed, 0);
  assert.equal(closed.turnstileSpeed, 0);
});

test("service motion exposes shutter, counter, and sign states without changing economy state", () => {
  const service = { open: true, cycleRemaining: 2, queue: ["guest-a"], price: 5 };
  const before = structuredClone(service);
  const active = deriveServiceMotion(service, 8);
  assert.equal(active.schema, PARK_MOTION_SCHEMA);
  assert.equal(active.shutterTarget, 1);
  assert.equal(active.servicePulse, 1);
  assert.ok(active.counterSpeed > 0);
  assert.ok(Object.isFrozen(active));
  assert.deepEqual(service, before);

  const closed = deriveServiceMotion({ ...service, open: false }, 8);
  assert.equal(closed.shutterTarget, 0);
  assert.equal(closed.counterSpeed, 0);
  assert.equal(closed.servicePulse, 0);
});

test("all attraction and service animation families are present in the renderer layer", () => {
  const models = read("../src/render/models.js");
  const renderer = read("../src/render/worldRenderer.js");
  for (const hook of [
    "animated-ride-boarding-gate", "animated-ride-passenger", "rimBulbs", "trainLights", "splashDrops", "ghosts",
    "definition.id === \"snacks\"", "definition.id === \"drinks\"",
    "animated-snack-tray", "animated-comfort-door", "animated-service-shutter", "deriveServiceMotion"
  ]) assert.match(models, new RegExp(hook));
  assert.doesNotMatch(models, /entity\.cycleRemaining\s*=/);
  assert.doesNotMatch(models, /entity\.queue\.(?:push|pop|splice|shift|unshift)\(/);
  assert.match(renderer, /visitor\.state !== "riding"/);
  assert.match(renderer, /visitor\.state === "usingService"/);
  assert.match(renderer, /activityEntity\.riders\.indexOf\(visitor\.id\)/);
});

test("all nine attraction and service models instantiate and animate through active and closed states", () => {
  const ids = [
    "carousel", "wheel", "coaster", "splash", "haunted", "spinner",
    "snacks", "drinks", "toilets"
  ];
  for (const catalogId of ids) {
    const entity = {
      id: `test-${catalogId}`, catalogId, open: true, condition: 100,
      evolutionLevel: 0, cycleRemaining: 3, queue: ["guest-a"], riders: ["rider-a"], cycles: 1
    };
    const before = structuredClone(entity);
    const model = createEntityModel(entity);
    model.userData.updateVisual(0, entity);
    model.userData.updateVisual(0.1, entity);
    const ridePassengers = [];
    model.traverse((child) => {
      if (child.name === "animated-ride-passenger") ridePassengers.push(child);
    });
    if (!["haunted", "snacks", "drinks", "toilets"].includes(catalogId)) {
      assert.equal(ridePassengers.filter((passenger) => passenger.visible).length, 1);
    }
    if (["snacks", "drinks", "toilets"].includes(catalogId)) {
      assert.ok(model.getObjectByName("animated-service-shutter"));
      assert.ok(model.getObjectByName("animated-service-sign"));
    }
    entity.open = false;
    entity.cycleRemaining = 0;
    entity.queue = [];
    model.userData.updateVisual(0.2, entity);
    assert.equal(ridePassengers.filter((passenger) => passenger.visible).length, 0);
    assert.ok(model.children.length > 0, `${catalogId} produced no visible model`);
    assert.deepEqual(before, { ...entity, open: true, cycleRemaining: 3, queue: ["guest-a"] });
  }
});
