import { stateHash } from "./random.js";
import { CAMPAIGN_LEVELS, catalogDefinition, catalogIdsThroughLevel } from "./catalog.js";
import { createAdventureState } from "./adventure.js";
import { normalizeStaffState } from "./staff.js";

export const SAVE_VERSION = 3;
const PREFIX = "axm-theme-park-v042-slot-";
const LEGACY_PREFIXES = [
  "axm-theme-park-v041-slot-",
  "axm-theme-park-v040-slot-",
  "axm-theme-park-v030-slot-"
];

function savedText(storage, slot) {
  return storage.getItem(`${PREFIX}${slot}`)
    ?? LEGACY_PREFIXES.map((prefix) => storage.getItem(`${prefix}${slot}`)).find(Boolean)
    ?? null;
}

function inferredLevel(state) {
  if (state.gameMode === "sandbox") return CAMPAIGN_LEVELS.at(-1).level;
  if ((state.park?.lifetimeVisitors ?? 0) >= 90 && (state.park?.rating ?? 0) >= 70) return 4;
  if ((state.park?.lifetimeVisitors ?? 0) >= 55 && (state.park?.rating ?? 0) >= 62) return 3;
  if ((state.park?.lifetimeVisitors ?? 0) >= 20 && (state.park?.rating ?? 0) >= 55) return 2;
  return 1;
}

export function migrateState(input) {
  const state = structuredClone(input);
  state.schemaVersion = 3;
  state.gameMode = state.gameMode === "sandbox" ? "sandbox" : "campaign";
  const level = state.progression?.level ?? inferredLevel(state);
  state.progression = {
    level,
    unlockedCatalogIds: [...new Set(state.progression?.unlockedCatalogIds ?? catalogIdsThroughLevel(level))]
  };
  state.operations ??= { dayReport: null, lastReportDay: 0 };
  state.operations.dayReport ??= null;
  state.operations.lastReportDay ??= 0;
  state.operations.todayCleanups ??= 0;
  state.operations.todayRepairs ??= 0;
  state.operations.todayBenchRests ??= 0;
  if (state.operations.dayReport) {
    state.operations.dayReport.cleanups ??= 0;
    state.operations.dayReport.repairs ??= 0;
    state.operations.dayReport.benchRests ??= 0;
  }
  state.adventure = createAdventureState(state.adventure);
  state.economy.todayVisitors ??= 0;
  for (const entity of state.world?.entities ?? []) {
    const definition = catalogDefinition(entity.catalogId);
    if ((definition.kind === "ride" || definition.kind === "service" || definition.need === "rest")
      && (!Number.isFinite(entity.queueCapacity) || entity.queueCapacity <= 0)) {
      entity.queueCapacity = Math.max(2, definition.capacity ?? 1);
    }
    entity.queueWaitMinutes ??= 0;
    entity.todayRevenue ??= 0;
  }
  for (const visitor of state.visitors ?? []) {
    visitor.patience ??= 48;
    visitor.queueJoinedTick ??= null;
    visitor.lastThought ??= "Taking in the park.";
  }
  const legacyLitter = Math.max(0, Number(state.park?.litter) || 0);
  normalizeStaffState(state);
  if (!state.world.litter.length && legacyLitter > 0) {
    state.world.litter.push({
      id: `litter-${state.world.nextLitterId++}`,
      cell: [...state.world.entrance],
      amount: legacyLitter
    });
  }
  state.stateHash = stateHash(state);
  return state;
}

export function serializeGame(state) {
  const payload = {
    schema: "axm.theme-park.playable-save",
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state: structuredClone(state)
  };
  payload.state.stateHash = stateHash(payload.state);
  return JSON.stringify(payload, null, 2);
}

export function deserializeGame(text) {
  const payload = JSON.parse(text);
  if (payload.schema !== "axm.theme-park.playable-save") throw new Error("Not an AXM Theme Park save.");
  if (![1, 2, SAVE_VERSION].includes(payload.version)) throw new Error(`Unsupported save version: ${payload.version}`);
  const expected = payload.state.stateHash;
  const actual = stateHash(payload.state);
  if (expected && expected !== actual) throw new Error("Save verification failed: state hash mismatch.");
  return migrateState(payload.state);
}

export function saveToSlot(state, slot, storage = localStorage) {
  storage.setItem(`${PREFIX}${slot}`, serializeGame(state));
}

export function loadFromSlot(slot, storage = localStorage) {
  const text = savedText(storage, slot);
  return text ? deserializeGame(text) : null;
}

export function slotMetadata(slot, storage = localStorage) {
  const text = savedText(storage, slot);
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    return {
      slot,
      savedAt: payload.savedAt,
      parkName: payload.state?.park?.name ?? "Unknown park",
      day: payload.state?.clock?.day ?? 1,
      cash: payload.state?.economy?.cash ?? 0
    };
  } catch {
    return { slot, damaged: true };
  }
}
