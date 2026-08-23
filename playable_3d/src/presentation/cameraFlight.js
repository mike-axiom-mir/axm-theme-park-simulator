export const OPENING_CAMERA_FLIGHT_SCHEMA = "axm.themepark.camera-flight/v1";

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const lerp = (start, end, amount) => start + (end - start) * amount;

function smoothstep(value) {
  const amount = clamp01(value);
  return amount * amount * (3 - 2 * amount);
}

/**
 * Produce a render-only camera pose. The function is deliberately pure so the
 * opening can be rebuilt from a presentation signal without touching park RNG,
 * the simulation clock, or save state.
 */
export function openingCameraPose(progress, target = {}) {
  const amount = clamp01(progress);
  const approach = 1 - Math.pow(1 - amount, 3);
  const settle = smoothstep((amount - 0.62) / 0.38);
  const targetX = Number(target.x) || 0;
  const targetZ = Number(target.z) || 0;
  const targetYaw = Number(target.yaw) || 0;
  const targetPitch = Number(target.pitch) || 0.64;
  const targetDistance = Number(target.distance) || 46;
  const orbitAccent = amount === 0 || amount === 1
    ? 0 : Math.sin(amount * Math.PI) * (1 - settle) * 0.18;

  return Object.freeze({
    schema: OPENING_CAMERA_FLIGHT_SCHEMA,
    progress: amount,
    x: lerp(-18, targetX, approach),
    z: lerp(26, targetZ, approach),
    yaw: amount === 1 ? targetYaw : lerp(targetYaw - 2.55, targetYaw, approach) + orbitAccent,
    pitch: lerp(0.2, targetPitch, settle),
    distance: lerp(158, targetDistance, approach),
    gateProgress: smoothstep((amount - 0.5) / 0.34)
  });
}
