export const HISTORICAL_TIMELINE_SCHEMA = "axm.themepark.historical-timeline/v1";
export const HISTORICAL_START_YEAR = 1980;
export const HISTORICAL_OPERATING_DAYS_PER_YEAR = 8;

const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;

function inferredCareerOperatingDay(state) {
  const explicit = integer(state.history?.careerOperatingDay, 0);
  if (explicit > 0) return explicit;
  return Math.max(1, integer(state.clock?.day, 1));
}

/**
 * Career time is intentionally separate from a map/scenario's local day number.
 * A future map campaign may restart its local clock at Day 1 while the historical
 * career continues through the same calendar year and technology era.
 */
export function normalizeHistoricalTimeline(state) {
  state.history ??= {};
  state.history.schema = HISTORICAL_TIMELINE_SCHEMA;
  state.history.startYear = Math.max(1900, integer(state.history.startYear, HISTORICAL_START_YEAR));
  state.history.operatingDaysPerYear = Math.max(1,
    integer(state.history.operatingDaysPerYear, HISTORICAL_OPERATING_DAYS_PER_YEAR));
  state.history.careerOperatingDay = inferredCareerOperatingDay(state);
  state.history.activeMapId = String(state.history.activeMapId ?? state.campaign?.id ?? "park-map-1");
  state.history.mapStartCareerDay = Math.max(1,
    integer(state.history.mapStartCareerDay,
      state.history.careerOperatingDay - Math.max(0, integer(state.clock?.day, 1) - 1)));
  return state.history;
}

export function careerOperatingDay(state) {
  return normalizeHistoricalTimeline(state).careerOperatingDay;
}

export function calendarYear(state) {
  const history = normalizeHistoricalTimeline(state);
  return history.startYear + Math.floor((history.careerOperatingDay - 1) / history.operatingDaysPerYear);
}

export function careerDayOfYear(state) {
  const history = normalizeHistoricalTimeline(state);
  return ((history.careerOperatingDay - 1) % history.operatingDaysPerYear) + 1;
}

/**
 * Call only after a committed transition to a new operating day. This is the
 * authoritative historical career counter; map-local day counters may restart.
 */
export function advanceCareerOperatingDay(state, { source = "operating-day" } = {}) {
  const history = normalizeHistoricalTimeline(state);
  history.careerOperatingDay += 1;
  return Object.freeze({
    source,
    careerOperatingDay: history.careerOperatingDay,
    year: calendarYear(state),
    representativeDay: careerDayOfYear(state)
  });
}

/**
 * Map/scenario continuity seam. A future campaign loader can start a fresh local
 * Day 1 without resetting historical career time, payment adoption or era gates.
 */
export function beginMapCampaignTimeline(state, { mapId, localDay = 1 } = {}) {
  const history = normalizeHistoricalTimeline(state);
  history.activeMapId = String(mapId ?? state.campaign?.id ?? history.activeMapId ?? "park-map");
  history.mapStartCareerDay = history.careerOperatingDay;
  if (state.clock) state.clock.day = Math.max(1, integer(localDay, 1));
  return calendarView(state);
}

export function calendarView(state) {
  const history = normalizeHistoricalTimeline(state);
  const year = calendarYear(state);
  const dayOfYear = careerDayOfYear(state);
  return Object.freeze({
    schema: HISTORICAL_TIMELINE_SCHEMA,
    startYear: history.startYear,
    year,
    careerOperatingDay: history.careerOperatingDay,
    mapOperatingDay: Math.max(1, integer(state.clock?.day, 1)),
    activeMapId: history.activeMapId,
    mapStartCareerDay: history.mapStartCareerDay,
    representativeDay: dayOfYear,
    representativeDaysPerYear: history.operatingDaysPerYear,
    nextYearInDays: Math.max(0, history.operatingDaysPerYear - dayOfYear + 1)
  });
}
