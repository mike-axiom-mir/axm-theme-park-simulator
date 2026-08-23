import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "../vendor/three.module.min.js";

import { GRID_SIZE } from "../src/core/catalog.js";
import {
  PARK_ANIMATED_PATH_TILE_BUDGET, PARK_DECOR_SCHEMA, PARK_NATURE_ACCENT_TILE_BUDGET,
  pathDecorDescriptor, stableVisualPhase
} from "../src/presentation/parkDecor.js";
import { createEntityModel, createPathModel } from "../src/render/models.js";
import {
  PARK_ATMOSPHERE_ACTOR_BUDGET, PARK_BUTTERFLY_BUDGET, PARK_FIREFLY_BUDGET,
  PARK_LEAF_BUDGET, ambientActorDescriptor, createParkAtmosphere
} from "../src/render/parkAtmosphere.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("path decoration routing is deterministic and bounded over the complete map", () => {
  let animated = 0;
  let nature = 0;
  for (let z = 0; z < GRID_SIZE; z += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const descriptor = pathDecorDescriptor(x, z, "path");
      assert.equal(descriptor.schema, PARK_DECOR_SCHEMA);
      assert.ok(Object.isFrozen(descriptor));
      assert.deepEqual(descriptor, pathDecorDescriptor(x, z, "path"));
      animated += Number(descriptor.animatedAccent);
      nature += Number(descriptor.natureAccent);
    }
  }
  assert.equal(animated, PARK_ANIMATED_PATH_TILE_BUDGET);
  assert.equal(nature, PARK_NATURE_ACCENT_TILE_BUDGET);
  assert.equal(stableVisualPhase("tree-12"), stableVisualPhase("tree-12"));
  assert.notEqual(stableVisualPhase("tree-12"), stableVisualPhase("tree-13"));
});

test("path and queue models expose their sparse animated park dressing", () => {
  const path = createPathModel("path", 0, 0);
  const queue = createPathModel("queue", 0, 0);
  assert.ok(path.getObjectByName("path-inset-stone"));
  assert.ok(path.getObjectByName("path-nature-accent"));
  assert.ok(path.getObjectByName("animated-path-flower"));
  assert.ok(queue.getObjectByName("path-inset-stone"));
  assert.ok(queue.getObjectByName("animated-queue-pennant"));
  assert.doesNotThrow(() => path.userData.updateVisual(1.25));
  assert.doesNotThrow(() => queue.userData.updateVisual(1.25));
  assert.equal(createPathModel("path", 1, 0).userData.updateVisual, undefined);
});

test("all four scenery families instantiate and animate without changing entities", () => {
  const expected = {
    tree: "animated-tree-canopy",
    lantern: "animated-lantern-moth",
    fountain: "animated-fountain-droplet",
    bench: "animated-bench-flower"
  };
  for (const [catalogId, childName] of Object.entries(expected)) {
    const entity = {
      id: `decor-${catalogId}`, catalogId, open: true, condition: 100,
      evolutionLevel: 0, queue: [], riders: [], cycleRemaining: 0
    };
    const before = structuredClone(entity);
    const model = createEntityModel(entity);
    model.userData.updateVisual(1, entity);
    model.userData.updateVisual(1.1, entity);
    assert.ok(model.getObjectByName(childName), `${catalogId} missed ${childName}`);
    assert.deepEqual(entity, before);
  }
});

test("bounded atmosphere follows time, weather, quality, and real park anchors", () => {
  assert.equal(PARK_BUTTERFLY_BUDGET, 12);
  assert.equal(PARK_FIREFLY_BUDGET, 16);
  assert.equal(PARK_LEAF_BUDGET, 12);
  assert.equal(PARK_ATMOSPHERE_ACTOR_BUDGET, 40);
  for (const index of [0, 1, 11, 27, 39]) {
    const descriptor = ambientActorDescriptor(index);
    assert.deepEqual(descriptor, ambientActorDescriptor(index));
    assert.ok(Object.isFrozen(descriptor));
  }

  const globe = {
    gridToLocal: (x, z) => ({ x: x * 2, z: z * 2 }),
    frameAtLocal: (x, z, y) => ({
      position: new THREE.Vector3(x, y, z), quaternion: new THREE.Quaternion()
    })
  };
  const effects = createParkAtmosphere(globe);
  const state = {
    clock: { minute: 10 * 60 },
    weather: { wind: 0.3, precipitation: 0 },
    world: { paths: [{ x: 1, z: 1 }], entities: [{ catalogId: "tree", x: 2, z: 2 }] }
  };
  const before = structuredClone(state);
  effects.update(1, state);
  assert.deepEqual(effects.status(), {
    atmosphereActorBudget: 40, activeButterflies: 8, activeFireflies: 0, activeLeaves: 8
  });
  state.clock.minute = 20 * 60;
  effects.update(2, state);
  assert.deepEqual(effects.status(), {
    atmosphereActorBudget: 40, activeButterflies: 0, activeFireflies: 10, activeLeaves: 8
  });
  effects.setQuality("crisp");
  state.clock.minute = 10 * 60;
  effects.update(3, state);
  assert.deepEqual(effects.status(), {
    atmosphereActorBudget: 40, activeButterflies: 12, activeFireflies: 0, activeLeaves: 12
  });
  assert.deepEqual(state, { ...before, clock: { minute: 10 * 60 } });
  assert.ok(Object.isFrozen(effects.status()));
});

test("atmosphere remains wired only to the renderer presentation loop", () => {
  const renderer = read("../src/render/worldRenderer.js");
  const atmosphere = read("../src/render/parkAtmosphere.js");
  assert.match(renderer, /createParkAtmosphere\(this\.globe\)/);
  assert.match(renderer, /this\.parkAtmosphere\.update\(time, this\.state\)/);
  assert.match(renderer, /model\.userData\.updateVisual\?\.\(time\)/);
  assert.doesNotMatch(atmosphere, /advanceOneMinute|applyAction|nextRandom/);
  assert.doesNotMatch(atmosphere, /state\.[A-Za-z0-9_.]+\s*=/);
});
