import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNewGame } from "../src/core/simulation.js";
import { applyDistrictAction, normalizeDistrictState } from "../src/core/districts.js";
import {
  STYLE_SUPERPOWER_SCHEMA, STYLE_SUPERPOWER_VISUAL_BUDGET,
  styleSuperpowerForDistrict, styleSuperpowerPlan
} from "../src/core/styleSuperpowers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function entity(id, catalogId, x, z) {
  return { id, catalogId, x, z, rotation: 0 };
}

function powerState(themeId, catalogIds = []) {
  const state = normalizeDistrictState(createNewGame({ seed: `style-power-${themeId}`, mode: "sandbox" }));
  state.world.entities = catalogIds.map((catalogId, index) => entity(
    `${themeId}-${index + 1}`, catalogId, 13 + (index % 3) * 2, 1 + Math.floor(index / 3) * 2
  ));
  const result = applyDistrictAction(state, { type: "setDistrictTheme", districtId: "north", themeId });
  assert.equal(result.ok, true, result.reason);
  return state;
}

test("neutral style exposes Open Canvas as an intentionally passive superpower", () => {
  const state = normalizeDistrictState(createNewGame({ seed: "style-power-neutral", mode: "sandbox" }));
  state.world.entities = [entity("water-a", "canalcruise", 14, 1), entity("water-b", "lilypond", 16, 2)];
  const power = styleSuperpowerForDistrict(state, "north");
  assert.equal(power.schema, STYLE_SUPERPOWER_SCHEMA);
  assert.equal(power.id, "open-canvas");
  assert.equal(power.stage, "passive");
  assert.equal(power.active, false);
});

test("one signature anchor charges a district and two signature anchors can unleash it", () => {
  const one = powerState("waterfront", ["canalcruise"]);
  const charged = styleSuperpowerForDistrict(one, "north");
  assert.equal(charged.id, "tidecall");
  assert.equal(charged.score, 3);
  assert.equal(charged.stage, "charged");
  assert.equal(charged.eligibleCount, 1);

  const two = powerState("waterfront", ["canalcruise", "lilypond"]);
  const unleashed = styleSuperpowerForDistrict(two, "north");
  assert.equal(unleashed.score, 6);
  assert.equal(unleashed.stage, "unleashed");
  assert.equal(unleashed.active, true);
  assert.ok(unleashed.topTags.includes("water"));
});

test("each styled identity has a distinct superpower that can be earned by matching content", () => {
  const cases = [
    ["garden", "bloomwake", ["lilypond", "mistgarden"]],
    ["adventure", "trailblaze", ["cascadegarden", "ponchopier"]],
    ["storybook", "lantern-chorus", ["canalcruise", "lagoonshow"]],
    ["cartoon", "toonburst", ["bumpers", "cloudhop"]],
    ["fantasy", "aetherveil", ["lanternmaze", "canalcruise"]],
    ["western", "frontier-rush", ["littleloop", "logdash"]],
    ["medieval", "bannerwake", ["lanternmaze", "canalcruise"]],
    ["halloween", "hauntfall", ["lanternmaze", "cloudcinema"]],
    ["christmas", "snowglow", ["littleloop", "twirlcups"]],
    ["newyear", "countdown-burst", ["starflyers", "sunbeam"]],
    ["future", "pulse-grid", ["tidalturn", "lagoonshow"]],
    ["robotica", "servo-surge", ["bumpers", "cloudhop"]],
    ["software", "codewave", ["skysail", "cloudcinema"]],
    ["waterfront", "tidecall", ["canalcruise", "lilypond"]]
  ];

  for (const [themeId, powerId, content] of cases) {
    const state = powerState(themeId, content);
    const power = styleSuperpowerForDistrict(state, "north");
    assert.equal(power.id, powerId, `${themeId} routed to the wrong power`);
    assert.equal(power.stage, "unleashed", `${themeId} did not reach unleashed with two signature anchors`);
    assert.equal(power.active, true);
    assert.ok(power.anchors.length <= 6);
  }
});

test("superpower planning is read-only and bounded to the four existing districts", () => {
  const state = powerState("waterfront", ["canalcruise", "lilypond", "cascadegarden", "harbourlight"]);
  const before = structuredClone(state);
  const plan = styleSuperpowerPlan(state);
  assert.equal(plan.length, STYLE_SUPERPOWER_VISUAL_BUDGET);
  assert.deepEqual(plan.map((item) => item.districtId).sort(), ["east", "north", "south", "west"]);
  assert.deepEqual(state, before, "style superpower planner mutated authoritative park state");
});

test("style superpowers stay in additive presentation layering and do not leak into preserved simulation", () => {
  const renderer = read("../src/render/styleSuperpowerWorldRenderer.js");
  const cartoonRenderer = read("../src/render/cartoonStyleWorldRenderer.js");
  const fantasyRenderer = read("../src/render/fantasyStyleWorldRenderer.js");
  const westernRenderer = read("../src/render/westernStyleWorldRenderer.js");
  const medievalRenderer = read("../src/render/medievalStyleWorldRenderer.js");
  const seasonalTechRenderer = read("../src/render/festivalTechStyleWorldRenderer.js");
  const seasonalMotionGuard = read("../src/render/festivalTechMotionGuardWorldRenderer.js");
  const finalStyle = read("../src/render/finalStyleWorldRenderer.js");
  const stateGuard = read("../src/render/stateSafeParkIdentityWorldRenderer.js");
  const simulation = read("../src/core/simulation.js");

  assert.match(renderer, /WaterfrontIdentityWorldRenderer/);
  assert.match(renderer, /styleSuperpowerPlan/);
  assert.match(renderer, /bounded-render-only-style-superpowers/);
  assert.match(renderer, /Bloomwake|createBloomwake/);
  assert.match(renderer, /Trailblaze|createTrailblaze/);
  assert.match(renderer, /Lantern Chorus|createLanternChorus/);
  assert.match(renderer, /Pulse Grid|createPulseGrid/);
  assert.match(renderer, /Tidecall|createTidecall/);
  assert.match(renderer, /weather\?\.type/);
  assert.match(cartoonRenderer, /StyleSuperpowerWorldRenderer/);
  assert.match(fantasyRenderer, /CartoonStyleWorldRenderer/);
  assert.match(westernRenderer, /FantasyStyleWorldRenderer/);
  assert.match(westernRenderer, /western-frontier-rush/);
  assert.match(medievalRenderer, /WesternStyleWorldRenderer/);
  assert.match(medievalRenderer, /medieval-bannerwake/);
  assert.match(seasonalTechRenderer, /MedievalStyleWorldRenderer/);
  assert.match(seasonalTechRenderer, /halloween-hauntfall/);
  assert.match(seasonalTechRenderer, /christmas-snowglow/);
  assert.match(seasonalTechRenderer, /newyear-countdown-burst/);
  assert.match(seasonalTechRenderer, /robotica-servo-surge/);
  assert.match(seasonalTechRenderer, /software-codewave/);
  assert.match(seasonalMotionGuard, /FestivalTechStyleWorldRenderer/);
  assert.match(finalStyle, /festivalTechMotionGuardWorldRenderer/);
  assert.match(stateGuard, /finalStyleWorldRenderer/);
  assert.doesNotMatch(simulation, /styleSuperpowers|styleSuperpowerPlan|Frontier Rush|Bannerwake|Hauntfall|Snowglow|Countdown Burst|Servo Surge|Codewave|festivalTechStyleWorldRenderer/);
});
