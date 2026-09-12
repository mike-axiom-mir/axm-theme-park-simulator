import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CATALOG, catalogDefinition } from "../src/core/catalog.js";
import { applyAction, createNewGame } from "../src/core/simulation.js";
import {
  COASTER_DECORATIONS, COASTER_DESIGN_SCHEMA, COASTER_STUDIO_LIMITS,
  addCoasterDecoration, addTrackNode, coasterDesignMetrics, createCoasterDesign,
  deserializeCoasterDesign, removeCoasterDecoration, removeTrackNode,
  serializeCoasterDesign, setCoasterStyle, updateCoasterDecoration, updateTrackNode,
  validateCoasterDesign
} from "../src/core/coasterStudio.js";
import { createGalleonModel } from "../src/render/extraAttractions.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Moonwake Galleon is a real level-two ride with normal economy metadata", () => {
  const definition = catalogDefinition("galleon");
  assert.equal(definition.kind, "ride");
  assert.equal(definition.label, "Moonwake Galleon");
  assert.equal(definition.cost, 4300);
  assert.equal(definition.capacity, 12);
  assert.deepEqual(definition.footprint, [5, 3]);
  assert.ok(definition.intensity > 0.65);
  assert.ok(CATALOG.galleon);
});

test("Moonwake Galleon builds through the existing authoritative park action", () => {
  const state = createNewGame({ seed: "moonwake-build", mode: "sandbox" });
  const before = state.economy.cash;
  const result = applyAction(state, { type: "build", catalogId: "galleon", x: 1, z: 1, rotation: 0 });
  assert.equal(result.ok, true);
  assert.equal(state.economy.cash, before - 4300);
  const galleon = state.world.entities.find((entity) => entity.catalogId === "galleon");
  assert.ok(galleon);
  assert.equal(galleon.kind, "ride");
  assert.equal(galleon.condition, 100);
});

test("dedicated Galleon model animates from ride evidence without mutating it", () => {
  const entity = {
    id: "galleon-test", catalogId: "galleon", open: true,
    condition: 100, evolutionLevel: 0, queue: [], riders: ["guest-a", "guest-b"],
    cycleRemaining: 4, cycles: 0, revenue: 0, operatingSpend: 0, price: 3
  };
  const before = structuredClone(entity);
  const model = createGalleonModel(entity);
  assert.equal(model.userData.specialAttractionId, "galleon");
  assert.ok(model.userData.rideAnchor);
  const warning = model.getObjectByName("galleon-condition-warning");
  const evolution = model.getObjectByName("galleon-evolution-dressing");
  assert.ok(warning);
  assert.ok(evolution);
  assert.equal(warning.visible, false);

  model.userData.updateVisual(0, entity);
  model.userData.updateVisual(0.1, entity);
  const passengers = [];
  model.traverse((child) => { if (child.name === "animated-ride-passenger") passengers.push(child); });
  assert.equal(passengers.length, 12);
  assert.equal(passengers.filter((passenger) => passenger.visible).length, 2);
  assert.deepEqual(entity, before);

  entity.open = false;
  entity.condition = 20;
  entity.evolutionLevel = 3;
  entity.cycleRemaining = 0;
  entity.riders = [];
  model.userData.updateVisual(0.2, entity);
  assert.equal(passengers.filter((passenger) => passenger.visible).length, 0);
  assert.equal(warning.visible, true);
  assert.ok(evolution.children.length >= 10, "level-three Galleon should expose visible evolution dressing");
});

test("default Coaster Studio draft is a valid closed portable design", () => {
  const design = createCoasterDesign({ name: "Test Circuit", seed: "coaster-test" });
  const check = validateCoasterDesign(design);
  assert.equal(design.schema, COASTER_DESIGN_SCHEMA);
  assert.equal(design.closed, true);
  assert.equal(check.ok, true);
  assert.ok(check.metrics.trackLength > 18);
  assert.ok(check.metrics.maxHeight > 10);
  assert.equal(check.metrics.decorationCount, 0);
});

test("track nodes can be inserted, reshaped, banked and removed within hard limits", () => {
  const original = createCoasterDesign({ seed: "track-edit" });
  const before = structuredClone(original);
  const afterAdd = addTrackNode(original, { x: 10, z: 11, height: 99, bank: -99 }, original.nodes[1].id);
  assert.equal(afterAdd.nodes.length, original.nodes.length + 1);
  assert.equal(afterAdd.nodes[2].height, COASTER_STUDIO_LIMITS.maxHeight);
  assert.equal(afterAdd.nodes[2].bank, -COASTER_STUDIO_LIMITS.maxBank);
  assert.deepEqual(original, before, "editor operations must not mutate the prior draft");

  const reshaped = updateTrackNode(afterAdd, afterAdd.nodes[2].id, { x: -5, z: 200, height: 8.5, bank: 22 });
  assert.equal(reshaped.nodes[2].x, 0);
  assert.equal(reshaped.nodes[2].z, COASTER_STUDIO_LIMITS.gridSize);
  assert.equal(reshaped.nodes[2].height, 8.5);
  assert.equal(reshaped.nodes[2].bank, 22);

  let reduced = reshaped;
  while (reduced.nodes.length > COASTER_STUDIO_LIMITS.minNodes) reduced = removeTrackNode(reduced, reduced.nodes.at(-1).id);
  const held = removeTrackNode(reduced, reduced.nodes.at(-1).id);
  assert.equal(held.nodes.length, COASTER_STUDIO_LIMITS.minNodes);
});

test("coaster styling and decoration placement are portable but physics-neutral design data", () => {
  let design = createCoasterDesign({ seed: "styled-coaster" });
  design = setCoasterStyle(design, {
    name: "Garden Comet",
    trackColor: "#112233",
    supportColor: "#445566",
    trainColor: "#778899",
    accentColor: "#aabbcc"
  });
  assert.equal(design.name, "Garden Comet");
  assert.equal(design.style.trackColor, "#112233");

  for (const type of Object.keys(COASTER_DECORATIONS)) {
    design = addCoasterDecoration(design, type, { x: 3, z: 4, rotation: 370, scale: 1.4 });
  }
  assert.equal(design.decorations.length, Object.keys(COASTER_DECORATIONS).length);
  const first = design.decorations[0];
  assert.equal(first.rotation, 10);
  const edited = updateCoasterDecoration(design, first.id, { rotation: 90, scale: 2.8 });
  assert.equal(edited.decorations[0].rotation, 90);
  assert.equal(edited.decorations[0].scale, 2);
  const removed = removeCoasterDecoration(edited, first.id);
  assert.equal(removed.decorations.length, design.decorations.length - 1);
});

test("decoration and track budgets stay hard under editor abuse", () => {
  let design = createCoasterDesign({ seed: "editor-budgets" });
  for (let index = 0; index < 100; index += 1) {
    design = addCoasterDecoration(design, "tree", { x: index % 24, z: index % 19 });
  }
  assert.equal(design.decorations.length, COASTER_STUDIO_LIMITS.maxDecorations);

  for (let index = 0; index < 100; index += 1) {
    design = addTrackNode(design, { x: index % 24, z: (index * 3) % 24, height: index % 18 });
  }
  assert.equal(design.nodes.length, COASTER_STUDIO_LIMITS.maxNodes);
});

test("coaster metrics are deterministic and never rewrite the design", () => {
  const design = createCoasterDesign({ seed: "metric-proof" });
  const before = structuredClone(design);
  const first = coasterDesignMetrics(design);
  const second = coasterDesignMetrics(design);
  assert.deepEqual(first, second);
  assert.deepEqual(design, before);
  assert.ok(first.intensityEstimate >= 0.18 && first.intensityEstimate <= 1);
});

test("Coaster Studio export/import round-trips track, colors and decorations", () => {
  let design = createCoasterDesign({ name: "Portable Garden", seed: "portable" });
  design = addCoasterDecoration(design, "arch", { x: 10, z: 8, rotation: 45, scale: 1.2 });
  design = addCoasterDecoration(design, "flowers", { x: 12, z: 10 });
  design = setCoasterStyle(design, { trackColor: "#123456", trainColor: "#fedcba" });
  const text = serializeCoasterDesign(design);
  const restored = deserializeCoasterDesign(text);
  assert.deepEqual(restored, design);
  assert.throws(() => deserializeCoasterDesign(JSON.stringify({ schema: "wrong", version: 1, design })), /Not an AXM Coaster Studio/);
});

test("playable source wires Coaster Studio and the dedicated attraction model without faking placement bridge", () => {
  const main = read("../src/main.js");
  const renderer = read("../src/render/specialContentWorldRenderer.js");
  const studio = read("../src/ui/coasterStudioUI.js");
  assert.match(main, /CoasterStudioUI/);
  assert.match(main, /coaster-studio-button/);
  assert.match(main, /function toolDialogOpen\(\)[\s\S]*coasterStudio\.dialog\.open/);
  assert.match(main, /speed > 0 && !toolDialogOpen\(\)/);
  assert.match(main, /coasterStudio\.dialog\.addEventListener\("keydown"/);
  assert.match(renderer, /SPECIAL_ATTRACTION_FACTORIES/);
  assert.match(renderer, /galleon: createGalleonModel/);
  assert.match(studio, /Track nodes/);
  assert.match(studio, /Decorate/);
  assert.match(studio, /data-node-height/);
  assert.match(studio, /data-node-bank/);
  assert.match(studio, /data-decor-type/);
  assert.match(studio, /serializeCoasterDesign/);
  assert.doesNotMatch(studio, /applyAction|economy\.cash|world\.entities\.push/);
});
