import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyAction, createNewGame } from "../src/core/simulation.js";
import {
  RESEARCH_SCHEMA, applyResearchAction, getEntityGrowthView, getParkGrowthView,
  getResearchView, normalizeResearchState, parkResearchModifier
} from "../src/core/research.js";
import {
  advanceOneMinuteWithResearch, simulateMinutesWithResearch
} from "../src/core/researchRuntime.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function researchedState(seed = "research-proof", mode = "sandbox") {
  return normalizeResearchState(createNewGame({ seed, mode }));
}

function completeForTest(state, projectId, insight = 99) {
  state.research.insight = Math.max(state.research.insight, insight);
  for (const key of Object.keys(state.research.evidence)) state.research.evidence[key] = 999;
  const result = applyResearchAction(state, { type: "completeResearch", projectId });
  assert.equal(result.ok, true, result.reason);
}

test("research normalizer adds explicit defaults without retroactively rewarding old event history", () => {
  const state = createNewGame({ seed: "research-defaults" });
  const lastEvent = state.eventLog.at(-1).sequence;
  normalizeResearchState(state);
  assert.equal(state.research.schema, RESEARCH_SCHEMA);
  assert.equal(state.research.insight, 0);
  assert.equal(state.research.lifetimeInsight, 0);
  assert.equal(state.research.lastEventSequence, lastEvent);
  assert.deepEqual(state.research.completed, []);
  assert.deepEqual(state.research.parkGrowth, { hospitality: 0, operations: 0, identity: 0 });
});

test("normal play creates deterministic evidence and insight but never auto-completes research", () => {
  const first = researchedState("research-determinism", "campaign");
  const second = researchedState("research-determinism", "campaign");
  simulateMinutesWithResearch(first, 360);
  simulateMinutesWithResearch(second, 360);
  assert.deepEqual(first, second);
  assert.ok(first.research.lifetimeInsight > 0);
  assert.ok(first.research.evidence.guests > 0);
  assert.ok(first.research.evidence.rides > 0);
  assert.deepEqual(first.research.completed, []);
});

test("research completion requires evidence, insight and explicit player choice", () => {
  const state = researchedState("project-gate");
  let result = applyResearchAction(state, { type: "completeResearch", projectId: "ride-throughput" });
  assert.equal(result.ok, false);

  state.research.evidence.rides = 12;
  state.research.insight = 3;
  result = applyResearchAction(state, { type: "completeResearch", projectId: "ride-throughput" });
  assert.equal(result.ok, true);
  assert.equal(state.research.insight, 0);
  assert.ok(state.research.completed.includes("ride-throughput"));
  assert.equal(applyResearchAction(state, { type: "completeResearch", projectId: "ride-throughput" }).ok, false);
});

test("ride growth is bounded, paid and changes real throughput and wear behavior", () => {
  const grown = researchedState("ride-growth");
  completeForTest(grown, "ride-throughput");
  completeForTest(grown, "ride-reliability");
  const carousel = grown.world.entities.find((entity) => entity.catalogId === "carousel");
  const cashBeforeGrowth = grown.economy.cash;
  assert.equal(applyResearchAction(grown, { type: "growEntity", entityId: carousel.id, track: "throughput" }).ok, true);
  assert.equal(applyResearchAction(grown, { type: "growEntity", entityId: carousel.id, track: "reliability" }).ok, true);
  assert.ok(grown.economy.cash < cashBeforeGrowth);
  const growthView = getEntityGrowthView(grown, carousel.id);
  assert.equal(growthView.tracks.find((track) => track.id === "throughput").level, 1);
  assert.equal(growthView.tracks.find((track) => track.id === "reliability").level, 1);

  const control = structuredClone(grown);
  const controlCarousel = control.world.entities.find((entity) => entity.id === carousel.id);
  controlCarousel.researchGrowth.throughput = 0;
  controlCarousel.researchGrowth.reliability = 0;

  carousel.cycleRemaining = 8;
  controlCarousel.cycleRemaining = 8;
  for (let index = 0; index < 4; index += 1) {
    advanceOneMinuteWithResearch(grown);
    advanceOneMinuteWithResearch(control);
  }
  assert.ok(carousel.cycleRemaining < controlCarousel.cycleRemaining, "throughput growth did not shorten the live cycle");

  carousel.cycleRemaining = 1;
  controlCarousel.cycleRemaining = 1;
  carousel.condition = 80;
  controlCarousel.condition = 80;
  advanceOneMinuteWithResearch(grown);
  advanceOneMinuteWithResearch(control);
  assert.ok(carousel.condition > controlCarousel.condition, "reliability growth did not protect condition");
});

test("park Hospitality growth changes new-guest patience and visit time without changing RNG", () => {
  const grown = researchedState("hospitality-proof", "campaign");
  completeForTest(grown, "park-wayfinding");
  assert.equal(applyResearchAction(grown, { type: "growPark", track: "hospitality" }).ok, true);
  const control = structuredClone(grown);
  control.research.parkGrowth.hospitality = 0;

  let compared = false;
  for (let index = 0; index < 220; index += 1) {
    advanceOneMinuteWithResearch(grown);
    advanceOneMinuteWithResearch(control);
    const grownGuest = grown.visitors[0];
    const controlGuest = control.visitors.find((visitor) => visitor.id === grownGuest?.id);
    if (grownGuest && controlGuest) {
      assert.equal(grownGuest.patience, controlGuest.patience + 3);
      assert.equal(grownGuest.stayRemaining, controlGuest.stayRemaining + 8);
      compared = true;
      break;
    }
  }
  assert.equal(compared, true, "no comparable new guest appeared during the test window");
});

test("park Operations growth rebates a bounded share of the actual hourly operating charge", () => {
  const grown = researchedState("operations-proof");
  completeForTest(grown, "park-operations");
  assert.equal(applyResearchAction(grown, { type: "growPark", track: "operations" }).ok, true);
  const control = structuredClone(grown);
  control.research.parkGrowth.operations = 0;
  grown.clock.minute = 599;
  control.clock.minute = 599;
  const grownBefore = grown.economy.cash;
  const controlBefore = control.economy.cash;
  advanceOneMinuteWithResearch(grown);
  advanceOneMinuteWithResearch(control);
  const grownCost = grownBefore - grown.economy.cash;
  const controlCost = controlBefore - control.economy.cash;
  assert.ok(grownCost < controlCost);
  assert.ok(grown.eventLog.some((entry) => entry.type === "research.efficiency.rebate"));
});

test("passive stores can grow real park appeal without fake shopping transactions", () => {
  const grown = researchedState("retail-appeal");
  assert.equal(applyAction(grown, { type: "build", catalogId: "memorymarket", x: 1, z: 1, rotation: 0 }).ok, true);
  completeForTest(grown, "retail-appeal");
  const store = grown.world.entities.find((entity) => entity.catalogId === "memorymarket");
  assert.equal(applyResearchAction(grown, { type: "growEntity", entityId: store.id, track: "appeal" }).ok, true);
  const control = structuredClone(grown);
  control.world.entities.find((entity) => entity.id === store.id).researchGrowth.appeal = 0;
  grown.tick = 4;
  control.tick = 4;
  advanceOneMinuteWithResearch(grown);
  advanceOneMinuteWithResearch(control);
  assert.ok(parkResearchModifier(grown).demandBonus > parkResearchModifier(control).demandBonus);
  assert.ok(grown.metrics.reachableDemand > control.metrics.reachableDemand);
  assert.equal(grown.eventLog.some((entry) => entry.type === "economy.income" && entry.subjectId === store.id), false,
    "passive retail growth must not fabricate purchases");
});

test("research and growth persist through save round-trip while legacy saves receive defaults", () => {
  const state = researchedState("research-save");
  completeForTest(state, "ride-throughput");
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  assert.equal(applyResearchAction(state, { type: "growEntity", entityId: carousel.id, track: "throughput" }).ok, true);
  const restored = deserializeGame(serializeGame(state));
  assert.ok(restored.research.completed.includes("ride-throughput"));
  assert.equal(restored.world.entities.find((entity) => entity.id === carousel.id).researchGrowth.throughput, 1);

  const legacy = createNewGame({ seed: "research-legacy" });
  delete legacy.research;
  for (const entity of legacy.world.entities) delete entity.researchGrowth;
  const migrated = deserializeGame(serializeGame(legacy));
  assert.equal(migrated.research.schema, RESEARCH_SCHEMA);
  assert.equal(migrated.research.insight, 0);
  assert.equal(migrated.world.entities.every((entity) => entity.researchGrowth), true);
});

test("playable wiring uses the additive research runtime and keeps baseline simulation independent", () => {
  const main = read("../src/main.js");
  const simulation = read("../src/core/simulation.js");
  const runtime = read("../src/core/researchRuntime.js");
  const lab = read("../src/ui/researchLabUI.js");
  assert.match(main, /advanceOneMinuteWithResearch/);
  assert.match(main, /ResearchLabUI/);
  assert.match(main, /completeResearch/);
  assert.match(main, /growEntity/);
  assert.match(main, /growPark/);
  assert.match(runtime, /advanceOneMinute\(state\)/);
  assert.match(runtime, /applyEntityGrowth/);
  assert.match(runtime, /applyParkGrowth/);
  assert.doesNotMatch(simulation, /researchRuntime|research\.project|researchGrowth/);
  assert.match(lab, /Learn from the park you actually run/);
});
