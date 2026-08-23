export const PARK_MOTION_SCHEMA = "axm.themepark.park-motion/v1";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function baseActivity(entity, time) {
  const open = Boolean(entity?.open);
  const active = open && finite(entity?.cycleRemaining) > 0;
  const queueLength = Math.max(0, Math.floor(finite(entity?.queue?.length)));
  const riderCount = Math.max(0, Math.floor(finite(entity?.riders?.length)));
  const waiting = open && queueLength > 0;
  const phase = finite(time);
  return { open, active, waiting, queueLength, riderCount, phase };
}

/** Derive animation values only; no field from the authoritative entity is written. */
export function deriveRideMotion(entity, time = 0) {
  const activity = baseActivity(entity, time);
  const speed = activity.active ? 1 : activity.waiting ? 0.32 : activity.open ? 0.085 : 0;
  return Object.freeze({
    schema: PARK_MOTION_SCHEMA,
    ...activity,
    speed,
    turnstileSpeed: activity.active ? 3.4 : activity.waiting ? 1.35 : 0,
    marqueePulse: activity.open ? 0.86 + Math.sin(activity.phase * 4.2) * 0.14 : 0.55,
    boardingPulse: activity.active ? 1 : activity.waiting ? 0.55 : 0
  });
}

/** Shop/service motion follows the same committed queue and cycle evidence. */
export function deriveServiceMotion(entity, time = 0) {
  const activity = baseActivity(entity, time);
  return Object.freeze({
    schema: PARK_MOTION_SCHEMA,
    ...activity,
    shutterTarget: activity.open ? 1 : 0,
    counterSpeed: activity.active ? 1 : activity.waiting ? 0.46 : activity.open ? 0.12 : 0,
    signPulse: activity.open ? 0.9 + Math.sin(activity.phase * 3.6) * 0.1 : 0.58,
    servicePulse: activity.active ? 1 : activity.waiting ? 0.45 : 0
  });
}
