import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNewGame } from "../src/core/simulation.js";
import { normalizeHistoricalEconomyState } from "../src/core/historicalEconomy.js";
import { beginMapCampaignTimeline } from "../src/core/historicalTimeline.js";
import {
  LEGACY_ANNUAL_DIVIDEND_CAP, LEGACY_MAP_COMPLETION_AWARD, LEGACY_OBJECTIVE_AWARD,
  applyLegacyCareerAction, estimateParkValue, getLegacyCareerView, legacyStyleCapabilities,
  normalizeLegacyCareerState, processLegacyCareerProgress
} from "../src/core/legacyCareer.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function state(seed = "legacy-career") {
  return normalizeLegacyCareerState(normalizeHistoricalEconomyState(createNewGame({ seed, mode: "sandbox" })));
}

test("completed goals award Legacy Fund once per map instead of farming operating cash", () => {
  const park = state("legacy-goal");
  park.campaign.objectives[0].complete = true;
  const bankBefore = park.economy.cash;
  assert.equal(processLegacyCareerProgress(park), LEGACY_OBJECTIVE_AWARD);
  assert.equal(park.legacy.fund, LEGACY_OBJECTIVE_AWARD);
  assert.equal(park.economy.cash, bankBefore, "Legacy award must not skim or add operating bank cash");
  assert.equal(processLegacyCareerProgress(park), 0, "same goal must not pay twice on the same map");

  beginMapCampaignTimeline(park, { mapId: "second-map", localDay: 1 });
  assert.equal(processLegacyCareerProgress(park), LEGACY_OBJECTIVE_AWARD,
    "the same objective id may pay again on a genuinely different map campaign");
});

test("completed map campaign pays one durable Legacy award", () => {
  const park = state("legacy-map");
  park.campaign.completed = true;
  park.park.selectedEnding = "keep-growing";
  assert.equal(processLegacyCareerProgress(park), LEGACY_MAP_COMPLETION_AWARD);
  assert.equal(park.legacy.ledger.mapAwards, LEGACY_MAP_COMPLETION_AWARD);
  assert.equal(processLegacyCareerProgress(park), 0);
});

test("annual finance and park-value dividend is small capped and once per career year", () => {
  const park = state("legacy-dividend");
  park.economy.cash = 100000;
  park.economy.lifetimeIncome = 400000;
  park.economy.lifetimeCosts = 50000;
  park.history.careerOperatingDay = park.history.operatingDaysPerYear + 1;
  const before = park.legacy.fund;
  const award = processLegacyCareerProgress(park);
  assert.ok(award > 0);
  assert.ok(award <= LEGACY_ANNUAL_DIVIDEND_CAP);
  assert.equal(park.legacy.fund, before + award);
  assert.equal(processLegacyCareerProgress(park), 0, "same career year dividend must not repeat");
});

test("park valuation is deterministic and includes liquid funds plus depreciated built assets", () => {
  const park = state("legacy-value");
  const value = estimateParkValue(park);
  assert.ok(value >= park.economy.cash);
  assert.equal(estimateParkValue(park), value);
});

test("Legacy style projects spend only Legacy Fund and never normal park research Insight or cash", () => {
  const park = state("legacy-style-spend");
  park.legacy.fund = 5000;
  park.research = { insight: 17, evidence: {}, completed: [], parkGrowth: {} };
  const cashBefore = park.economy.cash;
  const insightBefore = park.research.insight;

  assert.equal(applyLegacyCareerAction(park, {
    type: "completeLegacyStyleProject", projectId: "signature-dressing"
  }).ok, true);
  assert.equal(applyLegacyCareerAction(park, {
    type: "completeLegacyStyleProject", projectId: "prestige-frontages"
  }).ok, true);
  assert.equal(applyLegacyCareerAction(park, {
    type: "completeLegacyStyleProject", projectId: "district-finales"
  }).ok, true);

  const capabilities = legacyStyleCapabilities(park);
  assert.equal(capabilities.signatureDressing, true);
  assert.equal(capabilities.prestigeFrontages, true);
  assert.equal(capabilities.districtFinales, true);
  assert.equal(park.economy.cash, cashBefore);
  assert.equal(park.research.insight, insightBefore);
  assert.ok(park.legacy.fund < 5000);
});

test("Legacy career and style capabilities persist through the current save schema", () => {
  const park = state("legacy-save");
  park.legacy.fund = 1800;
  assert.equal(applyLegacyCareerAction(park, {
    type: "completeLegacyStyleProject", projectId: "signature-dressing"
  }).ok, true);
  const restored = deserializeGame(serializeGame(park));
  const view = getLegacyCareerView(restored);
  assert.equal(view.fund, 1300);
  assert.equal(view.capabilities.signatureDressing, true);
});

test("Park Research remains functional while Legacy Research remains style-only", () => {
  const research = read("../src/core/research.js");
  const legacy = read("../src/core/legacyCareer.js");
  const legacyRuntime = read("../src/core/legacyCareerRuntime.js");
  const renderer = read("../src/render/legacyStyleUpgradeWorldRenderer.js");
  const finalSeam = read("../src/render/finalStyleWorldRenderer.js");
  const simulation = read("../src/core/simulation.js");

  assert.match(research, /ride-throughput/);
  assert.match(research, /service-throughput/);
  assert.match(research, /service-quality/);
  assert.doesNotMatch(research, /signature-dressing|prestige-frontages|district-finales|seasonal-pageantry|landmark-masterworks/);

  assert.match(legacy, /signature-dressing/);
  assert.match(legacy, /prestige-frontages/);
  assert.match(legacy, /district-finales/);
  assert.match(legacy, /seasonal-pageantry/);
  assert.match(legacy, /landmark-masterworks/);
  assert.doesNotMatch(legacy, /throughputBonus|serviceSpeed|rideReliability|guestHappiness/);

  assert.match(legacyRuntime, /advanceOneMinuteWithHistoricalEconomy/);
  assert.match(renderer, /GildedStyleWorldRenderer/);
  assert.match(renderer, /bounded-render-only-legacy-style-upgrades/);
  assert.match(renderer, /legacy-style-entity-accent-root/);
  assert.match(renderer, /legacy-prestige-frontage/);
  assert.match(renderer, /legacy-district-finale/);
  assert.match(renderer, /legacy-seasonal-pageantry/);
  assert.match(renderer, /legacy-landmark-masterwork/);
  assert.match(finalSeam, /legacyStyleUpgradeWorldRenderer/);
  assert.doesNotMatch(simulation, /Legacy Fund|completeLegacyStyleProject|legacyStyleUpgradeWorldRenderer/);
});
