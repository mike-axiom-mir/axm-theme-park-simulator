import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNewGame } from "../src/core/simulation.js";
import { normalizeResearchState } from "../src/core/research.js";
import {
  MANUAL_BANK_RUN_CUT, MANUAL_BANK_RUN_MINUTES,
  acceptedElectronicShare, applyHistoricalEconomyAction,
  collectVaultToBank, getHistoricalEconomyView, marketElectronicShare,
  normalizeHistoricalEconomyState, paymentTechnologyView, processPaymentIncomeEvents,
  processHistoricalOperatingDayTransition, weeklyCollectionDue
} from "../src/core/historicalEconomy.js";
import {
  HISTORICAL_OPERATING_DAYS_PER_YEAR, beginMapCampaignTimeline,
  calendarYear, careerOperatingDay
} from "../src/core/historicalTimeline.js";
import {
  SIMULATION_MAX_SPEED, SIMULATION_MILLISECONDS_PER_MINUTE, SIMULATION_SPEEDS,
  realMinutesForOperatingDays, realMinutesPerOperatingDay
} from "../src/core/timeScale.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const closeTo = (actual, expected, epsilon = 0.02) => assert.ok(Math.abs(actual - expected) <= epsilon,
  `${actual} was not within ${epsilon} of ${expected}`);

function state(seed = "historical-economy") {
  return normalizeHistoricalEconomyState(normalizeResearchState(createNewGame({ seed, mode: "sandbox" })));
}

test("career begins in 1980 and uses eight career operating days per historical year", () => {
  const park = state("timeline");
  assert.equal(calendarYear(park), 1980);
  assert.equal(HISTORICAL_OPERATING_DAYS_PER_YEAR, 8);
  park.history.careerOperatingDay = 65;
  assert.equal(calendarYear(park), 1988);
  park.history.careerOperatingDay = 361;
  assert.equal(calendarYear(park), 2025);
});

test("local map Day 1 can restart without resetting the career year", () => {
  const park = state("map-continuity");
  park.history.careerOperatingDay = 201; // 2005 with 8 representative operating days/year.
  park.clock.day = 27;
  assert.equal(calendarYear(park), 2005);
  const view = beginMapCampaignTimeline(park, { mapId: "alpine-expansion", localDay: 1 });
  assert.equal(park.clock.day, 1);
  assert.equal(careerOperatingDay(park), 201);
  assert.equal(calendarYear(park), 2005);
  assert.equal(view.activeMapId, "alpine-expansion");
  assert.equal(view.mapOperatingDay, 1);
});

test("pause 1x 2x 4x are the only playable speed contracts and historical pacing targets 4x", () => {
  assert.deepEqual([...SIMULATION_SPEEDS], [0, 1, 2, 4]);
  assert.equal(SIMULATION_MAX_SPEED, 4);
  assert.equal(SIMULATION_MILLISECONDS_PER_MINUTE, 620);
  closeTo(realMinutesPerOperatingDay(1), 8.06);
  closeTo(realMinutesPerOperatingDay(2), 4.03);
  closeTo(realMinutesPerOperatingDay(4), 2.015);
  closeTo(realMinutesForOperatingDays(HISTORICAL_OPERATING_DAYS_PER_YEAR, 1), 64.48);
  closeTo(realMinutesForOperatingDays(HISTORICAL_OPERATING_DAYS_PER_YEAR, 2), 32.24);
  closeTo(realMinutesForOperatingDays(HISTORICAL_OPERATING_DAYS_PER_YEAR, 4), 16.12);
});

test("1980 guest income becomes physical office-vault cash without duplicate revenue", () => {
  const park = state("cash-reclassification");
  park.economy.cash = 112;
  park.economy.todayIncome = 12;
  park.economy.lifetimeIncome = 12;
  processPaymentIncomeEvents(park, [{
    sequence: 99,
    type: "economy.income",
    subjectId: "park",
    data: { amount: 12, label: "Admission" }
  }]);
  assert.equal(park.economy.cash, 100);
  assert.equal(park.payments.officeVault, 12);
  assert.equal(park.economy.todayIncome, 12, "cash classification must not book revenue twice");
  assert.equal(park.economy.lifetimeIncome, 12);
  assert.equal(park.payments.ledger.cashGross, 12);
  assert.equal(park.payments.ledger.electronicFees, 0);
});

test("weekly collection follows career days, not the current map day", () => {
  const park = state("weekly-collection");
  park.history.careerOperatingDay = 8;
  park.clock.day = 1;
  park.economy.cash = 250;
  park.payments.officeVault = 125.5;
  const beforeCosts = park.economy.todayCosts;
  assert.equal(weeklyCollectionDue(park), true);
  const deposited = collectVaultToBank(park, { reason: "weekly-car" });
  assert.equal(deposited, 125.5);
  assert.equal(park.payments.officeVault, 0);
  assert.equal(park.economy.cash, 375.5);
  assert.equal(park.economy.todayCosts, beforeCosts, "weekly car should not charge a hidden cash fee");
  assert.equal(park.payments.lastCollectionDay, 8);
  assert.equal(park.payments.ledger.weeklyCollections, 1);
});

test("committed operating-day transitions advance career time exactly once", () => {
  const park = state("career-day-transition");
  const before = careerOperatingDay(park);
  const transition = processHistoricalOperatingDayTransition(park, { source: "test-next-day" });
  assert.equal(careerOperatingDay(park), before + 1);
  assert.equal(transition.careerOperatingDay, before + 1);
});

test("manual bank run is available any day, loses 10%, and returns a 90-minute time cost", () => {
  const park = state("manual-bank-run");
  park.economy.cash = 50;
  park.payments.officeVault = 200;
  const result = applyHistoricalEconomyAction(park, { type: "manualBankRun" });
  assert.equal(result.ok, true, result.reason);
  assert.equal(MANUAL_BANK_RUN_CUT, 0.10);
  assert.equal(MANUAL_BANK_RUN_MINUTES, 90);
  assert.equal(result.timeCostMinutes, 90);
  assert.equal(park.payments.officeVault, 0);
  assert.equal(park.economy.cash, 230);
  assert.equal(park.economy.todayCosts, 20);
  assert.equal(park.payments.ledger.manualBankCuts, 20);
});

test("PIN research is year-gated as well as evidence-and-insight gated", () => {
  const park = state("pin-year-gate");
  park.research.insight = 20;
  park.research.evidence.commerce = 50;
  park.research.evidence.operations = 50;
  let view = paymentTechnologyView(park, "pin-terminals");
  assert.equal(view.year, 1980);
  assert.equal(view.yearMet, false);
  assert.equal(view.canComplete, false);

  park.history.careerOperatingDay = 65;
  view = paymentTechnologyView(park, "pin-terminals");
  assert.equal(view.year, 1988);
  assert.equal(view.yearMet, true);
  assert.equal(view.canComplete, true);
  assert.equal(applyHistoricalEconomyAction(park, {
    type: "completePaymentTechnology", technologyId: "pin-terminals"
  }).ok, true);
  assert.ok(acceptedElectronicShare(park) > 0);
  assert.ok(acceptedElectronicShare(park) <= 0.25);
});

test("market mix reaches roughly half electronic in 2015 and mostly electronic by 2025", () => {
  assert.equal(marketElectronicShare(1980), 0);
  assert.equal(marketElectronicShare(2015), 0.5);
  assert.equal(marketElectronicShare(2025), 0.83);
});

test("electronic payments use a small fee ledger instead of cash-vault delay", () => {
  const park = state("electronic-fee");
  park.history.careerOperatingDay = 361; // 2025 in the compressed career calendar.
  park.payments.completedTechnology = ["pin-terminals", "park-pin-network", "contactless-payments"];
  park.economy.cash = 100;
  const events = Array.from({ length: 100 }, (_, index) => ({
    sequence: index + 1,
    type: "economy.income",
    subjectId: `sale-${index}`,
    data: { amount: 10, label: "Service sale" }
  }));
  park.economy.cash += 1000;
  park.economy.todayIncome = 1000;
  park.economy.lifetimeIncome = 1000;
  processPaymentIncomeEvents(park, events);
  assert.ok(park.payments.ledger.electronicGross > park.payments.ledger.cashGross);
  assert.ok(park.payments.ledger.electronicFees > 0);
  assert.ok(park.payments.officeVault > 0, "modern mix should still retain some cash");
  assert.equal(park.economy.todayIncome, 1000, "payment method must not change gross sales");
});

test("historical payment and career state persist in current save schema", () => {
  const park = state("historical-save");
  park.history.careerOperatingDay = 65;
  park.clock.day = 2;
  park.payments.officeVault = 321.45;
  park.research.insight = 10;
  park.research.evidence.commerce = 20;
  park.research.evidence.operations = 20;
  assert.equal(applyHistoricalEconomyAction(park, {
    type: "completePaymentTechnology", technologyId: "pin-terminals"
  }).ok, true);
  const restored = deserializeGame(serializeGame(park));
  assert.equal(restored.payments.officeVault, 321.45);
  assert.ok(restored.payments.completedTechnology.includes("pin-terminals"));
  assert.equal(careerOperatingDay(restored), 65);
  assert.equal(calendarYear(restored), 1988);
  assert.equal(restored.clock.day, 2);
});

test("historical economy remains active beneath the final Legacy runtime layer", () => {
  const simulation = read("../src/core/simulation.js");
  const historicalRuntime = read("../src/core/historicalEconomyRuntime.js");
  const timeline = read("../src/core/historicalTimeline.js");
  const timeScale = read("../src/core/timeScale.js");
  const main = read("../src/main.js");
  const legacyRuntime = read("../src/core/legacyCareerRuntime.js");
  const cashOffice = read("../src/ui/cashOfficeUI.js");

  assert.doesNotMatch(simulation, /historicalEconomy|officeVault|pin-terminals|manualBankRun|careerOperatingDay/);
  assert.match(historicalRuntime, /advanceOneMinuteWithUpgrades/);
  assert.match(historicalRuntime, /processHistoricalEconomyAfterTick/);
  assert.match(timeline, /careerOperatingDay/);
  assert.match(timeline, /beginMapCampaignTimeline/);
  assert.match(timeScale, /SIMULATION_SPEEDS/);
  assert.match(main, /advanceOneMinuteWithLegacyCareer/);
  assert.match(main, /simulateMinutesWithLegacyCareer/);
  assert.match(legacyRuntime, /advanceOneMinuteWithHistoricalEconomy/);
  assert.match(legacyRuntime, /simulateMinutesWithHistoricalEconomy/);
  assert.match(main, /processHistoricalOperatingDayTransition/);
  assert.match(main, /SIMULATION_MILLISECONDS_PER_MINUTE/);
  assert.match(main, /CashOfficeUI/);
  assert.match(cashOffice, /Bank now · lose 10%/);
});

test("Cash Office view exposes bank, vault, career calendar, weekly pickup, payment mix and technology", () => {
  const park = state("cash-office-view");
  const view = getHistoricalEconomyView(park);
  assert.equal(view.calendar.year, 1980);
  assert.equal(view.calendar.careerOperatingDay, 1);
  assert.equal(view.calendar.mapOperatingDay, 1);
  assert.equal(view.bankAvailable, park.economy.cash);
  assert.equal(view.officeVault, 0);
  assert.equal(view.collectionIntervalDays, 7);
  assert.equal(view.manualBankRunCut, 0.10);
  assert.equal(view.technology.length, 3);
});
