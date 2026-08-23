import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNewGame } from "../src/core/simulation.js";
import { normalizeResearchState } from "../src/core/research.js";
import {
  MANUAL_BANK_RUN_CUT, MANUAL_BANK_RUN_MINUTES,
  acceptedElectronicShare, applyHistoricalEconomyAction, calendarYear,
  collectVaultToBank, getHistoricalEconomyView, marketElectronicShare,
  normalizeHistoricalEconomyState, paymentTechnologyView, processPaymentIncomeEvents,
  weeklyCollectionDue
} from "../src/core/historicalEconomy.js";
import { HISTORICAL_OPERATING_DAYS_PER_YEAR } from "../src/core/historicalTimeline.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function state(seed = "historical-economy") {
  return normalizeHistoricalEconomyState(normalizeResearchState(createNewGame({ seed, mode: "sandbox" })));
}

test("career begins in 1980 and uses one isolated compressed-year constant", () => {
  const park = state("timeline");
  assert.equal(calendarYear(park), 1980);
  assert.equal(HISTORICAL_OPERATING_DAYS_PER_YEAR, 4);
  park.clock.day = 33;
  assert.equal(calendarYear(park), 1988);
  park.clock.day = 181;
  assert.equal(calendarYear(park), 2025);
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

test("weekly collection transfers the whole vault to spendable bank funds for free", () => {
  const park = state("weekly-collection");
  park.clock.day = 8;
  park.economy.cash = 250;
  park.payments.officeVault = 125.5;
  const beforeCosts = park.economy.todayCosts;
  assert.equal(weeklyCollectionDue(park), true);
  const deposited = collectVaultToBank(park, { reason: "weekly-car" });
  assert.equal(deposited, 125.5);
  assert.equal(park.payments.officeVault, 0);
  assert.equal(park.economy.cash, 375.5);
  assert.equal(park.economy.todayCosts, beforeCosts, "weekly car should not charge a hidden cash fee");
  assert.equal(park.payments.ledger.weeklyCollections, 1);
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

  park.clock.day = 33;
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
  park.clock.day = 181; // 2025 in the compressed career calendar.
  park.payments.completedTechnology = ["pin-terminals", "park-pin-network", "contactless-payments"];
  park.economy.cash = 100;
  const events = Array.from({ length: 100 }, (_, index) => ({
    sequence: index + 1,
    type: "economy.income",
    subjectId: `sale-${index}`,
    data: { amount: 10, label: "Service sale" }
  }));
  // Base simulation has already credited the gross sales before classification.
  park.economy.cash += 1000;
  park.economy.todayIncome = 1000;
  park.economy.lifetimeIncome = 1000;
  processPaymentIncomeEvents(park, events);
  assert.ok(park.payments.ledger.electronicGross > park.payments.ledger.cashGross);
  assert.ok(park.payments.ledger.electronicFees > 0);
  assert.ok(park.payments.officeVault > 0, "modern mix should still retain some cash");
  assert.equal(park.economy.todayIncome, 1000, "payment method must not change gross sales");
});

test("historical payment state persists in current save schema", () => {
  const park = state("historical-save");
  park.clock.day = 33;
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
  assert.equal(calendarYear(restored), 1988);
});

test("historical economy remains the final additive runtime layer", () => {
  const simulation = read("../src/core/simulation.js");
  const historicalRuntime = read("../src/core/historicalEconomyRuntime.js");
  const main = read("../src/main.js");
  const cashOffice = read("../src/ui/cashOfficeUI.js");

  assert.doesNotMatch(simulation, /historicalEconomy|officeVault|pin-terminals|manualBankRun/);
  assert.match(historicalRuntime, /advanceOneMinuteWithUpgrades/);
  assert.match(historicalRuntime, /processHistoricalEconomyAfterTick/);
  assert.match(historicalRuntime, /weeklyCollectionDue/);
  assert.match(main, /advanceOneMinuteWithHistoricalEconomy/);
  assert.match(main, /simulateMinutesWithHistoricalEconomy/);
  assert.match(main, /CashOfficeUI/);
  assert.match(cashOffice, /Bank now · lose 10%/);
});

test("Cash Office view exposes bank, vault, weekly pickup, payment mix and technology", () => {
  const park = state("cash-office-view");
  const view = getHistoricalEconomyView(park);
  assert.equal(view.calendar.year, 1980);
  assert.equal(view.bankAvailable, park.economy.cash);
  assert.equal(view.officeVault, 0);
  assert.equal(view.collectionIntervalDays, 7);
  assert.equal(view.manualBankRunCut, 0.10);
  assert.equal(view.technology.length, 3);
});
