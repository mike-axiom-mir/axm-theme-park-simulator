export const GUEST_BODY_LANGUAGE_SCHEMA = "axm.themepark.guest-body-language/v1";
export const GUEST_WEATHER_GESTURE_SCHEMA = "axm.themepark.guest-weather-gesture/v1";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const POSE_METADATA = Object.freeze({
  neutral: Object.freeze({ label: "Neutral", reason: "no urgent posture cue" }),
  delighted: Object.freeze({ label: "Delighted", reason: "high happiness" }),
  impatient: Object.freeze({ label: "Impatient", reason: "long queue" }),
  tired: Object.freeze({ label: "Tired", reason: "low energy" }),
  disappointed: Object.freeze({ label: "Subdued", reason: "low happiness" }),
  resting: Object.freeze({ label: "Resting", reason: "seated recovery" }),
  service: Object.freeze({ label: "At service", reason: "current interaction" })
});

const WEATHER_METADATA = Object.freeze({
  none: Object.freeze({ label: "No weather gesture", reason: "conditions are mild" }),
  rainCover: Object.freeze({ label: "Covering from rain", reason: "active precipitation" }),
  heatFan: Object.freeze({ label: "Fanning in the heat", reason: "warm conditions while waiting" })
});

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
  } else if ((state === "idle" || state === "walking") && happiness > 82) {
    pose = "delighted";
    intensity = clamp((happiness - 82) / 18);
  }

  return Object.freeze({
    schema: GUEST_BODY_LANGUAGE_SCHEMA,
    visitorId: String(visitor?.id ?? ""),
    pose,
    intensity
  });
}

/** Human-readable projection of the same descriptor used by the renderer. */
export function describeGuestBodyLanguage(visitor) {
  const descriptor = deriveGuestBodyLanguage(visitor);
  const metadata = POSE_METADATA[descriptor.pose] ?? POSE_METADATA.neutral;
  return Object.freeze({
    ...descriptor,
    label: metadata.label,
    reason: metadata.reason,
    strength: Math.round(descriptor.intensity * 100)
  });
}

/**
 * Weather gestures are presentation-only and deliberately separate from mood.
 * They never alter needs, movement speed, route choice, spending, or happiness.
 */
export function deriveGuestWeatherGesture(visitor, weather) {
  const state = String(visitor?.state ?? "idle");
  const precipitation = clamp(finite(weather?.precipitation));
  const temperature = finite(weather?.temperature, 18);
  let gesture = "none";
  let intensity = 0;

  if (!["riding", "resting", "usingService", "departed"].includes(state)) {
    if (precipitation >= 0.25) {
      gesture = "rainCover";
      intensity = clamp((precipitation - 0.2) / 0.8);
    } else if (temperature >= 23 && ["idle", "queueing"].includes(state)) {
      gesture = "heatFan";
      intensity = clamp((temperature - 22) / 8);
    }
  }

  return Object.freeze({
    schema: GUEST_WEATHER_GESTURE_SCHEMA,
    visitorId: String(visitor?.id ?? ""),
    gesture,
    intensity
  });
}

export function describeGuestWeatherGesture(visitor, weather) {
  const descriptor = deriveGuestWeatherGesture(visitor, weather);
  const metadata = WEATHER_METADATA[descriptor.gesture] ?? WEATHER_METADATA.none;
  return Object.freeze({
    ...descriptor,
    label: metadata.label,
    reason: metadata.reason,
    strength: Math.round(descriptor.intensity * 100)
  });
}
