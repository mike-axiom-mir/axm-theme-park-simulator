import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CATALOG, CAMPAIGN_LEVELS, catalogDefinition
} from "../src/core/catalog.js";
import {
  WATER_DISTRICT_CATALOG, WATER_DISTRICT_CONTENT_IDS, WATER_DISTRICT_RIDE_IDS
} from "../src/core/waterDistrictCatalog.js";
import {
  DISTRICT_THEME_IDS, applyDistrictAction, normalizeDistrictState
} from "../src/core/districts.js";
import {
  evaluateThemeFit, themeFitForPlacement, themeTagsForDefinition
} from "../src/core/themeFit.js";
import { applyAction, createNewGame } from "../src/core/simulation.js";
import {
  WATER_DISTRICT_VISUAL_FAMILIES, createWaterDistrictModel
} from "../src/render/waterDistrictModels.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("waterfront is a bounded district identity and remains style-only", () => {
  assert.ok(DISTRICT_THEME_IDS.includes("waterfront"));
  const state = normalizeDistrictState(createNewGame({ seed: "waterfront-style-only", mode: "sandbox" }));
  const before = {
    cash: state.economy.cash,
    rating: state.park.rating,
    visitors: state.visitors.length,
    paths: state.world.paths.length,
    entities: state.world.entities.length
  };
  const result = applyDistrictAction(state, {
    type: "setDistrictTheme", districtId: "north", themeId: "waterfront"
  });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.districts.themes.north, "waterfront");
  assert.deepEqual({
    cash: state.economy.cash,
    rating: state.park.rating,
    visitors: state.visitors.length,
    paths: state.world.paths.length,
    entities: state.world.entities.length
  }, before);
});

test("water district pack registers twelve original buildables with one progression home", () => {
  assert.equal(WATER_DISTRICT_CONTENT_IDS.length, 12);
  const unlocked = CAMPAIGN_LEVELS.flatMap((level) => level.unlocks);
  for (const id of WATER_DISTRICT_CONTENT_IDS) {
    assert.equal(CATALOG[id], WATER_DISTRICT_CATALOG[id], `${id} is not live in CATALOG`);
    assert.equal(unlocked.filter((candidate) => candidate === id).length, 1, `${id} should unlock once`);
    const definition = catalogDefinition(id);
    assert.ok(definition.label);
    assert.ok(definition.description);
    assert.ok(definition.cost >= 0);
    assert.ok(definition.footprint.every((value) => value > 0));
    assert.ok(definition.themeTags.includes("water"), `${id} should explicitly declare water fit`);
    assert.ok(WATER_DISTRICT_VISUAL_FAMILIES.includes(definition.visualFamily));
  }
});

test("new water attractions reuse the authoritative ride contract", () => {
  assert.equal(WATER_DISTRICT_RIDE_IDS.length, 4);
  for (const id of WATER_DISTRICT_RIDE_IDS) {
    const definition = catalogDefinition(id);
    assert.equal(definition.kind, "ride");
    assert.ok(definition.capacity > 0);
    assert.ok(definition.cycleMinutes > 0);
    assert.ok(definition.operatingCost >= 0);
    assert.ok(definition.firstValue > 0);
    assert.ok(definition.repeatValue > 0);
    assert.ok(definition.familyFit >= 0 && definition.familyFit <= 1);
    assert.ok(definition.thrillFit >= 0 && definition.thrillFit <= 1);
    assert.ok(definition.explorerFit >= 0 && definition.explorerFit <= 1);
  }
});

test("representative water content builds through existing money and placement authority", () => {
  for (const id of ["canalcruise", "harbourfizz", "watersidegazebo", "lilypond", "harbourlight"]) {
    const state = createNewGame({ seed: `water-build-${id}`, mode: "sandbox" });
    state.world.paths = [];
    state.world.entities = [];
    const before = state.economy.cash;
    const result = applyAction(state, { type: "build", catalogId: id, x: 1, z: 1, rotation: 0 });
    assert.equal(result.ok, true, `${id} failed normal build authority: ${result.reason ?? ""}`);
    assert.equal(state.economy.cash, before - catalogDefinition(id).cost);
    assert.ok(state.world.entities.some((entity) => entity.catalogId === id));
  }
});

test("theme fit is explainable, soft and placement-aware", () => {
  const canal = evaluateThemeFit(catalogDefinition("canalcruise"), "waterfront");
  assert.equal(canal.status, "signature");
  assert.ok(canal.matchedTags.includes("water"));
  assert.ok(canal.matchedTags.includes("scenic"));

  const garden = evaluateThemeFit(catalogDefinition("gardendrift"), "garden");
  assert.ok(["signature", "strong"].includes(garden.status));
  assert.ok(themeTagsForDefinition(catalogDefinition("bubblesub")).includes("water"));

  const deliberateContrast = evaluateThemeFit(catalogDefinition("coaster"), "garden");
  assert.equal(deliberateContrast.status, "compatible");
  assert.match(deliberateContrast.suggestion, /allowed|flexible|reinforces/i);

  const state = normalizeDistrictState(createNewGame({ seed: "water-placement-fit", mode: "sandbox" }));
  assert.equal(applyDistrictAction(state, {
    type: "setDistrictTheme", districtId: "north", themeId: "waterfront"
  }).ok, true);
  const beforeFit = structuredClone(state);
  const fit = themeFitForPlacement(state, "canalcruise", 8, 0, 0);
  assert.deepEqual(state, beforeFit, "fit evaluation must not mutate authoritative state");
  assert.equal(fit.districtId, "north");
  assert.equal(fit.themeId, "waterfront");
  assert.equal(fit.status, "signature");
});

test("every water content id receives a dedicated non-mutating low-poly model", () => {
  for (const id of WATER_DISTRICT_CONTENT_IDS) {
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
      riders: definition.kind === "ride" ? ["rider-a", "rider-b"] : [],
      cycleRemaining: definition.kind === "ride" ? 2 : 0,
      serviceRemaining: definition.kind === "service" ? 1 : 0,
      cycles: 0,
      revenue: 0,
      todayRevenue: 0,
      operatingSpend: 0,
      price: definition.ridePrice ?? definition.itemPrice ?? 0
    };
    const before = structuredClone(entity);
    const model = createWaterDistrictModel(entity);
    assert.equal(model.userData.specialAttractionId, id);
    assert.equal(model.userData.worldContentFamily, definition.visualFamily);
    assert.ok(model.children.length > 0, `${id} produced no visible model`);
    assert.equal(typeof model.userData.updateVisual, "function");
    model.userData.updateVisual(0, entity);
    model.userData.updateVisual(0.1, entity);
    assert.deepEqual(entity, before, `${id} renderer mutated authoritative entity evidence`);
    if (definition.kind === "ride") assert.ok(model.userData.rideAnchor, `${id} lacks a ride camera anchor`);
  }
});

test("theme-fit and water visuals stay layered outside preserved simulation", () => {
  const catalog = read("../src/core/catalog.js");
  const simulation = read("../src/core/simulation.js");
  const specialContent = read("../src/render/specialContentWorldRenderer.js");
  const fitRenderer = read("../src/render/waterfrontIdentityWorldRenderer.js");
  const finalStyle = read("../src/render/finalStyleWorldRenderer.js");
  const stateGuard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");

  assert.match(catalog, /WATER_DISTRICT_CATALOG/);
  assert.match(specialContent, /WATER_DISTRICT_CONTENT_IDS/);
  assert.match(specialContent, /createWaterDistrictModel/);
  assert.match(fitRenderer, /themeFitForPlacement/);
  assert.match(fitRenderer, /theme-fit-status/);
  assert.match(fitRenderer, /theme-fit-dressing-root/);
  assert.match(fitRenderer, /advisoryOnly: true/);
  assert.match(finalStyle, /medievalStyleWorldRenderer/);
  assert.match(stateGuard, /finalStyleWorldRenderer/);
  assert.doesNotMatch(simulation, /themeFit|waterfront|WATER_DISTRICT_CATALOG/);
});
