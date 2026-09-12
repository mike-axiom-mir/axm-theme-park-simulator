export const EVENT_STREAM_SCHEMA = "axm.theme-park.event-stream/v1";
export const EVENT_LOG_RETAINED_LIMIT = 400;

const CONTINUITY = new Set([
  "continuous",
  "legacy_retained_window",
  "legacy_sequence_ambiguity"
]);

export function createEventStream() {
  return {
    schema: EVENT_STREAM_SCHEMA,
    lastSequence: 0,
    retainedLimit: EVENT_LOG_RETAINED_LIMIT,
    continuity: "continuous"
  };
}

export function validateEventStream(state) {
  const issues = [];
  const stream = state?.eventStream;
  const records = state?.eventLog;
  if (!stream || typeof stream !== "object" || Array.isArray(stream)) {
    return ["eventStream must be an object"];
  }
  if (stream.schema !== EVENT_STREAM_SCHEMA) issues.push(`eventStream.schema must be ${EVENT_STREAM_SCHEMA}`);
  if (!Number.isSafeInteger(stream.lastSequence) || stream.lastSequence < 0) {
    issues.push("eventStream.lastSequence must be a non-negative safe integer");
  }
  if (stream.retainedLimit !== EVENT_LOG_RETAINED_LIMIT) {
    issues.push(`eventStream.retainedLimit must be ${EVENT_LOG_RETAINED_LIMIT}`);
  }
  if (!CONTINUITY.has(stream.continuity)) issues.push("eventStream.continuity is unsupported");
  if (!Array.isArray(records)) return [...issues, "eventLog must be an array"];
  if (records.length > EVENT_LOG_RETAINED_LIMIT) issues.push("eventLog exceeds its retained window");

  let previous = 0;
  let maximum = 0;
  let sequencesValid = true;
  for (const record of records) {
    const sequence = record?.sequence;
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      issues.push("eventLog sequences must be positive safe integers");
      sequencesValid = false;
      continue;
    }
    if (sequence < previous) issues.push("eventLog sequences must not move backwards");
    if (sequence === previous && stream.continuity !== "legacy_sequence_ambiguity") {
      issues.push("eventLog sequences must be unique outside a declared legacy ambiguity");
    }
    previous = sequence;
    maximum = Math.max(maximum, sequence);
  }
  if (records.length && stream.lastSequence !== maximum) {
    issues.push("eventStream.lastSequence must match the newest retained sequence");
  } else if (
    records.length
    && sequencesValid
    && stream.continuity === "continuous"
    && Number.isSafeInteger(stream.lastSequence)
    && stream.lastSequence >= 0
  ) {
    const firstExpected = stream.lastSequence - records.length + 1;
    const isContiguousSuffix = firstExpected >= 1
      && records.every((record, index) => record.sequence === firstExpected + index);
    if (!isContiguousSuffix) {
      issues.push("continuous eventLog must be a contiguous suffix ending at eventStream.lastSequence");
    }
  } else if (
    !records.length
    && Number.isSafeInteger(stream.lastSequence)
    && stream.lastSequence !== 0
  ) {
    issues.push("eventStream.lastSequence must be 0 when eventLog is empty");
  }
  return issues;
}

export function migrateEventStream(state) {
  if (state.eventStream !== undefined) return state;
  const records = Array.isArray(state.eventLog) ? state.eventLog : [];
  let maximum = 0;
  let previous = 0;
  let ambiguous = false;
  for (const record of records) {
    const sequence = record?.sequence;
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence <= previous) ambiguous = true;
    if (Number.isSafeInteger(sequence) && sequence > 0) maximum = Math.max(maximum, sequence);
    if (Number.isSafeInteger(sequence)) previous = sequence;
  }
  state.eventStream = {
    schema: EVENT_STREAM_SCHEMA,
    lastSequence: maximum,
    retainedLimit: EVENT_LOG_RETAINED_LIMIT,
    continuity: ambiguous ? "legacy_sequence_ambiguity" : "legacy_retained_window"
  };
  return state;
}

export function appendRetainedEvent(state, { tick, type, subjectId, data = {} }) {
  const issues = validateEventStream(state);
  if (issues.length) throw new Error(`Invalid event stream: ${issues.join("; ")}`);
  if (state.eventStream.lastSequence === Number.MAX_SAFE_INTEGER) {
    throw new Error("Event sequence space is exhausted; fork explicitly before continuing.");
  }
  const sequence = state.eventStream.lastSequence + 1;
  state.eventStream.lastSequence = sequence;
  const record = { sequence, tick, type, subjectId, data };
  state.eventLog.push(record);
  if (state.eventLog.length > EVENT_LOG_RETAINED_LIMIT) {
    state.eventLog.splice(0, state.eventLog.length - EVENT_LOG_RETAINED_LIMIT);
  }
  return record;
}

export function eventStreamSummary(state) {
  const records = state.eventLog;
  return {
    schema: EVENT_STREAM_SCHEMA,
    lastSequence: state.eventStream.lastSequence,
    retained: records.length,
    retainedLimit: EVENT_LOG_RETAINED_LIMIT,
    firstRetainedSequence: records[0]?.sequence ?? null,
    lastRetainedSequence: records.at(-1)?.sequence ?? null,
    sequenceFloorBeforeWindow: Math.max(0, (records[0]?.sequence ?? state.eventStream.lastSequence + 1) - 1),
    continuity: state.eventStream.continuity
  };
}
