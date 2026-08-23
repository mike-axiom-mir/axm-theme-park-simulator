export const GUEST_BODY_LANGUAGE_SCHEMA = "axm.themepark.guest-body-language/v1";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/**
 * Derive a render-only posture from visitor evidence already owned by simulation.
 * The visitor object is never mutated and the returned descriptor is frozen.
 */
export function deriveGuestBodyLanguage(visitor) {
  const state = String(visitor?.state ?? "idle");
  const waitMinutes = Math.max(0, finite(visitor?.activityRemaining));
  const energy = clamp(finite(visitor?.energy, 1));
  const happiness = clamp(finite(visitor?.happiness, 70), 0, 100);

  let pose = "neutral";
  let intensity = 0;

  if (state === "resting") {
    pose = "resting";
    intensity = 1;
  } else if (state === "usingService") {
    pose = "service";
    intensity = 1;
  } else if (state === "queueing" && waitMinutes > 36) {
    pose = "impatient";
    intensity = clamp((waitMinutes - 36) / 24);
  } else if (energy < 0.58) {
    pose = "tired";
    intensity = clamp((0.58 - energy) / 0.38);
  } else if (happiness < 45) {
    pose = "disappointed";
    intensity = clamp((45 - happiness) / 30);
  }

  return Object.freeze({
    schema: GUEST_BODY_LANGUAGE_SCHEMA,
    visitorId: String(visitor?.id ?? ""),
    pose,
    intensity
  });
}
