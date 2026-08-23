import { PARK_CLOSE_MINUTE, PARK_OPEN_MINUTE } from "./catalog.js";

export const SIMULATION_MILLISECONDS_PER_MINUTE = 620;
export const SIMULATION_SPEEDS = Object.freeze([0, 1, 2, 4]);
export const SIMULATION_MAX_SPEED = 4;

export function normalizeSimulationSpeed(value) {
  const candidate = Number(value);
  return SIMULATION_SPEEDS.includes(candidate) ? candidate : 1;
}

export function operatingMinutesPerDay() {
  return Math.max(1, PARK_CLOSE_MINUTE - PARK_OPEN_MINUTE);
}

export function realMinutesPerOperatingDay(speed = 1) {
  const multiplier = normalizeSimulationSpeed(speed);
  if (multiplier <= 0) return Infinity;
  return operatingMinutesPerDay() * SIMULATION_MILLISECONDS_PER_MINUTE / 60000 / multiplier;
}

export function realMinutesForOperatingDays(days, speed = 1) {
  const count = Math.max(0, Number(days) || 0);
  return realMinutesPerOperatingDay(speed) * count;
}
