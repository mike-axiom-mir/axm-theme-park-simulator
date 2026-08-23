export const HISTORICAL_TIMELINE_SCHEMA = "axm.themepark.historical-timeline/v1";
export const HISTORICAL_START_YEAR = 1980;
export const HISTORICAL_OPERATING_DAYS_PER_YEAR = 8;

const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;

export function normalizeHistoricalTimeline(state) {
  state.history ??= {};
  state.history.schema = HISTORICAL_TIMELINE_SCHEMA;
  state.history.startYear = Math.max(1900, integer(state.history.startYear, HISTORICAL_START_YEAR));
  state.history.operatingDaysPerYear = Math.max(1,
    integer(state.history.operatingDaysPerYear, HISTORICAL_OPERATING_DAYS_PER_YEAR));
  return state.history;
}

export function calendarYear(state) {
  const history = normalizeHistoricalTimeline(state);
  const day = Math.max(1, integer(state.clock?.day, 1));
  return history.startYear + Math.floor((day - 1) / history.operatingDaysPerYear);
}

export function careerDayOfYear(state) {
  const history = normalizeHistoricalTimeline(state);
  const day = Math.max(1, integer(state.clock?.day, 1));
  return ((day - 1) % history.operatingDaysPerYear) + 1;
}

export function calendarView(state) {
  const history = normalizeHistoricalTimeline(state);
  const year = calendarYear(state);
  const dayOfYear = careerDayOfYear(state);
  return Object.freeze({
    schema: HISTORICAL_TIMELINE_SCHEMA,
    startYear: history.startYear,
    year,
    operatingDay: Math.max(1, integer(state.clock?.day, 1)),
    representativeDay: dayOfYear,
    representativeDaysPerYear: history.operatingDaysPerYear,
    nextYearInDays: Math.max(0, history.operatingDaysPerYear - dayOfYear + 1)
  });
}
