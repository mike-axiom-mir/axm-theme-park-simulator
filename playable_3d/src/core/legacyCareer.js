import { catalogDefinition } from "./catalog.js";
import { calendarYear, careerOperatingDay, normalizeHistoricalTimeline } from "./historicalTimeline.js";

export const LEGACY_CAREER_SCHEMA = "axm.themepark.legacy-career/v1";
export const LEGACY_OBJECTIVE_AWARD = 250;
export const LEGACY_MAP_COMPLETION_AWARD = 750;
export const LEGACY_ANNUAL_DIVIDEND_CAP = 250;

const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const project = (data) => Object.freeze({ prerequisites: [], ...data });

/**
 * Career-only style research. Functional ride/service/store/staff research stays
 * in research.js and upgrades.js; this ledger never improves operational stats.
 */
export const LEGACY_STYLE_PROJECTS = Object.freeze({
  "signature-dressing": project({
    id: "signature-dressing",
    branch: "Theme craft",
    label: "Signature Dressing",
    cost: 500,
    summary: "Give themed attractions, services, stores and scenery a stronger local identity accent.",
    unlock: "Enhanced themed-entity presentation across all maps."
  }),
  "prestige-frontages": project({
    id: "prestige-frontages",
    branch: "Theme craft",
    label: "Prestige Frontages",
    cost: 750,
    prerequisites: ["signature-dressing"],
    summary: "Add a more deliberate visual gateway/frontage language to established themed districts.",
    unlock: "Persistent prestige frontage dressing for themed lands."
  }),
  "district-finales": project({
    id: "district-finales",
    branch: "Spectacle",
    label: "District Finales",
    cost: 1000,
    prerequisites: ["signature-dressing"],
    summary: "Let an Unleashed district finish with one extra bounded visual finale instead of a gameplay bonus.",
    unlock: "Extra presentation-only finale when a Style Superpower reaches Unleashed."
  }),
  "seasonal-pageantry": project({
    id: "seasonal-pageantry",
    branch: "Spectacle",
    label: "Seasonal Pageantry",
    cost: 1000,
    prerequisites: ["signature-dressing"],
    summary: "Push Halloween, Christmas and New Year lands into fuller festival presentation without calendar-locking them.",
    unlock: "Additional bounded seasonal visual accents."
  }),
  "landmark-masterworks": project({
    id: "landmark-masterworks",
    branch: "Masterworks",
    label: "Landmark Masterworks",
    cost: 1500,
    prerequisites: ["prestige-frontages", "district-finales"],
    summary: "Give mature themed lands a persistent landmark-level identity treatment across the career.",
    unlock: "One bounded presentation-only masterwork marker per styled district."
  })
});

function appendEvent(state, type, subjectId, data = {}) {
  state.eventLog ??= [];
  state.eventLog.push({
    sequence: (state.eventLog.at(-1)?.sequence ?? 0) + 1,
    tick: state.tick ?? 0,
    type,
    subjectId,
    data
  });
  if (state.eventLog.length > 400) state.eventLog.splice(0, state.eventLog.length - 400);
}

function notice(state, text, tone = "info") {
  state.notifications ??= [];
  state.notifications.push({ id: `${state.tick ?? 0}-${state.notifications.length}`, text, tone });
  if (state.notifications.length > 12) state.notifications.shift();
}

export function normalizeLegacyCareerState(state) {
  normalizeHistoricalTimeline(state);
  state.legacy ??= {};
  state.legacy.schema = LEGACY_CAREER_SCHEMA;
  state.legacy.fund = Math.max(0, roundMoney(state.legacy.fund));
  state.legacy.lifetimeEarned = Math.max(state.legacy.fund, roundMoney(state.legacy.lifetimeEarned));
  state.legacy.lifetimeSpent = Math.max(0, roundMoney(state.legacy.lifetimeSpent));
  state.legacy.completedStyleProjects = [...new Set((state.legacy.completedStyleProjects ?? [])
    .filter((id) => LEGACY_STYLE_PROJECTS[id]))];
  state.legacy.rewardedObjectives = [...new Set(state.legacy.rewardedObjectives ?? [])];
  state.legacy.rewardedMaps = [...new Set(state.legacy.rewardedMaps ?? [])];
  state.legacy.dividendYears = [...new Set((state.legacy.dividendYears ?? []).map((year) => Number(year)).filter(Number.isFinite))];
  state.legacy.ledger = {
    objectiveAwards: 0,
    mapAwards: 0,
    performanceDividends: 0,
    ...state.legacy.ledger
  };
  for (const key of Object.keys(state.legacy.ledger)) state.legacy.ledger[key] = Math.max(0, roundMoney(state.legacy.ledger[key]));
  return state;
}

function awardLegacyFund(state, amount, reason, subjectId, ledgerKey) {
  normalizeLegacyCareerState(state);
  const value = Math.max(0, roundMoney(amount));
  if (!value) return 0;
  state.legacy.fund = roundMoney(state.legacy.fund + value);
  state.legacy.lifetimeEarned = roundMoney(state.legacy.lifetimeEarned + value);
  state.legacy.ledger[ledgerKey] = roundMoney((state.legacy.ledger[ledgerKey] ?? 0) + value);
  appendEvent(state, "legacy.fund.awarded", subjectId, {
    amount: value,
    reason,
    fund: state.legacy.fund,
    year: calendarYear(state),
    careerOperatingDay: careerOperatingDay(state)
  });
  return value;
}

export function estimateParkValue(state) {
  normalizeLegacyCareerState(state);
  let value = Math.max(0, Number(state.economy?.cash) || 0) + Math.max(0, Number(state.payments?.officeVault) || 0);
  for (const entity of state.world?.entities ?? []) {
    const definition = catalogDefinition(entity.catalogId);
    const base = Math.max(0, Number(definition.cost) || 0);
    const condition = clamp((Number(entity.condition) || 100) / 100, 0.25, 1);
    const evolution = 1 + Math.min(0.15, Math.max(0, Number(entity.evolutionLevel) || 0) * 0.05);
    value += base * 0.5 * condition * evolution;
  }
  return Math.max(0, Math.round(value));
}

export function performanceDividend(state) {
  normalizeLegacyCareerState(state);
  const parkValue = estimateParkValue(state);
  const netFinance = Math.max(0,
    (Number(state.economy?.lifetimeIncome) || 0) - (Number(state.economy?.lifetimeCosts) || 0));
  const raw = parkValue * 0.0015 + netFinance * 0.0005;
  return Math.min(LEGACY_ANNUAL_DIVIDEND_CAP, Math.max(0, Math.floor(raw / 25) * 25));
}

function objectiveRewardKey(state, objectiveId) {
  const mapId = state.history?.activeMapId ?? state.campaign?.id ?? "park-map";
  return `${mapId}:${objectiveId}`;
}

function mapRewardKey(state) {
  const mapId = state.history?.activeMapId ?? state.campaign?.id ?? "park-map";
  return `${mapId}:${state.park?.selectedEnding ?? "completed"}`;
}

/**
 * Idempotent career reward processor. Safe to call after every committed minute
 * and player action; each reward has a durable key so no loop can mint it twice.
 */
export function processLegacyCareerProgress(state) {
  normalizeLegacyCareerState(state);
  let awarded = 0;

  for (const objective of state.campaign?.objectives ?? []) {
    if (!objective.complete) continue;
    const key = objectiveRewardKey(state, objective.id);
    if (state.legacy.rewardedObjectives.includes(key)) continue;
    state.legacy.rewardedObjectives.push(key);
    awarded += awardLegacyFund(state, LEGACY_OBJECTIVE_AWARD,
      `Completed goal: ${objective.label}`, key, "objectiveAwards");
    notice(state, `Legacy Fund +€${LEGACY_OBJECTIVE_AWARD} · ${objective.label}`, "good");
  }

  if (state.campaign?.completed) {
    const key = mapRewardKey(state);
    if (!state.legacy.rewardedMaps.includes(key)) {
      state.legacy.rewardedMaps.push(key);
      awarded += awardLegacyFund(state, LEGACY_MAP_COMPLETION_AWARD,
        `Completed map campaign: ${state.campaign.title ?? key}`, key, "mapAwards");
      notice(state, `Legacy Fund +€${LEGACY_MAP_COMPLETION_AWARD} · map campaign complete`, "story");
    }
  }

  const year = calendarYear(state);
  if (year > (state.history?.startYear ?? 1980) && !state.legacy.dividendYears.includes(year)) {
    state.legacy.dividendYears.push(year);
    const dividend = performanceDividend(state);
    if (dividend > 0) {
      awarded += awardLegacyFund(state, dividend,
        `Annual finance + park-value dividend for ${year}`, `year-${year}`, "performanceDividends");
      notice(state, `${year} Legacy dividend +€${dividend} · finance + park value`, "good");
    }
  }

  return awarded;
}

export function legacyStyleProjectView(state, projectId) {
  normalizeLegacyCareerState(state);
  const definition = LEGACY_STYLE_PROJECTS[projectId];
  if (!definition) return null;
  const completed = state.legacy.completedStyleProjects.includes(projectId);
  const prerequisitesMet = definition.prerequisites.every((id) => state.legacy.completedStyleProjects.includes(id));
  const affordable = state.legacy.fund >= definition.cost;
  return Object.freeze({
    ...definition,
    completed,
    prerequisitesMet,
    affordable,
    canComplete: !completed && prerequisitesMet && affordable
  });
}

export function legacyStyleCapabilities(state) {
  normalizeLegacyCareerState(state);
  const completed = new Set(state.legacy.completedStyleProjects);
  return Object.freeze({
    signatureDressing: completed.has("signature-dressing"),
    prestigeFrontages: completed.has("prestige-frontages"),
    districtFinales: completed.has("district-finales"),
    seasonalPageantry: completed.has("seasonal-pageantry"),
    landmarkMasterworks: completed.has("landmark-masterworks")
  });
}

function completeLegacyStyleProject(state, projectId) {
  normalizeLegacyCareerState(state);
  const view = legacyStyleProjectView(state, projectId);
  if (!view) return { ok: false, reason: "Unknown Legacy style research." };
  if (view.completed) return { ok: false, reason: `${view.label} is already part of the career.` };
  if (!view.prerequisitesMet) return { ok: false, reason: "Earlier Legacy style craft is required first." };
  if (!view.affordable) return { ok: false, reason: `Need €${view.cost} in the Legacy Fund.` };
  state.legacy.fund = roundMoney(state.legacy.fund - view.cost);
  state.legacy.lifetimeSpent = roundMoney(state.legacy.lifetimeSpent + view.cost);
  state.legacy.completedStyleProjects.push(projectId);
  appendEvent(state, "legacy.style_project.completed", "career", {
    projectId,
    cost: view.cost,
    remainingFund: state.legacy.fund
  });
  return { ok: true, message: `${view.label} added to the permanent career style toolkit.` };
}

export function applyLegacyCareerAction(state, action = {}) {
  if (action.type === "completeLegacyStyleProject") return completeLegacyStyleProject(state, action.projectId);
  return { ok: false, reason: "Unknown Legacy career action." };
}

export function getLegacyCareerView(state) {
  normalizeLegacyCareerState(state);
  return Object.freeze({
    schema: LEGACY_CAREER_SCHEMA,
    fund: state.legacy.fund,
    lifetimeEarned: state.legacy.lifetimeEarned,
    lifetimeSpent: state.legacy.lifetimeSpent,
    parkValue: estimateParkValue(state),
    nextPerformanceDividend: performanceDividend(state),
    year: calendarYear(state),
    rewardedGoalCount: state.legacy.rewardedObjectives.length,
    rewardedMapCount: state.legacy.rewardedMaps.length,
    ledger: Object.freeze({ ...state.legacy.ledger }),
    capabilities: legacyStyleCapabilities(state),
    projects: Object.freeze(Object.keys(LEGACY_STYLE_PROJECTS).map((id) => legacyStyleProjectView(state, id)))
  });
}
