import {
  applyAction,
  createNewGame,
  getAdventureView,
  getProgressionView,
  simulateMinutes
} from "../playable_3d/src/core/simulation.js";
import { deserializeGame, serializeGame } from "../playable_3d/src/core/save.js";
import { stateHash } from "../playable_3d/src/core/random.js";
import { eventStreamSummary, validateEventStream } from "../playable_3d/src/core/eventStream.js";

export const MAX_STEP_MINUTES = 366 * 24 * 60;

function findNonFinite(value, location = "state") {
  if (typeof value === "number" && !Number.isFinite(value)) return location;
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findNonFinite(value[index], `${location}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    const found = findNonFinite(child, `${location}.${key}`);
    if (found) return found;
  }
  return null;
}

export function validateState(state) {
  const issues = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) issues.push("state must be an object");
  if (state?.schemaVersion !== 3) issues.push("schemaVersion must be 3");
  if (!Number.isSafeInteger(state?.tick) || state.tick < 0) issues.push("tick must be a non-negative safe integer");
  if (!Number.isSafeInteger(state?.clock?.day) || state.clock.day < 1) issues.push("clock.day must be a positive safe integer");
  if (!Number.isSafeInteger(state?.clock?.minute) || state.clock.minute < 0 || state.clock.minute >= 1440) {
    issues.push("clock.minute must be an integer from 0 through 1439");
  }
  if (!Array.isArray(state?.world?.paths)) issues.push("world.paths must be an array");
  if (!Array.isArray(state?.world?.entities)) issues.push("world.entities must be an array");
  if (!Array.isArray(state?.visitors)) issues.push("visitors must be an array");
  issues.push(...validateEventStream(state));
  const nonFinite = findNonFinite(state);
  if (nonFinite) issues.push(`${nonFinite} must be finite`);
  if (issues.length) throw new Error(`Invalid playable state: ${issues.join("; ")}`);

  const actualHash = stateHash(state);
  if (state.stateHash !== actualHash) {
    throw new Error(`State hash mismatch: expected ${state.stateHash}, calculated ${actualHash}`);
  }
  return true;
}

export class HeadlessSimulator {
  constructor(state) {
    validateState(state);
    this.state = state;
  }

  static create(options = {}) {
    return new HeadlessSimulator(createNewGame(options));
  }

  static fromSerialized(text) {
    return new HeadlessSimulator(deserializeGame(text));
  }

  serialize() {
    validateState(this.state);
    return serializeGame(this.state);
  }

  advance(minutes) {
    if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > MAX_STEP_MINUTES) {
      throw new Error(`Minutes must be a safe integer from 0 through ${MAX_STEP_MINUTES}.`);
    }
    simulateMinutes(this.state, minutes);
    validateState(this.state);
    return this.summary();
  }

  apply(action) {
    if (!action || typeof action !== "object" || Array.isArray(action)) {
      throw new Error("Action must be a JSON object.");
    }
    const result = applyAction(this.state, structuredClone(action));
    this.state.stateHash = stateHash(this.state);
    validateState(this.state);
    return result;
  }

  summary() {
    validateState(this.state);
    return {
      schema: "axm.theme-park.headless-summary/v1",
      playableVersion: "0.4.6",
      parkName: this.state.park.name,
      mode: this.state.gameMode,
      tick: this.state.tick,
      day: this.state.clock.day,
      minute: this.state.clock.minute,
      stateHash: this.state.stateHash,
      eventStream: eventStreamSummary(this.state),
      cash: this.state.economy.cash,
      visitorsPresent: this.state.visitors.length,
      lifetimeVisitors: this.state.park.lifetimeVisitors,
      entities: this.state.world.entities.length,
      paths: this.state.world.paths.length,
      progression: getProgressionView(this.state),
      adventure: getAdventureView(this.state),
      dayReport: this.state.operations?.dayReport ?? null
    };
  }
}
