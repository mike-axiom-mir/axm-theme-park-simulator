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

function powerState(themeId, catalogIds) {
  const state = normalizeDistrictState(createNewGame({ seed: `seasonal-tech-${themeId}`, mode: "sandbox" }));
  state.world.entities = catalogIds.map((catalogId, index) => entity(`${themeId}-${index + 1}`, catalogId, 13 + index * 3, 1 + index));
  const result = applyDistrictAction(state, { type: "setDistrictTheme", districtId: "north", themeId });
  assert.equal(result.ok, true, result.reason);
  return state;
}

test("seasonal and technology lands occupy explicit positions in the theme cycle", () => {
  const expected = [
    "medieval", "halloween", "christmas", "newyear", "future", "robotica", "software", "waterfront"
  ];
  const start = DISTRICT_THEME_IDS.indexOf("medieval");
  assert.deepEqual(DISTRICT_THEME_IDS.slice(start, start + expected.length), expected);
  assert.equal(DISTRICT_THEMES.halloween.label, "Halloween");
  assert.equal(DISTRICT_THEMES.christmas.label, "Christmas");
  assert.equal(DISTRICT_THEMES.newyear.label, "New Year");
  assert.equal(DISTRICT_THEMES.robotica.label, "Robotica");
  assert.equal(DISTRICT_THEMES.software.label, "AI / Software Future");
});

test("Halloween derives from real dark and indoor-story attraction evidence", () => {
  for (const id of ["lanternmaze", "cloudcinema"]) {
    const tags = themeTagsForDefinition(catalogDefinition(id));
    const fit = evaluateThemeFit(catalogDefinition(id), "halloween");
    assert.ok(tags.includes("halloween"), `${id} missing Halloween evidence`);
    assert.equal(fit.status, "signature", `${id} should be a Halloween signature fit`);
  }
});

test("Christmas derives from family story scenic and rail evidence", () => {
  for (const id of ["littleloop", "twirlcups"]) {
    const tags = themeTagsForDefinition(catalogDefinition(id));
    const fit = evaluateThemeFit(catalogDefinition(id), "christmas");
    assert.ok(tags.includes("christmas"), `${id} missing Christmas evidence`);
    assert.equal(fit.status, "signature", `${id} should be a Christmas signature fit`);
  }
});

test("New Year derives from luminous future scenic and thrill evidence", () => {
  for (const id of ["starflyers", "sunbeam"]) {
    const tags = themeTagsForDefinition(catalogDefinition(id));
    const fit = evaluateThemeFit(catalogDefinition(id), "newyear");
    assert.ok(tags.includes("newyear"), `${id} missing New Year evidence`);
    assert.equal(fit.status, "signature", `${id} should be a New Year signature fit`);
  }
});

test("Robotica and AI Software Future remain distinct technology branches", () => {
  for (const id of ["bumpers", "cloudhop"]) {
    assert.ok(themeTagsForDefinition(catalogDefinition(id)).includes("robotica"));
    assert.equal(evaluateThemeFit(catalogDefinition(id), "robotica").status, "signature");
  }
  for (const id of ["skysail", "cloudcinema"]) {
    assert.ok(themeTagsForDefinition(catalogDefinition(id)).includes("software"));
    assert.equal(evaluateThemeFit(catalogDefinition(id), "software").status, "signature");
  }
  assert.equal(themeTagsForDefinition(catalogDefinition("bumpers")).includes("software"), false);
  assert.equal(themeTagsForDefinition(catalogDefinition("skysail")).includes("robotica"), false);
});

test("all five new land choices remain presentation-only and save through current schema", () => {
  for (const themeId of ["halloween", "christmas", "newyear", "robotica", "software"]) {
    const state = normalizeDistrictState(createNewGame({ seed: `save-${themeId}`, mode: "sandbox" }));
    const before = {
      cash: state.economy.cash,
      rating: state.park.rating,
      visitors: state.visitors.length
    };
    const result = applyDistrictAction(state, { type: "setDistrictTheme", districtId: "east", themeId });
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual({
      cash: state.economy.cash,
      rating: state.park.rating,
      visitors: state.visitors.length
    }, before);
    const restored = deserializeGame(serializeGame(state));
    assert.equal(restored.districts.themes.east, themeId);
  }
});

test("each new themed land can unleash its distinct district spectacle", () => {
  const cases = [
    ["halloween", "hauntfall", ["lanternmaze", "cloudcinema"]],
    ["christmas", "snowglow", ["littleloop", "twirlcups"]],
    ["newyear", "countdown-burst", ["starflyers", "sunbeam"]],
    ["robotica", "servo-surge", ["bumpers", "cloudhop"]],
    ["software", "codewave", ["skysail", "cloudcinema"]]
  ];
  for (const [themeId, powerId, content] of cases) {
    const power = styleSuperpowerForDistrict(powerState(themeId, content), "north");
    assert.equal(power.id, powerId);
    assert.equal(power.stage, "unleashed", `${themeId} should unleash with two signature anchors`);
    assert.equal(power.score, 6);
    assert.ok(power.topTags.includes(themeId));
  }
});

test("seasonal and technology renderer is bounded and stays outside simulation authority", () => {
  const renderer = read("../src/render/festivalTechStyleWorldRenderer.js");
  const finalSeam = read("../src/render/finalStyleWorldRenderer.js");
  const stateGuard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");
  const simulation = read("../src/core/simulation.js");

  assert.match(renderer, /MedievalStyleWorldRenderer/);
  assert.match(renderer, /LAND_ROOT_LIMIT = 4/);
  assert.match(renderer, /bounded-render-only-seasonal-robotica-software-styles/);
  assert.match(renderer, /halloween-hauntfall/);
  assert.match(renderer, /christmas-snowglow/);
  assert.match(renderer, /newyear-countdown-burst/);
  assert.match(renderer, /robotica-servo-surge/);
  assert.match(renderer, /software-codewave/);
  assert.match(renderer, /festival-tech-style-dressing-root/);
  assert.match(renderer, /setQuality/);
  assert.match(finalSeam, /festivalTechStyleWorldRenderer/);
  assert.match(stateGuard, /finalStyleWorldRenderer/);
  assert.doesNotMatch(simulation, /hauntfall|snowglow|countdown-burst|servo-surge|codewave|festivalTechStyleWorldRenderer/);
});
