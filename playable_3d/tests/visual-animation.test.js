import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three.module.min.js";

import { openingCameraPose, OPENING_CAMERA_FLIGHT_SCHEMA } from "../src/presentation/cameraFlight.js";
import {
  WEATHER_CLOUD_BUDGET, WEATHER_RAIN_BUDGET, WEATHER_TOTAL_ACTOR_BUDGET,
  weatherActorDescriptor
} from "../src/render/weatherEffects.js";
import { LivingGlobeAdapter } from "../src/world/livingGlobeAdapter.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("opening camera flight begins wide and settles exactly on the management camera", () => {
  const target = { x: 4, z: -3, yaw: -0.72, pitch: 0.64, distance: 46 };
  const before = structuredClone(target);
  const start = openingCameraPose(0, target);
  const middle = openingCameraPose(0.5, target);
  const end = openingCameraPose(1, target);
  assert.equal(start.schema, OPENING_CAMERA_FLIGHT_SCHEMA);
  assert.equal(start.distance, 158);
  assert.ok(middle.distance < start.distance);
  assert.deepEqual({ x: end.x, z: end.z, yaw: end.yaw, pitch: end.pitch, distance: end.distance }, target);
  assert.equal(start.gateProgress, 0);
  assert.equal(end.gateProgress, 1);
  assert.deepEqual(target, before, "presentation pose derivation must not mutate its input");
});

test("weather actors have deterministic layouts and a hard visual budget", () => {
  assert.equal(WEATHER_RAIN_BUDGET, 64);
  assert.equal(WEATHER_CLOUD_BUDGET, 8);
  assert.equal(WEATHER_TOTAL_ACTOR_BUDGET, 72);
  for (const index of [0, 1, 7, 31, 71]) {
    const first = weatherActorDescriptor(index);
    assert.deepEqual(first, weatherActorDescriptor(index));
    assert.ok(first.x >= 0 && first.x < 1);
    assert.ok(first.z >= 0 && first.z < 1);
    assert.ok(first.phase >= 0 && first.phase < 1);
    assert.ok(Object.isFrozen(first));
  }
});

test("day-night rendering initializes a fresh scene background", () => {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x7194b5, 75, 245);
  const globe = new LivingGlobeAdapter(scene, { seed: "fresh-scene-background" });
  assert.equal(scene.background, null);
  assert.doesNotThrow(() => globe.updateDayNight(9 * 60 + 17, { type: "bright" }));
  assert.ok(scene.background instanceof THREE.Color);
  assert.ok(scene.fog.color instanceof THREE.Color);
});

test("animated visual systems remain attached to the renderer instead of simulation authority", () => {
  const renderer = read("../src/render/worldRenderer.js");
  const main = read("../src/main.js");
  assert.match(renderer, /startOpeningCamera\(signal\)/);
  assert.match(renderer, /weatherEffects\.update\(time, this\.state\.weather\)/);
  assert.match(renderer, /updateWorkVisual/);
  assert.match(renderer, /retiringAt/);
  assert.match(renderer, /openingCamera\.reducedMotion\) return 1/);
  assert.doesNotMatch(renderer, /advanceOneMinute|applyAction/);
  assert.match(main, /finally\s*\{\s*world\.finishOpeningCamera\(\)/);
});
