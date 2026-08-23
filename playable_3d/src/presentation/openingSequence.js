import { canonicalize, hashString } from "../core/random.js";

export const OPENING_SIGNAL_SCHEMA = "axm.themepark.animation-signal/v1";

export function deriveOpeningSignal(state) {
  if (!state?.park?.id || !Number.isInteger(state.tick) || state.tick < 0 || !state.stateHash) {
    throw new Error("A committed park state is required to derive the opening animation.");
  }
  const parameters = {
    sourceStateHash: String(state.stateHash),
    parkName: String(state.park.name),
    gameMode: String(state.gameMode),
    day: Number(state.clock.day),
    durationMs: 5600,
    actorBudget: 6,
    stages: [
      "A small world wakes",
      "The sun finds the horizon",
      "An old carousel remembers",
      "The gates open to your future"
    ]
  };
  const basis = canonicalize({
    source_event_id: `campaign.started:${state.park.id}:${state.tick}`,
    entity_id: state.park.id,
    clip_id: "living-globe-gates-open",
    start_tick: state.tick,
    duration_ticks: 9,
    state_version: state.tick,
    parameters
  });
  const signal = {
    signal_id: `anim-${hashString(JSON.stringify(basis)).toString(16).padStart(8, "0")}`,
    ...basis,
    authoritative: false,
    rebuildable: true
  };
  JSON.stringify(signal);
  return Object.freeze(signal);
}
