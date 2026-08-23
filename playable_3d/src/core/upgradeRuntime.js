import { catalogDefinition } from "./catalog.js";
import { advanceOneMinuteWithResearch, simulateMinutesWithResearch } from "./researchRuntime.js";
import { stateHash } from "./random.js";
import { washLitter } from "./staff.js";
import {
  hasEntityUpgrade, normalizeUpgradeState, upgradeFamiliesForDefinition, upgradeModifierSummary
} from "./upgrades.js";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

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

function refundCost(state, amount, label, subjectId = "park") {
  const value = Math.max(0, roundMoney(amount));
  if (!value) return 0;
  state.economy.cash = roundMoney((state.economy.cash ?? 0) + value);
  state.economy.todayCosts = roundMoney(Math.max(0, (state.economy.todayCosts ?? 0) - value));
  state.economy.lifetimeCosts = roundMoney(Math.max(0, (state.economy.lifetimeCosts ?? 0) - value));
  appendEvent(state, "upgrade.efficiency.rebate", subjectId, { amount: value, label });
  return value;
}

function entitySnapshot(state) {
  return new Map((state.world?.entities ?? []).map((entity) => [entity.id, {
    condition: Number(entity.condition) || 0,
    cycleRemaining: Number(entity.cycleRemaining) || 0,
    riders: [...(entity.riders ?? [])],
    operatingSpend: Number(entity.operatingSpend) || 0
  }]));
}

function newEventsSince(state, sequence) {
  return (state.eventLog ?? []).filter((entry) => entry.sequence > sequence);
}

function applyNewGuestUpgrades(state, events, modifier) {
  if (!modifier.newGuestPatience && !modifier.newGuestStay && !modifier.newGuestHappiness) return;
  for (const entry of events) {
    if (entry.type !== "visitor.entered") continue;
    const visitor = state.visitors.find((item) => item.id === entry.subjectId);
    if (!visitor) continue;
    visitor.patience = Math.min(120, (visitor.patience ?? 48) + modifier.newGuestPatience);
    visitor.stayRemaining = Math.min(480, (visitor.stayRemaining ?? 240) + modifier.newGuestStay);
    visitor.happiness = clamp(visitor.happiness + modifier.newGuestHappiness);
  }
}

function applyRideCompletionModules(state, entity, definition, prior, completedRideIds) {
  if (!completedRideIds.has(entity.id) || !prior.riders.length) return;
  const families = upgradeFamiliesForDefinition(definition);
  for (const visitorId of prior.riders) {
    const visitor = state.visitors.find((item) => item.id === visitorId);
    if (!visitor) continue;
    if (hasEntityUpgrade(entity, "comfort-package")) {
      visitor.happiness = clamp(visitor.happiness + 1);
      visitor.energy = Math.min(1, (visitor.energy ?? 0) + 0.02);
      visitor.lastThought = `${definition.label} felt comfortable and well put together.`;
    }
    if (families.includes("indoor") && hasEntityUpgrade(entity, "scene-sequencer")) {
      visitor.happiness = clamp(visitor.happiness + 2);
      visitor.lastThought = `${definition.label}'s scenes landed at just the right moments.`;
    }
    if (families.includes("scenic") && hasEntityUpgrade(entity, "panorama-audio")
      && ["explorer", "local"].includes(visitor.segment)) {
      visitor.happiness = clamp(visitor.happiness + 2);
      visitor.lastThought = `${definition.label} made the park feel like a place worth exploring.`;
    }
  }
}

function applyServiceCompletionModules(state, entity, definition, prior) {
  const completed = prior.cycleRemaining === 1 && prior.riders.length > 0
    && (definition.kind === "service" || definition.need === "rest");
  if (!completed || !hasEntityUpgrade(entity, "hospitality-counter")) return;
  for (const visitorId of prior.riders) {
    const visitor = state.visitors.find((item) => item.id === visitorId);
    if (!visitor) continue;
    visitor.happiness = clamp(visitor.happiness + 1);
    visitor.lastThought = `${definition.label} was simple and pleasant to use.`;
  }
}

function applyEntityModules(state, before, events) {
  const completedRideIds = new Set(events
    .filter((entry) => entry.type === "ride.cycle.completed")
    .map((entry) => entry.subjectId));

  for (const entity of state.world?.entities ?? []) {
    const prior = before.get(entity.id);
    if (!prior || !(entity.installedUpgrades?.length)) continue;
    const definition = catalogDefinition(entity.catalogId);

    if (definition.kind === "ride" && hasEntityUpgrade(entity, "quick-load-gate") && entity.cycleRemaining > 1
      && state.tick % 6 === 0) {
      entity.cycleRemaining = Math.max(1, entity.cycleRemaining - 1);
    }
    if (definition.kind === "ride" && hasEntityUpgrade(entity, "condition-sensors") && entity.condition < prior.condition) {
      const wear = prior.condition - entity.condition;
      entity.condition = Math.min(prior.condition, entity.condition + wear * 0.15);
    }

    applyRideCompletionModules(state, entity, definition, prior, completedRideIds);

    if (definition.kind === "service" && hasEntityUpgrade(entity, "twin-counter") && entity.cycleRemaining > 1
      && state.tick % 6 === 0) {
      entity.cycleRemaining = Math.max(1, entity.cycleRemaining - 1);
    }
    applyServiceCompletionModules(state, entity, definition, prior);

    const operatingDelta = Math.max(0, (entity.operatingSpend ?? 0) - prior.operatingSpend);
    if (operatingDelta > 0 && hasEntityUpgrade(entity, "smart-meter")) {
      refundCost(state, operatingDelta * 0.08, `${definition.label} Smart Meter`, entity.id);
    }
  }
}

function applyParkModules(state, events, modifier, litterBefore) {
  if (modifier.hourlyRebate > 0) {
    for (const entry of events) {
      if (entry.type !== "economy.cost" || entry.data?.label !== "Hourly operations and staff") continue;
      refundCost(state, Number(entry.data?.amount || 0) * modifier.hourlyRebate, "Energy Loop", state.park.id);
    }
  }

  if (modifier.staffRadio && state.tick % 2 === 0) {
    for (const agent of state.staffAgents ?? []) {
      if ((agent.cooldown ?? 0) > 0) agent.cooldown = Math.max(0, agent.cooldown - 1);
    }
  }

  if (modifier.litterCapture > 0) {
    const newLitter = Math.max(0, (state.park.litter ?? 0) - litterBefore);
    const captured = newLitter * modifier.litterCapture;
    if (captured > 0) {
      const removed = washLitter(state, captured);
      if (removed > 0) appendEvent(state, "upgrade.recycling.captured", state.park.id, { amount: removed });
    }
  }

  if (state.tick % 5 === 0) {
    let demandBonus = modifier.baseDemandBonus;
    let ratingBonus = modifier.baseRatingBonus;
    if (state.weather?.type === "rain") demandBonus += modifier.rainDemandRecovery;
    if ((state.clock?.minute ?? 0) >= 18 * 60) {
      demandBonus += modifier.eveningDemandBonus;
      ratingBonus += modifier.eveningRatingBonus;
    }
    state.metrics.reachableDemand = Math.min(1, (state.metrics.reachableDemand ?? 0) + demandBonus);
    state.park.rating = Math.min(100, Math.round((state.park.rating ?? 0) + ratingBonus));
  }
}

/**
 * Final additive playable tick: preserved simulation -> research/growth wrapper -> installed upgrades.
 * Upgrade effects only inspect committed state/events and never replace base simulation ownership.
 */
export function advanceOneMinuteWithUpgrades(state) {
  normalizeUpgradeState(state);
  const eventSequence = state.eventLog?.at(-1)?.sequence ?? 0;
  const before = entitySnapshot(state);
  const litterBefore = Number(state.park?.litter) || 0;

  advanceOneMinuteWithResearch(state);

  const events = newEventsSince(state, eventSequence);
  const modifier = upgradeModifierSummary(state);
  applyNewGuestUpgrades(state, events, modifier);
  applyEntityModules(state, before, events);
  applyParkModules(state, events, modifier, litterBefore);

  if (state.tick % 10 === 0) state.stateHash = stateHash(state);
  return state;
}

export function simulateMinutesWithUpgrades(state, minutes) {
  normalizeUpgradeState(state);
  for (let index = 0; index < minutes; index += 1) advanceOneMinuteWithUpgrades(state);
  state.stateHash = stateHash(state);
  return state;
}

/** Kept available for A/B testing against research-without-upgrades. */
export const simulateMinutesWithoutUpgrades = simulateMinutesWithResearch;
