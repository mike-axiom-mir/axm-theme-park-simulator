import { advanceOneMinuteWithUpgrades, simulateMinutesWithUpgrades } from "./upgradeRuntime.js";
import { stateHash } from "./random.js";
import {
  collectVaultToBank, normalizeHistoricalEconomyState, processHistoricalEconomyAfterTick,
  weeklyCollectionDue
} from "./historicalEconomy.js";

function newEventsSince(state, sequence) {
  return (state.eventLog ?? []).filter((entry) => entry.sequence > sequence);
}

function collectDueVaultBeforeTick(state) {
  normalizeHistoricalEconomyState(state);
  const day = state.clock?.day ?? 1;
  if (!weeklyCollectionDue(state) || state.payments.lastCollectionDay === day) return;
  collectVaultToBank(state, { reason: "weekly-car" });
}

/**
 * Final additive economy tick:
 * preserved simulation -> research/growth -> installed upgrades -> historical payments/cash logistics.
 * Historical payments only classify already-committed guest income and never invent duplicate sales.
 *
 * The playable day-report flow advances `clock.day` through the startNextDay action,
 * so a due weekly collection is checked before the first minute of that operating day.
 */
export function advanceOneMinuteWithHistoricalEconomy(state) {
  normalizeHistoricalEconomyState(state);
  collectDueVaultBeforeTick(state);
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
