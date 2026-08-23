import { advanceOneMinuteWithUpgrades, simulateMinutesWithUpgrades } from "./upgradeRuntime.js";
import { stateHash } from "./random.js";
import {
  normalizeHistoricalEconomyState, processHistoricalEconomyAfterTick
} from "./historicalEconomy.js";

function newEventsSince(state, sequence) {
  return (state.eventLog ?? []).filter((entry) => entry.sequence > sequence);
}

/**
 * Final additive economy tick:
 * preserved simulation -> research/growth -> installed upgrades -> historical payments/cash logistics.
 * Historical payments only classify already-committed guest income and never invent duplicate sales.
 */
export function advanceOneMinuteWithHistoricalEconomy(state) {
  normalizeHistoricalEconomyState(state);
  const eventSequence = state.eventLog?.at(-1)?.sequence ?? 0;

  advanceOneMinuteWithUpgrades(state);

  processHistoricalEconomyAfterTick(state, newEventsSince(state, eventSequence));
  if (state.tick % 10 === 0) state.stateHash = stateHash(state);
  return state;
}

export function simulateMinutesWithHistoricalEconomy(state, minutes) {
  normalizeHistoricalEconomyState(state);
  for (let index = 0; index < Math.max(0, Math.floor(Number(minutes) || 0)); index += 1) {
    advanceOneMinuteWithHistoricalEconomy(state);
    if (state.operations?.dayReport) break;
  }
  state.stateHash = stateHash(state);
  return state;
}

/** Kept available for parity testing against the pre-history final runtime. */
export const simulateMinutesWithoutHistoricalEconomy = simulateMinutesWithUpgrades;
