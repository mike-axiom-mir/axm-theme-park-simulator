import test from "node:test";
import assert from "node:assert/strict";

import {
  BUILD_CATEGORIES, CATALOG, CAMPAIGN_LEVELS, catalogDefinition
} from "../src/core/catalog.js";
import {
  WORLD_CONTENT_CATALOG, WORLD_CONTENT_IDS
} from "../src/core/worldContentCatalog.js";
import { createNewGame, applyAction } from "../src/core/simulation.js";
import { createWorldContentModel } from "../src/render/worldContentModels.js";

test("world research content registers a broad casual park vocabulary", () => {
  assert.ok(WORLD_CONTENT_IDS.length >= 30, `expected broad content pack, got ${WORLD_CONTENT_IDS.length}`);
  assert.ok(BUILD_CATEGORIES.includes("Attractions"));
  assert.ok(BUILD_CATEGORIES.includes("Stores"));

  for (const id of WORLD_CONTENT_IDS) {
    assert.equal(CATALOG[id], WORLD_CONTENT_CATALOG[id], `${id} is not registered in live catalog`);
    const definition = catalogDefinition(id);
    assert.ok(definition.label);
    assert.ok(definition.description);
    assert.ok(Array.isArray(definition.footprint));
    assert.ok(definition.cost >= 0);
    assert.ok(definition.visualFamily);
  }
});

test("every researched content item has one campaign progression home", () => {
  const unlocked = CAMPAIGN_LEVELS.flatMap((level) => level.unlocks);
  for (const id of WORLD_CONTENT_IDS) {
    assert.equal(unlocked.filter((candidate) => candidate === id).length, 1, `${id} should unlock exactly once`);
  }
});

test("world-inspired rides use the existing authoritative ride contract", () => {
  const rides = WORLD_CONTENT_IDS.map((id) => catalogDefinition(id)).filter((definition) => definition.kind === "ride");
  assert.ok(rides.length >= 15);
  for (const definition of rides) {
    assert.ok(definition.capacity > 0, `${definition.id} missing capacity`);
    assert.ok(definition.cycleMinutes > 0, `${definition.id} missing cycle`);
    assert.ok(definition.operatingCost >= 0, `${definition.id} missing operating cost`);
    assert.ok(definition.firstValue > 0 && definition.repeatValue > 0);
    assert.ok(definition.familyFit >= 0 && definition.familyFit <= 1);
    assert.ok(definition.thrillFit >= 0 && definition.thrillFit <= 1);
    assert.ok(definition.explorerFit >= 0 && definition.explorerFit <= 1);
  }
});

test("need-driven additions plug into current guest service behavior without inventing a second need engine", () => {
  assert.equal(catalogDefinition("refill").need, "thirst");
  assert.equal(catalogDefinition("quietcove").need, "rest");
  for (const id of ["sugarcloud", "swirlcart", "popcornplanet"]) {
    const definition = catalogDefinition(id);
    assert.equal(definition.kind, "service");
    assert.equal(definition.need, "hunger");
  }
});

test("retail and support facilities remain honest passive park content until visitor shopping/use logic exists", () => {
  for (const id of ["memorymarket", "toytinker", "parkthreads", "snapshotshop", "nameit"]) {
    const definition = catalogDefinition(id);
    assert.equal(definition.category, "Stores");
    assert.equal(definition.kind, "scenery");
    assert.equal(definition.influence, "retail");
    assert.equal(definition.retailNeed, "shopping");
  }
  for (const id of ["firstaid", "familynest", "stash", "hellohub", "wagonwheels", "chargegrove"]) {
    const definition = catalogDefinition(id);
    assert.equal(definition.category, "Services");
    assert.equal(definition.kind, "scenery");
  }
});

test("representative new content builds through existing money and placement authority", () => {
  for (const id of ["twirlcups", "bumpers", "lanternmaze", "refill", "memorymarket"]) {
    const state = createNewGame({ seed: `world-content-${id}`, mode: "sandbox" });
    state.world.paths = [];
    state.world.entities = [];
    const before = state.economy.cash;
    const result = applyAction(state, { type: "build", catalogId: id, x: 1, z: 1, rotation: 0 });
    assert.equal(result.ok, true, `${id} failed normal build action: ${result.reason ?? ""}`);
    assert.equal(state.economy.cash, before - catalogDefinition(id).cost);
    assert.ok(state.world.entities.some((entity) => entity.catalogId === id));
  }
});

test("every world-content id receives a dedicated visible model family", () => {
  for (const id of WORLD_CONTENT_IDS) {
    const definition = catalogDefinition(id);
    const entity = {
      id: `test-${id}`,
      catalogId: id,
      kind: definition.kind,
      open: true,
      condition: 100,
      evolutionLevel: 0,
      queue: [],
      queueCapacity: definition.capacity ?? 0,
      riders: definition.kind === "ride" ? ["rider-a"] : [],
      cycleRemaining: definition.kind === "ride" || definition.kind === "service" ? 2 : 0,
      cycles: 0,
      revenue: 0,
      todayRevenue: 0,
      operatingSpend: 0,
      price: definition.ridePrice ?? definition.itemPrice ?? 0
    };
    const before = structuredClone(entity);
    const model = createWorldContentModel(entity);
    assert.equal(model.userData.specialAttractionId, id);
    assert.equal(model.userData.worldContentFamily, definition.visualFamily);
    assert.ok(model.children.length > 0, `${id} produced no visible model root`);
    assert.equal(typeof model.userData.updateVisual, "function");
    model.userData.updateVisual(0, entity);
    model.userData.updateVisual(0.1, entity);
    assert.deepEqual(entity, before, `${id} renderer mutated authoritative entity evidence`);
    if (definition.kind === "ride") assert.ok(model.userData.rideAnchor, `${id} ride lacks ride camera anchor`);
  }
});
