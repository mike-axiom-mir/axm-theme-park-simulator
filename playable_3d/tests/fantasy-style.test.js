import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { catalogDefinition } from "../src/core/catalog.js";
import { createNewGame } from "../src/core/simulation.js";
import {
  DISTRICT_THEME_IDS, DISTRICT_THEMES, applyDistrictAction, normalizeDistrictState
} from "../src/core/districts.js";
import { evaluateThemeFit, themeTagsForDefinition } from "../src/core/themeFit.js";
import { styleSuperpowerForDistrict } from "../src/core/styleSuperpowers.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function entity(id, catalogId, x, z) {
  return { id, catalogId, x, z, rotation: 0 };
}

test("Fantasy remains a first-class district identity after Cartoon", () => {
  assert.ok(DISTRICT_THEME_IDS.includes("fantasy"));
  assert.equal(DISTRICT_THEME_IDS[DISTRICT_THEME_IDS.indexOf("cartoon") + 1], "fantasy");
  assert.equal(DISTRICT_THEME_IDS[DISTRICT_THEME_IDS.indexOf("fantasy") + 1], "western");
  assert.equal(DISTRICT_THEMES.fantasy.label, "Fantasy");
  assert.deepEqual(DISTRICT_THEMES.fantasy.signatureTags, ["fantasy"]);
  assert.ok(DISTRICT_THEMES.fantasy.preferredTags.includes("scenic"));
  assert.ok(DISTRICT_THEMES.fantasy.preferredTags.includes("storybook"));
});

test("Fantasy tags derive from existing story/place evidence instead of a parallel catalog", () => {
  const labyrinthTags = themeTagsForDefinition(catalogDefinition("lanternmaze"));
  const canalTags = themeTagsForDefinition(catalogDefinition("canalcruise"));
  const cascadeTags = themeTagsForDefinition(catalogDefinition("cascadegarden"));
  const bumpersTags = themeTagsForDefinition(catalogDefinition("bumpers"));
  assert.ok(labyrinthTags.includes("fantasy"));
  assert.ok(canalTags.includes("fantasy"));
  assert.ok(cascadeTags.includes("fantasy"));
  assert.equal(bumpersTags.includes("fantasy"), false);
  assert.equal(evaluateThemeFit(catalogDefinition("lanternmaze"), "fantasy").status, "signature");
  assert.equal(evaluateThemeFit(catalogDefinition("canalcruise"), "fantasy").status, "signature");
});

test("Fantasy style changes presentation state only and persists through current saves", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "fantasy-save", mode: "sandbox" }));
  const cash = state.economy.cash;
  const rating = state.park.rating;
  const visitorCount = state.visitors.length;
  const result = applyDistrictAction(state, { type: "setDistrictTheme", districtId: "west", themeId: "fantasy" });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.districts.themes.west, "fantasy");
  assert.equal(state.economy.cash, cash);
  assert.equal(state.park.rating, rating);
  assert.equal(state.visitors.length, visitorCount);
  const restored = deserializeGame(serializeGame(state));
  assert.equal(restored.districts.themes.west, "fantasy");
});

test("two Fantasy signature anchors unleash Aetherveil", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "fantasy-power", mode: "sandbox" }));
  state.world.entities = [
    entity("fantasy-labyrinth", "lanternmaze", 13, 1),
    entity("fantasy-canal", "canalcruise", 16, 2)
  ];
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "north", themeId: "fantasy" }).ok, true);
  const power = styleSuperpowerForDistrict(state, "north");
  assert.equal(power.id, "aetherveil");
  assert.equal(power.visualMode, "arcana");
  assert.equal(power.stage, "unleashed");
  assert.equal(power.score, 6);
  assert.ok(power.topTags.includes("fantasy"));
});

test("Fantasy rendering stays additive, bounded and outside preserved simulation", () => {
  const fantasyRenderer = read("../src/render/fantasyStyleWorldRenderer.js");
  const westernRenderer = read("../src/render/westernStyleWorldRenderer.js");
  const finalStyle = read("../src/render/finalStyleWorldRenderer.js");
  const stateGuard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");
  const simulation = read("../src/core/simulation.js");
  assert.match(fantasyRenderer, /FANTASY_ROOT_LIMIT = 4/);
  assert.match(fantasyRenderer, /CartoonStyleWorldRenderer/);
  assert.match(fantasyRenderer, /fantasy-style-dressing-root/);
  assert.match(fantasyRenderer, /fantasy-aetherveil/);
  assert.match(fantasyRenderer, /bounded-render-only-fantasy-style/);
  assert.match(fantasyRenderer, /magicBoost/);
  assert.match(fantasyRenderer, /setQuality/);
  assert.match(westernRenderer, /FantasyStyleWorldRenderer/);
  assert.match(finalStyle, /gildedStyleWorldRenderer/);
  assert.match(stateGuard, /finalStyleWorldRenderer/);
  assert.doesNotMatch(simulation, /aetherveil|fantasyStyleWorldRenderer|fantasy-style-dressing-root/);
});
