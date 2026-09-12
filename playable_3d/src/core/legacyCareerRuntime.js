import {
  advanceOneMinuteWithHistoricalEconomy, simulateMinutesWithHistoricalEconomy
} from "./historicalEconomyRuntime.js";
import { normalizeLegacyCareerState, processLegacyCareerProgress } from "./legacyCareer.js";
import { stateHash } from "./random.js";

/**
 * Final career tick:
 * preserved simulation -> research/growth -> upgrades -> historical economy -> Legacy career.
 * Legacy observes committed results and awards career-only style funding; it does not
 * alter ride, service, store, staff, guest or economy mechanics.
 */
export function advanceOneMinuteWithLegacyCareer(state) {
  normalizeLegacyCareerState(state);
  advanceOneMinuteWithHistoricalEconomy(state);
  processLegacyCareerProgress(state);
  if (state.tick % 10 === 0) state.stateHash = stateHash(state);
  return state;
}

export function simulateMinutesWithLegacyCareer(state, minutes) {
  normalizeLegacyCareerState(state);
  for (let index = 0; index < Math.max(0, Math.floor(Number(minutes) || 0)); index += 1) {
    advanceOneMinuteWithLegacyCareer(state);
    if (state.operations?.dayReport) break;
  }
  state.stateHash = stateHash(state);
  return state;
}

/** Kept for A/B verification against the same park without the Legacy layer. */
export const simulateMinutesWithoutLegacyCareer = simulateMinutesWithHistoricalEconomy;
