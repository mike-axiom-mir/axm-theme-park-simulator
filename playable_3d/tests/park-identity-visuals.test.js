import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNewGame } from "../src/core/simulation.js";
import {
  DISTRICT_IDS, DISTRICT_SCHEMA, DISTRICT_THEME_IDS,
  applyDistrictAction, districtForCell, districtThemeForEntity, normalizeDistrictState
} from "../src/core/districts.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function districtState(seed = "district-proof") {
  return normalizeDistrictState(createNewGame({ seed, mode: "sandbox" }));
}

test("district normalizer adds four neutral style districts without gameplay effects", () => {
  const state = createNewGame({ seed: "district-defaults", mode: "sandbox" });
  const cash = state.economy.cash;
  const rating = state.park.rating;
  normalizeDistrictState(state);
  assert.equal(state.districts.schema, DISTRICT_SCHEMA);
  assert.deepEqual(Object.keys(state.districts.themes).sort(), [...DISTRICT_IDS].sort());
  assert.ok(Object.values(state.districts.themes).every((theme) => theme === "neutral"));
  assert.equal(state.economy.cash, cash);
  assert.equal(state.park.rating, rating);
});

test("starter district geometry deterministically partitions the park into cardinal wedges", () => {
  assert.equal(districtForCell(15, 0, 32), "north");
  assert.equal(districtForCell(31, 15, 32), "east");
  assert.equal(districtForCell(15, 31, 32), "south");
  assert.equal(districtForCell(0, 15, 32), "west");
  assert.equal(districtForCell(16, 16, 32), "south");
});

test("player style cycling changes only district presentation state", () => {
  const state = districtState("district-cycle");
  const entity = state.world.entities[0];
  const identityBefore = districtThemeForEntity(state, entity);
  const cash = state.economy.cash;
  const rating = state.park.rating;
  const visitors = state.visitors.length;
  const result = applyDistrictAction(state, { type: "cycleDistrictTheme", entityId: entity.id });
  assert.equal(result.ok, true, result.reason);
  const identityAfter = districtThemeForEntity(state, entity);
  assert.equal(identityAfter.districtId, identityBefore.districtId);
  assert.equal(identityAfter.themeId, "garden");
  assert.equal(state.economy.cash, cash);
  assert.equal(state.park.rating, rating);
  assert.equal(state.visitors.length, visitors);
  assert.equal(state.eventLog.at(-1).type, "district.theme.changed");
});

test("explicit district themes remain bounded to the declared theme vocabulary", () => {
  const state = districtState("district-theme-bounds");
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "east", themeId: "future" }).ok, true);
  assert.equal(state.districts.themes.east, "future");
  const rejected = applyDistrictAction(state, { type: "setDistrictTheme", districtId: "east", themeId: "mega-corporate-skin" });
  assert.equal(rejected.ok, false);
  assert.ok(DISTRICT_THEME_IDS.includes(state.districts.themes.east));
});

test("district style persists through current saves and legacy saves default cleanly", () => {
  const state = districtState("district-save");
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "west", themeId: "storybook" }).ok, true);
  const restored = deserializeGame(serializeGame(state));
  assert.equal(restored.districts.themes.west, "storybook");

  const legacy = createNewGame({ seed: "district-legacy", mode: "sandbox" });
  delete legacy.districts;
  const migrated = deserializeGame(serializeGame(legacy));
  assert.equal(migrated.districts.schema, DISTRICT_SCHEMA);
  assert.ok(Object.values(migrated.districts.themes).every((theme) => theme === "neutral"));
});

test("visible upgrade and district presentation stays layered outside preserved simulation", () => {
  const compatibilitySeam = read("../src/render/contentStudioWorldRenderer.js");
  const stateGuard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");
  const contentBase = read("../src/render/specialContentWorldRenderer.js");
  const renderer = read("../src/render/parkIdentityWorldRenderer.js");
  const save = read("../src/core/save.js");
  const simulation = read("../src/core/simulation.js");

  assert.match(compatibilitySeam, /stateSafeParkIdentityWorldRenderer/);
  assert.match(stateGuard, /normalizeDistrictState/);
  assert.match(stateGuard, /stateHash/);
  assert.match(contentBase, /SPECIAL_ATTRACTION_FACTORIES/);
  assert.match(renderer, /specialContentWorldRenderer/);
  assert.match(renderer, /applyDistrictAction/);
  assert.match(renderer, /installedUpgradeVisualRoot/);
  assert.match(renderer, /installed-park-infrastructure-visuals/);
  assert.match(renderer, /KeyY/);
  assert.match(save, /normalizeDistrictState/);
  assert.doesNotMatch(simulation, /districts\.js|district\.theme\.changed|installed-park-infrastructure-visuals/);
});
