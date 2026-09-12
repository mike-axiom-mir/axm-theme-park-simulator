import { appendRetainedEvent } from "./eventStream.js";
import { hashString } from "./random.js";
import {
  advanceCareerOperatingDay, calendarView, calendarYear, careerOperatingDay,
  normalizeHistoricalTimeline
} from "./historicalTimeline.js";

export const HISTORICAL_ECONOMY_SCHEMA = "axm.themepark.historical-payments/v1";
export const CASH_COLLECTION_INTERVAL_DAYS = 7;
export const MANUAL_BANK_RUN_CUT = 0.10;
export const MANUAL_BANK_RUN_MINUTES = 90;

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;

const technology = (data) => Object.freeze({ prerequisites: [], requires: {}, ...data });

export const PAYMENT_TECHNOLOGY = Object.freeze({
  "pin-terminals": technology({
    id: "pin-terminals",
    label: "PIN / Debit Terminals",
    minYear: 1988,
    cost: 2,
    requires: { commerce: 6, operations: 3 },
    summary: "Introduce early electronic debit acceptance at selected park points.",
    unlock: "Up to 25% electronic-payment acceptance, limited by the era's visitor preference."
  }),
  "park-pin-network": technology({
    id: "park-pin-network",
    label: "Park-wide PIN Network",
    minYear: 1996,
    cost: 4,
    prerequisites: ["pin-terminals"],
    requires: { commerce: 14, services: 8, operations: 6 },
    summary: "Connect admissions, rides and active service counters to a wider debit network.",
    unlock: "Up to 70% electronic-payment acceptance, limited by market preference."
  }),
  "contactless-payments": technology({
    id: "contactless-payments",
    label: "Contactless Checkout",
    minYear: 2014,
    cost: 5,
    prerequisites: ["park-pin-network"],
    requires: { commerce: 22, services: 14, operations: 10 },
    summary: "Adopt tap/contactless acceptance once the technology reaches the market.",
    unlock: "The park can follow the full era-appropriate electronic-payment share."
  })
});

const MARKET_ELECTRONIC_SHARE = Object.freeze([
  [1980, 0.00],
  [1988, 0.02],
  [1992, 0.04],
  [2000, 0.20],
  [2005, 0.32],
  [2010, 0.43],
  [2015, 0.50],
  [2020, 0.72],
  [2025, 0.83],
  [2035, 0.90]
]);

const GUEST_PAYMENT_LABELS = new Set(["Admission", "Ride ticket", "Service sale"]);

function appendEvent(state, type, subjectId, data = {}) {
  return appendRetainedEvent(state, {
    tick: state.tick ?? 0, type, subjectId, data
  });
}

function notice(state, text, tone = "info") {
  state.notifications ??= [];
  state.notifications.push({ id: `${state.tick ?? 0}-${state.notifications.length}`, text, tone });
  if (state.notifications.length > 12) state.notifications.shift();
}

export function normalizeHistoricalEconomyState(state) {
  normalizeHistoricalTimeline(state);
  state.payments ??= {};
  state.payments.schema = HISTORICAL_ECONOMY_SCHEMA;
  state.payments.officeVault = Math.max(0, roundMoney(state.payments.officeVault));
  state.payments.completedTechnology = [...new Set((state.payments.completedTechnology ?? [])
    .filter((id) => PAYMENT_TECHNOLOGY[id]))];
  state.payments.lastObservedYear = integer(state.payments.lastObservedYear, calendarYear(state));
  state.payments.lastCollectionDay = Math.max(0, integer(state.payments.lastCollectionDay));
  state.payments.ledger = {
    cashGross: 0,
    electronicGross: 0,
    electronicFees: 0,
    weeklyCollections: 0,
    manualBankRuns: 0,
    manualBankCuts: 0,
    ...state.payments.ledger
  };
  for (const key of Object.keys(state.payments.ledger)) {
    state.payments.ledger[key] = Math.max(0, roundMoney(state.payments.ledger[key]));
  }
  state.payments.today = {
    day: state.clock?.day ?? 1,
    cashGross: 0,
    electronicGross: 0,
    electronicFees: 0,
    ...state.payments.today
  };
  if (state.payments.today.day !== (state.clock?.day ?? 1)) {
    state.payments.today = {
      day: state.clock?.day ?? 1,
      cashGross: 0,
      electronicGross: 0,
      electronicFees: 0
    };
  }
  return state;
}

export function marketElectronicShare(year) {
  const y = Number(year) || 1980;
  if (y <= MARKET_ELECTRONIC_SHARE[0][0]) return MARKET_ELECTRONIC_SHARE[0][1];
  for (let index = 1; index < MARKET_ELECTRONIC_SHARE.length; index += 1) {
    const [rightYear, rightShare] = MARKET_ELECTRONIC_SHARE[index];
    const [leftYear, leftShare] = MARKET_ELECTRONIC_SHARE[index - 1];
    if (y > rightYear) continue;
    const span = Math.max(1, rightYear - leftYear);
    const progress = clamp((y - leftYear) / span);
    return leftShare + (rightShare - leftShare) * progress;
  }
  return MARKET_ELECTRONIC_SHARE.at(-1)[1];
}

export function electronicAcceptanceCap(state) {
  normalizeHistoricalEconomyState(state);
  const completed = new Set(state.payments.completedTechnology);
  if (completed.has("contactless-payments")) return 1;
  if (completed.has("park-pin-network")) return 0.70;
  if (completed.has("pin-terminals")) return 0.25;
  return 0;
}

export function acceptedElectronicShare(state) {
  return Math.min(marketElectronicShare(calendarYear(state)), electronicAcceptanceCap(state));
}

export function electronicFeeRate(state) {
  const year = calendarYear(state);
  if (year < 2000) return 0.006;
  if (year < 2014) return 0.0045;
  return 0.003;
}

function deterministicElectronic(event, share, year) {
  if (share <= 0) return false;
  if (share >= 1) return true;
  const token = `${event.sequence}:${event.subjectId}:${event.data?.label}:${event.data?.amount}:${year}`;
  const value = (hashString(token) >>> 0) / 0xffffffff;
  return value < share;
}

function recordCash(state, event, amount) {
  state.economy.cash = roundMoney((state.economy.cash ?? 0) - amount);
  state.payments.officeVault = roundMoney(state.payments.officeVault + amount);
  state.payments.today.cashGross = roundMoney(state.payments.today.cashGross + amount);
  state.payments.ledger.cashGross = roundMoney(state.payments.ledger.cashGross + amount);
  appendEvent(state, "payment.cash.to_vault", event.subjectId, {
    amount,
    sourceLabel: event.data?.label,
    officeVault: state.payments.officeVault
  });
}

function recordElectronic(state, event, amount) {
  const rate = electronicFeeRate(state);
  const fee = Math.min(amount, Math.max(0.01, roundMoney(amount * rate)));
  state.economy.cash = roundMoney((state.economy.cash ?? 0) - fee);
  state.economy.todayCosts = roundMoney((state.economy.todayCosts ?? 0) + fee);
  state.economy.lifetimeCosts = roundMoney((state.economy.lifetimeCosts ?? 0) + fee);
  state.payments.today.electronicGross = roundMoney(state.payments.today.electronicGross + amount);
  state.payments.today.electronicFees = roundMoney(state.payments.today.electronicFees + fee);
  state.payments.ledger.electronicGross = roundMoney(state.payments.ledger.electronicGross + amount);
  state.payments.ledger.electronicFees = roundMoney(state.payments.ledger.electronicFees + fee);
  appendEvent(state, "payment.electronic.settled", event.subjectId, {
    amount,
    fee,
    feeRate: rate,
    sourceLabel: event.data?.label,
    eraLabel: calendarYear(state) >= 2014 ? "card/contactless" : "PIN/debit"
  });
}

export function processPaymentIncomeEvents(state, events = []) {
  normalizeHistoricalEconomyState(state);
  const year = calendarYear(state);
  const share = acceptedElectronicShare(state);
  for (const entry of events) {
    if (entry.type !== "economy.income" || !GUEST_PAYMENT_LABELS.has(entry.data?.label)) continue;
    const amount = Math.max(0, roundMoney(entry.data?.amount));
    if (!amount) continue;
    if (deterministicElectronic(entry, share, year)) recordElectronic(state, entry, amount);
    else recordCash(state, entry, amount);
  }
  return state;
}

export function weeklyCollectionDue(state) {
  const day = careerOperatingDay(state);
  return day > 1 && (day - 1) % CASH_COLLECTION_INTERVAL_DAYS === 0;
}

export function daysUntilWeeklyCollection(state) {
  const day = careerOperatingDay(state);
  const elapsed = (day - 1) % CASH_COLLECTION_INTERVAL_DAYS;
  return elapsed === 0 && day > 1 ? CASH_COLLECTION_INTERVAL_DAYS : CASH_COLLECTION_INTERVAL_DAYS - elapsed;
}

export function collectVaultToBank(state, { reason = "weekly-car" } = {}) {
  normalizeHistoricalEconomyState(state);
  const amount = Math.max(0, roundMoney(state.payments.officeVault));
  if (!amount) return 0;
  state.payments.officeVault = 0;
  state.economy.cash = roundMoney((state.economy.cash ?? 0) + amount);
  state.payments.lastCollectionDay = careerOperatingDay(state);
  if (reason === "weekly-car") state.payments.ledger.weeklyCollections += 1;
  appendEvent(state, reason === "weekly-car" ? "payment.cash.weekly_collection" : "payment.cash.bank_deposit",
    "park-office-vault", { amount, reason, careerOperatingDay: careerOperatingDay(state) });
  if (reason === "weekly-car") notice(state, `Weekly cash collection deposited €${amount.toFixed(2)} into the park bank account.`, "good");
  return amount;
}

function observeYearChange(state) {
  normalizeHistoricalEconomyState(state);
  const year = calendarYear(state);
  if (year === state.payments.lastObservedYear) return;
  state.payments.lastObservedYear = year;
  appendEvent(state, "timeline.year.started", "park", { year, careerOperatingDay: careerOperatingDay(state) });
  const newlyAvailable = Object.values(PAYMENT_TECHNOLOGY)
    .filter((item) => item.minYear === year && !state.payments.completedTechnology.includes(item.id));
  if (newlyAvailable.length) {
    notice(state, `${year}: ${newlyAvailable.map((item) => item.label).join(" + ")} can now be researched.`, "story");
  }
}

/**
 * Historical operating days belong to the whole career. Map-local Day 1 may be
 * restarted by a scenario loader without resetting this counter, the year or the
 * weekly cash-truck rhythm.
 */
export function processHistoricalOperatingDayTransition(state, { source = "operating-day" } = {}) {
  normalizeHistoricalEconomyState(state);
  const transition = advanceCareerOperatingDay(state, { source });
  appendEvent(state, "timeline.career_operating_day.started", "park", transition);
  observeYearChange(state);
  if (weeklyCollectionDue(state) && state.payments.lastCollectionDay !== careerOperatingDay(state)) {
    collectVaultToBank(state, { reason: "weekly-car" });
  }
  return transition;
}

export function processHistoricalEconomyAfterTick(state, events = []) {
  normalizeHistoricalEconomyState(state);
  processPaymentIncomeEvents(state, events);
  if (events.some((entry) => entry.type === "clock.day.started")) {
    processHistoricalOperatingDayTransition(state, { source: "clock.day.started" });
  } else {
    observeYearChange(state);
  }
  return state;
}

export function paymentTechnologyView(state, technologyId) {
  normalizeHistoricalEconomyState(state);
  const definition = PAYMENT_TECHNOLOGY[technologyId];
  if (!definition) return null;
  const year = calendarYear(state);
  const completed = state.payments.completedTechnology.includes(technologyId);
  const prerequisitesMet = definition.prerequisites.every((id) => state.payments.completedTechnology.includes(id));
  const evidence = state.research?.evidence ?? {};
  const evidenceMet = Object.entries(definition.requires).every(([channel, amount]) => (evidence[channel] ?? 0) >= amount);
  const insight = Math.max(0, Number(state.research?.insight) || 0);
  const yearMet = year >= definition.minYear;
  const affordable = insight >= definition.cost;
  return Object.freeze({
    ...definition,
    completed,
    year,
    yearMet,
    prerequisitesMet,
    evidenceMet,
    affordable,
    canComplete: !completed && yearMet && prerequisitesMet && evidenceMet && affordable,
    evidence: Object.freeze(Object.fromEntries(Object.entries(definition.requires)
      .map(([channel, required]) => [channel, Object.freeze({ current: evidence[channel] ?? 0, required })])))
  });
}

export function getPaymentTechnologyView(state) {
  return Object.freeze(Object.keys(PAYMENT_TECHNOLOGY).map((id) => paymentTechnologyView(state, id)));
}

function completePaymentTechnology(state, technologyId) {
  normalizeHistoricalEconomyState(state);
  const view = paymentTechnologyView(state, technologyId);
  if (!view) return { ok: false, reason: "Unknown payment technology." };
  if (view.completed) return { ok: false, reason: `${view.label} is already installed.` };
  if (!view.yearMet) return { ok: false, reason: `${view.label} is not available until ${view.minYear}.` };
  if (!view.prerequisitesMet) return { ok: false, reason: "Earlier payment infrastructure is required first." };
  if (!view.evidenceMet) return { ok: false, reason: "Run more commerce and operations to gather evidence first." };
  if (!view.affordable) return { ok: false, reason: `Need ${view.cost} research insight.` };
  state.research.insight -= view.cost;
  state.payments.completedTechnology.push(technologyId);
  appendEvent(state, "payment.technology.completed", "park", { technologyId, year: view.year, insightCost: view.cost });
  return { ok: true, message: `${view.label} adopted · electronic acceptance can now grow with the era.` };
}

function manualBankRun(state) {
  normalizeHistoricalEconomyState(state);
  const gross = Math.max(0, roundMoney(state.payments.officeVault));
  if (!gross) return { ok: false, reason: "The office vault is empty." };
  const cut = roundMoney(gross * MANUAL_BANK_RUN_CUT);
  const net = roundMoney(gross - cut);
  state.payments.officeVault = 0;
  state.economy.cash = roundMoney((state.economy.cash ?? 0) + net);
  state.economy.todayCosts = roundMoney((state.economy.todayCosts ?? 0) + cut);
  state.economy.lifetimeCosts = roundMoney((state.economy.lifetimeCosts ?? 0) + cut);
  state.payments.ledger.manualBankRuns += 1;
  state.payments.ledger.manualBankCuts = roundMoney(state.payments.ledger.manualBankCuts + cut);
  appendEvent(state, "payment.cash.manual_bank_run", "park-office-vault", {
    gross,
    cut,
    net,
    timeCostMinutes: MANUAL_BANK_RUN_MINUTES
  });
  return {
    ok: true,
    message: `Bank run deposited €${net.toFixed(2)} · €${cut.toFixed(2)} lost to the 10% early-deposit cut · ${MANUAL_BANK_RUN_MINUTES} minutes pass.`,
    timeCostMinutes: MANUAL_BANK_RUN_MINUTES
  };
}

export function applyHistoricalEconomyAction(state, action = {}) {
  if (action.type === "completePaymentTechnology") return completePaymentTechnology(state, action.technologyId);
  if (action.type === "manualBankRun") return manualBankRun(state);
  return { ok: false, reason: "Unknown historical economy action." };
}

export function getHistoricalEconomyView(state) {
  normalizeHistoricalEconomyState(state);
  const calendar = calendarView(state);
  const marketShare = marketElectronicShare(calendar.year);
  const acceptedShare = acceptedElectronicShare(state);
  return Object.freeze({
    schema: HISTORICAL_ECONOMY_SCHEMA,
    calendar,
    bankAvailable: roundMoney(state.economy?.cash),
    officeVault: roundMoney(state.payments.officeVault),
    nextCollectionInDays: daysUntilWeeklyCollection(state),
    collectionIntervalDays: CASH_COLLECTION_INTERVAL_DAYS,
    manualBankRunCut: MANUAL_BANK_RUN_CUT,
    manualBankRunMinutes: MANUAL_BANK_RUN_MINUTES,
    marketElectronicShare: marketShare,
    acceptedElectronicShare: acceptedShare,
    electronicFeeRate: electronicFeeRate(state),
    electronicLabel: calendar.year >= 2014 ? "card/contactless" : "PIN/debit",
    today: Object.freeze({ ...state.payments.today }),
    ledger: Object.freeze({ ...state.payments.ledger }),
    completedTechnology: Object.freeze([...state.payments.completedTechnology]),
    technology: getPaymentTechnologyView(state)
  });
}
