import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { catalogDefinition } from "../src/core/catalog.js";
import { createNewGame } from "../src/core/simulation.js";
import {
  DISTRICT_THEME_IDS, DISTRICT_THEMES, applyDistrictAction, normalizeDistrictState
} from "../src/core/districts.js";
import { evaluateThemeFit } from "../src/core/themeFit.js";
import { styleSuperpowerForDistrict } from "../src/core/styleSuperpowers.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function entity(id, catalogId, x, z) {
  return { id, catalogId, x, z, rotation: 0 };
}

test("Cartoon remains a first-class district identity after Storybook", () => {
  assert.ok(DISTRICT_THEME_IDS.includes("cartoon"));
  assert.equal(DISTRICT_THEME_IDS[DISTRICT_THEME_IDS.indexOf("storybook") + 1], "cartoon");
  assert.equal(DISTRICT_THEME_IDS[DISTRICT_THEME_IDS.indexOf("cartoon") + 1], "fantasy");
  assert.equal(DISTRICT_THEMES.cartoon.label, "Cartoon");
  assert.ok(DISTRICT_THEMES.cartoon.preferredTags.includes("family"));
  assert.ok(DISTRICT_THEMES.cartoon.preferredTags.includes("thrill"));
});

test("existing playful attractions naturally fit Cartoon without a parallel catalog", () => {
  const bumpers = evaluateThemeFit(catalogDefinition("bumpers"), "cartoon");
  const cloudHop = evaluateThemeFit(catalogDefinition("cloudhop"), "cartoon");
  const cups = evaluateThemeFit(catalogDefinition("twirlcups"), "cartoon");
  assert.equal(bumpers.status, "signature");
  assert.equal(cloudHop.status, "signature");
  assert.equal(cups.status, "signature");
  assert.ok(bumpers.matchedTags.includes("family"));
  assert.ok(cloudHop.matchedTags.includes("thrill"));
});

test("Cartoon style changes presentation state only and persists through current saves", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "cartoon-save", mode: "sandbox" }));
  const cash = state.economy.cash;
  const rating = state.park.rating;
  const visitorCount = state.visitors.length;
  const result = applyDistrictAction(state, { type: "setDistrictTheme", districtId: "east", themeId: "cartoon" });
  assert.equal(result.ok, true, result.reason);
  assert.equal(state.districts.themes.east, "cartoon");
  assert.equal(state.economy.cash, cash);
  assert.equal(state.park.rating, rating);
  assert.equal(state.visitors.length, visitorCount);
  const restored = deserializeGame(serializeGame(state));
  assert.equal(restored.districts.themes.east, "cartoon");
});

test("two playful signature anchors unleash Toonburst", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "cartoon-power", mode: "sandbox" }));
  state.world.entities = [
    entity("cartoon-bumpers", "bumpers", 13, 1),
    entity("cartoon-cloudhop", "cloudhop", 16, 2)
  ];
  assert.equal(applyDistrictAction(state, { type: "setDistrictTheme", districtId: "north", themeId: "cartoon" }).ok, true);
  const power = styleSuperpowerForDistrict(state, "north");
  assert.equal(power.id, "toonburst");
  assert.equal(power.visualMode, "toon");
  assert.equal(power.stage, "unleashed");
  assert.equal(power.score, 6);
  assert.ok(power.topTags.includes("family"));
});

test("Cartoon rendering stays additive, bounded and outside preserved simulation", () => {
  const cartoonRenderer = read("../src/render/cartoonStyleWorldRenderer.js");
  const fantasyRenderer = read("../src/render/fantasyStyleWorldRenderer.js");
  const legacyRenderer = read("../src/render/legacyStyleUpgradeWorldRenderer.js");
  const finalStyle = read("../src/render/finalStyleWorldRenderer.js");
  const stateGuard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");
  const simulation = read("../src/core/simulation.js");
  assert.match(cartoonRenderer, /CARTOON_ROOT_LIMIT = 4/);
  assert.match(cartoonRenderer, /cartoon-style-dressing-root/);
  assert.match(cartoonRenderer, /cartoon-toonburst/);
  assert.match(cartoonRenderer, /squash/);
  assert.match(cartoonRenderer, /setQuality/);
  assert.match(fantasyRenderer, /CartoonStyleWorldRenderer/);
  assert.match(legacyRenderer, /GildedStyleWorldRenderer/);
  assert.match(finalStyle, /legacyStyleUpgradeWorldRenderer/);
  assert.match(stateGuard, /finalStyleWorldRenderer/);
  assert.doesNotMatch(simulation, /toonburst|cartoonStyleWorldRenderer|cartoon-style-dressing-root/);
});
