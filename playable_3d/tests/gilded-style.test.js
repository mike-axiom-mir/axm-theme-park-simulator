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

test("Gilded Wealth is the final declared district style after Waterfront", () => {
  assert.equal(DISTRICT_THEME_IDS.at(-1), "gilded");
  assert.equal(DISTRICT_THEME_IDS.at(-2), "waterfront");
  assert.equal(DISTRICT_THEMES.gilded.label, "Gilded Wealth");
  assert.deepEqual(DISTRICT_THEMES.gilded.signatureTags, ["luxury"]);
  assert.ok(DISTRICT_THEMES.gilded.preferredTags.includes("retail"));
  assert.ok(DISTRICT_THEMES.gilded.preferredTags.includes("food"));
  assert.ok(DISTRICT_THEMES.gilded.preferredTags.includes("care"));
});

test("luxury evidence comes from attractions hospitality retail and landmarks", () => {
  for (const id of ["sunbeam", "lagoonshow", "harbourfizz"]) {
    const tags = themeTagsForDefinition(catalogDefinition(id));
    const fit = evaluateThemeFit(catalogDefinition(id), "gilded");
    assert.ok(tags.includes("luxury"), `${id} should derive luxury evidence`);
    assert.equal(fit.status, "signature", `${id} should be a Gilded signature fit`);
  }
});

test("Gilded selection remains presentation-only and persists through saves", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "gilded-save", mode: "sandbox" }));
  const before = {
    cash: state.economy.cash,
    rating: state.park.rating,
    visitors: state.visitors.length
  };
  const result = applyDistrictAction(state, { type: "setDistrictTheme", districtId: "east", themeId: "gilded" });
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual({
    cash: state.economy.cash,
    rating: state.park.rating,
    visitors: state.visitors.length
  }, before);
  const restored = deserializeGame(serializeGame(state));
  assert.equal(restored.districts.themes.east, "gilded");
});

test("two luxury signature attractions unleash Grand Radiance", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "gilded-power", mode: "sandbox" }));
  state.world.entities = [
    entity("gilded-lookout", "sunbeam", 13, 1),
    entity("gilded-lagoon", "lagoonshow", 16, 2)
  ];
  assert.equal(applyDistrictAction(state, {
    type: "setDistrictTheme", districtId: "north", themeId: "gilded"
  }).ok, true);
  const power = styleSuperpowerForDistrict(state, "north");
  assert.equal(power.id, "grand-radiance");
  assert.equal(power.visualMode, "grandeur");
  assert.equal(power.stage, "unleashed");
  assert.equal(power.score, 6);
  assert.ok(power.topTags.includes("luxury"));
});

test("Gilded renderer deliberately dresses rides services stores and scenery", () => {
  const renderer = read("../src/render/gildedStyleWorldRenderer.js");
  const finalSeam = read("../src/render/finalStyleWorldRenderer.js");
  const legacySeam = read("../src/render/legacyStyleUpgradeWorldRenderer.js");
  const guard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");
  const simulation = read("../src/core/simulation.js");

  assert.match(renderer, /FestivalTechMotionGuardWorldRenderer/);
  assert.match(renderer, /GILDED_ROOT_LIMIT = 4/);
  assert.match(renderer, /bounded-render-only-gilded-wealth-style/);
  assert.match(renderer, /gilded-grand-radiance/);
  assert.match(renderer, /gilded-style-dressing-root/);
  assert.match(renderer, /shouldDress = identity\.themeId === "gilded"/);
  assert.match(renderer, /definition\.category === "Stores"/);
  assert.match(renderer, /definition\.kind === "service" \|\| definition\.category === "Services"/);
  assert.match(renderer, /definition\.kind === "ride"/);
  assert.match(renderer, /createSceneryDressing/);
  assert.match(renderer, /dressesEveryEntity: true/);
  assert.match(renderer, /setQuality/);
  assert.match(finalSeam, /legacyStyleUpgradeWorldRenderer/);
  assert.match(legacySeam, /gildedStyleWorldRenderer/);
  assert.match(guard, /finalStyleWorldRenderer/);
  assert.doesNotMatch(simulation, /grand-radiance|gildedStyleWorldRenderer|gilded-style-dressing-root/);
});
