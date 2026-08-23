import * as THREE from "../../vendor/three.module.min.js";
import { GRID_SIZE, TILE_SIZE } from "../core/catalog.js";

export const WEATHER_RAIN_BUDGET = 64;
export const WEATHER_CLOUD_BUDGET = 8;
export const WEATHER_TOTAL_ACTOR_BUDGET = WEATHER_RAIN_BUDGET + WEATHER_CLOUD_BUDGET;

const fract = (value) => value - Math.floor(value);

/** Stable, allocation-free layout input for one bounded weather actor. */
export function weatherActorDescriptor(index) {
  const actor = Math.max(0, Math.floor(Number(index) || 0));
  return Object.freeze({
    x: fract((actor + 1) * 0.61803398875),
    z: fract((actor + 1) * 0.41421356237),
    phase: fract((actor + 1) * 0.75487766625),
    scale: 0.72 + fract((actor + 1) * 0.27950849718) * 0.58
  });
}

const wrap01 = (value) => ((value % 1) + 1) % 1;

export function createWeatherEffects(globe) {
  const root = new THREE.Group();
  root.name = "bounded-render-only-weather";
  const rainMaterial = new THREE.MeshBasicMaterial({
    color: 0xa9d7e8,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const rain = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.045, 1.55, 0.045),
    rainMaterial,
    WEATHER_RAIN_BUDGET
  );
  rain.name = "rain-streaks";
  rain.frustumCulled = false;
  rain.visible = false;
  root.add(rain);

  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xa9b7c1,
    roughness: 1,
    flatShading: true,
    transparent: true,
    opacity: 0,
    depthWrite: false
  });
  const clouds = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1.2, 0),
    cloudMaterial,
    WEATHER_CLOUD_BUDGET
  );
  clouds.name = "low-poly-clouds";
  clouds.frustumCulled = false;
  clouds.visible = false;
  root.add(clouds);

  const extent = GRID_SIZE * TILE_SIZE * 0.49;
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  const rainDescriptors = Array.from({ length: WEATHER_RAIN_BUDGET }, (_, index) => weatherActorDescriptor(index));
  const cloudDescriptors = Array.from({ length: WEATHER_CLOUD_BUDGET }, (_, index) => weatherActorDescriptor(index + WEATHER_RAIN_BUDGET));
  let rainOpacity = 0;
  let cloudOpacity = 0;
  let lastTime = 0;

  function setQuality(profile) {
    rain.count = profile === "tiny" ? 24 : profile === "crisp" ? WEATHER_RAIN_BUDGET : 44;
    clouds.count = profile === "tiny" ? 4 : profile === "crisp" ? WEATHER_CLOUD_BUDGET : 6;
  }

  function update(time, weather = { type: "bright", wind: 0.18, precipitation: 0 }) {
    const dt = lastTime ? Math.max(0, Math.min(0.1, time - lastTime)) : 0;
    lastTime = time;
    const raining = weather.type === "rain" || Number(weather.precipitation) > 0.05;
    const overcast = raining || weather.type === "cloudy";
    const blend = 1 - Math.exp(-dt * 3.5);
    rainOpacity += ((raining ? 0.62 : 0) - rainOpacity) * blend;
    cloudOpacity += ((overcast ? (raining ? 0.62 : 0.42) : 0) - cloudOpacity) * blend;
    rainMaterial.opacity = rainOpacity;
    cloudMaterial.opacity = cloudOpacity;
    rain.visible = rainOpacity > 0.01;
    clouds.visible = cloudOpacity > 0.01;

    if (rain.visible) {
      const wind = Math.max(-1, Math.min(1, Number(weather.wind) || 0));
      for (let index = 0; index < rain.count; index += 1) {
        const descriptor = rainDescriptors[index];
        const fall = wrap01(descriptor.phase - time * (0.42 + descriptor.scale * 0.09));
        const localX = (descriptor.x * 2 - 1) * extent + wind * (1 - fall) * 5;
        const localZ = (descriptor.z * 2 - 1) * extent;
        const frame = globe.frameAtLocal(localX, localZ, 2.2 + fall * 18);
        scale.set(descriptor.scale, 0.9 + descriptor.scale * 0.48, descriptor.scale);
        matrix.compose(frame.position, frame.quaternion, scale);
        rain.setMatrixAt(index, matrix);
      }
      rain.instanceMatrix.needsUpdate = true;
    }

    if (clouds.visible) {
      const wind = 0.006 + Math.max(0, Number(weather.wind) || 0) * 0.025;
      for (let index = 0; index < clouds.count; index += 1) {
        const descriptor = cloudDescriptors[index];
        const localX = (wrap01(descriptor.x + time * wind) * 2 - 1) * extent;
        const localZ = (descriptor.z * 2 - 1) * extent;
        const frame = globe.frameAtLocal(localX, localZ, 12 + descriptor.phase * 5);
        scale.set(2.8 + descriptor.scale, 0.72 + descriptor.scale * 0.16, 1.75 + descriptor.scale * 0.5);
        matrix.compose(frame.position, frame.quaternion, scale);
        clouds.setMatrixAt(index, matrix);
      }
      clouds.instanceMatrix.needsUpdate = true;
    }
  }

  setQuality("retro");
  return Object.freeze({
    root,
    rain,
    clouds,
    actorBudget: WEATHER_TOTAL_ACTOR_BUDGET,
    setQuality,
    update,
    status: () => Object.freeze({
      actorBudget: WEATHER_TOTAL_ACTOR_BUDGET,
      activeRainActors: rain.visible ? rain.count : 0,
      activeCloudActors: clouds.visible ? clouds.count : 0
    })
  });
}
