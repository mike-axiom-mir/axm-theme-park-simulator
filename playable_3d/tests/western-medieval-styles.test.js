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

test("Western and Medieval remain first-class styles immediately after Fantasy", () => {
  const fantasyIndex = DISTRICT_THEME_IDS.indexOf("fantasy");
  const westernIndex = DISTRICT_THEME_IDS.indexOf("western");
  const medievalIndex = DISTRICT_THEME_IDS.indexOf("medieval");
  assert.equal(westernIndex, fantasyIndex + 1);
  assert.equal(medievalIndex, westernIndex + 1);
  assert.equal(DISTRICT_THEMES.western.label, "Western");
  assert.equal(DISTRICT_THEMES.medieval.label, "Medieval");
  assert.deepEqual(DISTRICT_THEMES.western.signatureTags, ["western"]);
  assert.deepEqual(DISTRICT_THEMES.medieval.signatureTags, ["medieval"]);
});

test("Western derives from rail and grounded river-adventure evidence", () => {
  const railwayTags = themeTagsForDefinition(catalogDefinition("littleloop"));
  const flumeTags = themeTagsForDefinition(catalogDefinition("logdash"));
  const bumpersTags = themeTagsForDefinition(catalogDefinition("bumpers"));
  assert.ok(railwayTags.includes("western"));
  assert.ok(flumeTags.includes("western"));
  assert.equal(bumpersTags.includes("western"), false);
  assert.equal(evaluateThemeFit(catalogDefinition("littleloop"), "western").status, "signature");
  assert.equal(evaluateThemeFit(catalogDefinition("logdash"), "western").status, "signature");
});

test("Medieval derives from combined story with indoor or adventure evidence", () => {
  const labyrinthTags = themeTagsForDefinition(catalogDefinition("lanternmaze"));
  const canalTags = themeTagsForDefinition(catalogDefinition("canalcruise"));
  const bumpersTags = themeTagsForDefinition(catalogDefinition("bumpers"));
  assert.ok(labyrinthTags.includes("medieval"));
  assert.ok(canalTags.includes("medieval"));
  assert.equal(bumpersTags.includes("medieval"), false);
  assert.equal(evaluateThemeFit(catalogDefinition("lanternmaze"), "medieval").status, "signature");
  assert.equal(evaluateThemeFit(catalogDefinition("canalcruise"), "medieval").status, "signature");
});

test("Western and Medieval style changes remain presentation-only and persist", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "historical-style-save", mode: "sandbox" }));
  const cash = state.economy.cash;
  const rating = state.park.rating;
  const visitors = state.visitors.length;
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "east", themeId: "western" }).ok, true);
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "west", themeId: "medieval" }).ok, true);
  assert.equal(state.economy.cash, cash);
  assert.equal(state.park.rating, rating);
  assert.equal(state.visitors.length, visitors);
  const restored = deserializeGame(serializeGame(state));
  assert.equal(restored.districts.themes.east, "western");
  assert.equal(restored.districts.themes.west, "medieval");
});

test("two Western signatures unleash Frontier Rush", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "western-power", mode: "sandbox" }));
  state.world.entities = [
    entity("western-rail", "littleloop", 13, 1),
    entity("western-flume", "logdash", 16, 2)
  ];
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "north", themeId: "western" }).ok, true);
  const power = styleSuperpowerForDistrict(state, "north");
  assert.equal(power.id, "frontier-rush");
  assert.equal(power.visualMode, "frontier");
  assert.equal(power.stage, "unleashed");
  assert.equal(power.score, 6);
  assert.ok(power.topTags.includes("western"));
});

test("two Medieval signatures unleash Bannerwake", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "medieval-power", mode: "sandbox" }));
  state.world.entities = [
    entity("medieval-labyrinth", "lanternmaze", 13, 1),
    entity("medieval-canal", "canalcruise", 16, 2)
  ];
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "north", themeId: "medieval" }).ok, true);
  const power = styleSuperpowerForDistrict(state, "north");
  assert.equal(power.id, "bannerwake");
  assert.equal(power.visualMode, "keep");
  assert.equal(power.stage, "unleashed");
  assert.equal(power.score, 6);
  assert.ok(power.topTags.includes("medieval"));
});

test("historical renderers remain correctly chained beneath later themed lands", () => {
  const western = read("../src/render/westernStyleWorldRenderer.js");
  const medieval = read("../src/render/medievalStyleWorldRenderer.js");
  const seasonal = read("../src/render/festivalTechStyleWorldRenderer.js");
  const motionGuard = read("../src/render/festivalTechMotionGuardWorldRenderer.js");
  const gilded = read("../src/render/gildedStyleWorldRenderer.js");
  const finalStyle = read("../src/render/finalStyleWorldRenderer.js");
  const legacyStyle = read("../src/render/legacyStyleUpgradeWorldRenderer.js");
  const guard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");
  const simulation = read("../src/core/simulation.js");
  assert.match(western, /WESTERN_ROOT_LIMIT = 4/);
  assert.match(western, /FantasyStyleWorldRenderer/);
  assert.match(western, /bounded-render-only-western-style/);
  assert.match(western, /western-frontier-rush/);
  assert.match(medieval, /MEDIEVAL_ROOT_LIMIT = 4/);
  assert.match(medieval, /WesternStyleWorldRenderer/);
  assert.match(medieval, /bounded-render-only-medieval-style/);
  assert.match(medieval, /medieval-bannerwake/);
  assert.match(seasonal, /MedievalStyleWorldRenderer/);
  assert.match(motionGuard, /FestivalTechStyleWorldRenderer/);
  assert.match(gilded, /FestivalTechMotionGuardWorldRenderer/);
  assert.match(finalStyle, /legacyStyleUpgradeWorldRenderer/);
  assert.match(legacyStyle, /gildedStyleWorldRenderer/);
  assert.match(guard, /FinalStyleWorldRenderer/);
  assert.doesNotMatch(simulation, /frontier-rush|bannerwake|westernStyleWorldRenderer|medievalStyleWorldRenderer|gildedStyleWorldRenderer/);
});
