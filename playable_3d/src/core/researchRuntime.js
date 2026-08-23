import { advanceOneMinute, simulateMinutes } from "./simulation.js";
import { catalogDefinition } from "./catalog.js";
import { stateHash } from "./random.js";
import {
  addResearchEvidence, normalizeEntityResearchGrowth, normalizeResearchState,
  parkResearchModifier, processResearchEvents
} from "./research.js";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const roundMoney = (value) => Math.round(value * 100) / 100;

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

function refund(state, amount, label, subjectId = "park") {
  const value = Math.max(0, roundMoney(amount));
  if (!value) return 0;
  state.economy.cash = roundMoney(state.economy.cash + value);
  state.economy.todayCosts = roundMoney(Math.max(0, (state.economy.todayCosts ?? 0) - value));
  state.economy.lifetimeCosts = roundMoney(Math.max(0, (state.economy.lifetimeCosts ?? 0) - value));
  appendEvent(state, "research.efficiency.rebate", subjectId, { amount: value, label });
  return value;
}

function applyNewGuestGrowth(state, events) {
  const modifier = parkResearchModifier(state);
  if (!modifier.newGuestPatience && !modifier.newGuestStay) return;
  for (const entry of events) {
    if (entry.type !== "visitor.entered") continue;
    const visitor = state.visitors.find((item) => item.id === entry.subjectId);
    if (!visitor) continue;
    visitor.patience = Math.min(120, (visitor.patience ?? 48) + modifier.newGuestPatience);
    visitor.stayRemaining = Math.min(480, (visitor.stayRemaining ?? 240) + modifier.newGuestStay);
  }
}

function applyEntityGrowth(state, before, events) {
  const completedRideIds = new Set(events
    .filter((entry) => entry.type === "ride.cycle.completed")
    .map((entry) => entry.subjectId));

  for (const entity of state.world?.entities ?? []) {
    const prior = before.get(entity.id);
    if (!prior) continue;
    const definition = catalogDefinition(entity.catalogId);
    const growth = normalizeEntityResearchGrowth(entity);

    if ((definition.kind === "ride" || definition.kind === "service" || definition.need === "rest")
      && growth.throughput > 0 && entity.cycleRemaining > 1) {
      const cadence = growth.throughput >= 2 ? 2 : 4;
      if (state.tick % cadence === 0) entity.cycleRemaining = Math.max(1, entity.cycleRemaining - 1);
    }

    if (definition.kind === "ride" && growth.reliability > 0 && entity.condition < prior.condition) {
      const wear = prior.condition - entity.condition;
      const protectedShare = growth.reliability >= 2 ? 0.5 : 0.3;
      entity.condition = Math.min(prior.condition, entity.condition + wear * protectedShare);
    }

    if (definition.kind === "ride" && growth.experience > 0 && completedRideIds.has(entity.id)) {
      const bonus = growth.experience;
      for (const visitorId of prior.riders) {
        const visitor = state.visitors.find((item) => item.id === visitorId);
        if (!visitor) continue;
        visitor.happiness = clamp(visitor.happiness + bonus);
        visitor.lastThought = `${definition.label} felt especially polished today.`;
      }
    }

    const serviceCompleted = prior.cycleRemaining === 1 && prior.riders.length > 0
      && (definition.kind === "service" || definition.need === "rest");
    if (serviceCompleted) {
      const evidence = definition.category === "Stores"
        ? { services: 1, commerce: 1 } : { services: 1 };
      addResearchEvidence(state, evidence, 1);
      if (growth.quality > 0) {
        for (const visitorId of prior.riders) {
          const visitor = state.visitors.find((item) => item.id === visitorId);
          if (!visitor) continue;
          visitor.happiness = clamp(visitor.happiness + growth.quality);
          visitor.lastThought = `${definition.label} handled the little details well.`;
        }
      }
    }

    const operatingDelta = Math.max(0, (entity.operatingSpend ?? 0) - prior.operatingSpend);
    if (operatingDelta > 0 && growth.efficiency > 0) {
      const rate = growth.efficiency >= 2 ? 0.2 : 0.1;
      refund(state, operatingDelta * rate, `${definition.label} efficiency`, entity.id);
    }
  }
}

function applyParkGrowth(state, events) {
  const modifier = parkResearchModifier(state);
  if (modifier.hourlyOperationsRebate > 0) {
    const hourly = events.filter((entry) => entry.type === "economy.cost"
      && entry.data?.label === "Hourly operations and staff");
    for (const entry of hourly) {
      refund(state, Number(entry.data?.amount || 0) * modifier.hourlyOperationsRebate,
        "Park Operations growth", state.park.id);
    }
  }

  if (state.tick % 5 === 0) {
    state.metrics.reachableDemand = Math.min(1, (state.metrics.reachableDemand ?? 0) + modifier.demandBonus);
    state.park.rating = Math.min(100, Math.round((state.park.rating ?? 0) + modifier.ratingBonus));
  }
}

/**
 * Additive deterministic wrapper over the preserved v0.4.6 minute tick.
 * The base simulation remains untouched; research observes committed events and
 * applies explicit, bounded growth effects afterward.
 */
export function advanceOneMinuteWithResearch(state) {
  normalizeResearchState(state);
  const eventSequence = state.eventLog?.at(-1)?.sequence ?? 0;
  const before = entitySnapshot(state);

  advanceOneMinute(state);

  const events = newEventsSince(state, eventSequence);
  const earned = processResearchEvents(state);
  applyNewGuestGrowth(state, events);
  applyEntityGrowth(state, before, events);
  applyParkGrowth(state, events);

  if (earned > 0) {
    appendEvent(state, "research.insight.gained", state.park.id, {
      amount: earned,
      total: state.research.insight
    });
  }
  if (state.tick % 10 === 0) state.stateHash = stateHash(state);
  return state;
}

export function simulateMinutesWithResearch(state, minutes) {
  normalizeResearchState(state);
  for (let index = 0; index < minutes; index += 1) advanceOneMinuteWithResearch(state);
  state.stateHash = stateHash(state);
  return state;
}

/** Kept available for parity tests against the preserved baseline. */
export const simulateMinutesWithoutResearch = simulateMinutes;
