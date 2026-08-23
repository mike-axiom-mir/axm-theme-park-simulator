import * as THREE from "../../vendor/three.module.min.js";

export const PARK_BUTTERFLY_BUDGET = 12;
export const PARK_FIREFLY_BUDGET = 16;
export const PARK_LEAF_BUDGET = 12;
export const PARK_ATMOSPHERE_ACTOR_BUDGET = PARK_BUTTERFLY_BUDGET
  + PARK_FIREFLY_BUDGET + PARK_LEAF_BUDGET;

const fract = (value) => value - Math.floor(value);
const wrap01 = (value) => ((value % 1) + 1) % 1;

export function ambientActorDescriptor(index) {
  const actor = Math.max(0, Math.floor(Number(index) || 0));
  return Object.freeze({
    anchor: fract((actor + 1) * 0.61803398875),
    phase: fract((actor + 1) * 0.75487766625) * Math.PI * 2,
    radius: 0.28 + fract((actor + 1) * 0.41421356237) * 0.92,
    height: 0.58 + fract((actor + 1) * 0.27950849718) * 1.25,
    scale: 0.7 + fract((actor + 1) * 0.56984029099) * 0.55,
    colorIndex: actor % 4
  });
}

function anchorLocal(globe, collection, descriptor) {
  const index = Math.min(collection.length - 1, Math.floor(descriptor.anchor * collection.length));
  const anchor = collection[Math.max(0, index)] ?? { x: 15, z: 15 };
  return globe.gridToLocal(anchor.x, anchor.z);
}

/** Bounded, deterministic park ambience. It only reads committed world state. */
export function createParkAtmosphere(globe) {
  const root = new THREE.Group();
  root.name = "bounded-render-only-park-atmosphere";

  const butterflies = new THREE.InstancedMesh(
    new THREE.TetrahedronGeometry(0.14, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, flatShading: true }),
    PARK_BUTTERFLY_BUDGET
  );
  butterflies.name = "path-butterflies";
  butterflies.frustumCulled = false;
  butterflies.visible = false;
  root.add(butterflies);

  const fireflies = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.085, 0),
    new THREE.MeshBasicMaterial({ color: 0xffe275, transparent: true, opacity: 0.92, depthWrite: false }),
    PARK_FIREFLY_BUDGET
  );
  fireflies.name = "evening-fireflies";
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  root.add(fireflies);

  const leaves = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.035, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x78a454, roughness: 0.95, flatShading: true }),
    PARK_LEAF_BUDGET
  );
  leaves.name = "tree-leaf-gusts";
  leaves.frustumCulled = false;
  leaves.visible = false;
  root.add(leaves);

  const butterflyPalette = [0xf2c75c, 0xe77d8b, 0x72c6d0, 0xb78acb];
  const color = new THREE.Color();
  for (let index = 0; index < PARK_BUTTERFLY_BUDGET; index += 1) {
    color.setHex(butterflyPalette[index % butterflyPalette.length]);
    butterflies.setColorAt(index, color);
  }
  if (butterflies.instanceColor) butterflies.instanceColor.needsUpdate = true;

  const butterflyDescriptors = Array.from(
    { length: PARK_BUTTERFLY_BUDGET }, (_, index) => ambientActorDescriptor(index)
  );
  const fireflyDescriptors = Array.from(
    { length: PARK_FIREFLY_BUDGET }, (_, index) => ambientActorDescriptor(index + PARK_BUTTERFLY_BUDGET)
  );
  const leafDescriptors = Array.from(
    { length: PARK_LEAF_BUDGET }, (_, index) => ambientActorDescriptor(index + PARK_BUTTERFLY_BUDGET + PARK_FIREFLY_BUDGET)
  );
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();

  function setQuality(profile) {
    butterflies.count = profile === "tiny" ? 4 : profile === "crisp" ? PARK_BUTTERFLY_BUDGET : 8;
    fireflies.count = profile === "tiny" ? 6 : profile === "crisp" ? PARK_FIREFLY_BUDGET : 10;
    leaves.count = profile === "tiny" ? 4 : profile === "crisp" ? PARK_LEAF_BUDGET : 8;
  }

  function update(time, state = {}) {
    const paths = state.world?.paths ?? [];
    const trees = (state.world?.entities ?? []).filter((entity) => entity.catalogId === "tree");
    const minute = Number(state.clock?.minute) || 0;
    const precipitation = Math.max(0, Number(state.weather?.precipitation) || 0);
    const wind = Math.max(0, Number(state.weather?.wind) || 0);
    const daytime = minute >= 7 * 60 && minute < 19 * 60;
    const evening = minute >= 18 * 60 || minute < 6 * 60;

    butterflies.visible = paths.length > 0 && daytime && precipitation < 0.12;
    fireflies.visible = paths.length > 0 && evening && precipitation < 0.2;
    leaves.visible = trees.length > 0 && wind > 0.08;

    if (butterflies.visible) {
      for (let index = 0; index < butterflies.count; index += 1) {
        const descriptor = butterflyDescriptors[index];
        const anchor = anchorLocal(globe, paths, descriptor);
        const angle = time * (0.48 + descriptor.scale * 0.18) + descriptor.phase;
        const localX = anchor.x + Math.cos(angle) * descriptor.radius;
        const localZ = anchor.z + Math.sin(angle) * descriptor.radius;
        const altitude = descriptor.height + Math.sin(time * 2.4 + descriptor.phase) * 0.22;
        const frame = globe.frameAtLocal(localX, localZ, altitude);
        const flap = 0.34 + Math.abs(Math.sin(time * 8.5 + descriptor.phase)) * 0.92;
        scale.set(descriptor.scale * flap, descriptor.scale * 0.72, descriptor.scale);
        matrix.compose(frame.position, frame.quaternion, scale);
        butterflies.setMatrixAt(index, matrix);
      }
      butterflies.instanceMatrix.needsUpdate = true;
    }

    if (fireflies.visible) {
      for (let index = 0; index < fireflies.count; index += 1) {
        const descriptor = fireflyDescriptors[index];
        const anchor = anchorLocal(globe, paths, descriptor);
        const angle = time * 0.31 + descriptor.phase;
        const localX = anchor.x + Math.cos(angle) * descriptor.radius * 1.35;
        const localZ = anchor.z + Math.sin(angle * 1.17) * descriptor.radius * 1.35;
        const altitude = 0.65 + descriptor.height * 0.62 + Math.sin(time * 1.9 + descriptor.phase) * 0.34;
        const frame = globe.frameAtLocal(localX, localZ, altitude);
        const pulse = descriptor.scale * (0.55 + Math.abs(Math.sin(time * 3.7 + descriptor.phase)) * 0.72);
        scale.setScalar(pulse);
        matrix.compose(frame.position, frame.quaternion, scale);
        fireflies.setMatrixAt(index, matrix);
      }
      fireflies.instanceMatrix.needsUpdate = true;
    }

    if (leaves.visible) {
      for (let index = 0; index < leaves.count; index += 1) {
        const descriptor = leafDescriptors[index];
        const anchor = anchorLocal(globe, trees, descriptor);
        const fall = wrap01(descriptor.anchor + time * (0.08 + Math.min(0.75, wind) * 0.12));
        const angle = time * (0.72 + wind) + descriptor.phase;
        const localX = anchor.x + Math.cos(angle) * descriptor.radius + wind * fall * 0.7;
        const localZ = anchor.z + Math.sin(angle) * descriptor.radius;
        const altitude = 0.35 + (1 - fall) * (2.4 + descriptor.height);
        const frame = globe.frameAtLocal(localX, localZ, altitude);
        const flutter = descriptor.scale * (0.55 + Math.abs(Math.sin(time * 5.4 + descriptor.phase)) * 0.55);
        scale.set(flutter, descriptor.scale, flutter);
        matrix.compose(frame.position, frame.quaternion, scale);
        leaves.setMatrixAt(index, matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
    }
  }

  setQuality("retro");
  return Object.freeze({
    root,
    butterflies,
    fireflies,
    leaves,
    actorBudget: PARK_ATMOSPHERE_ACTOR_BUDGET,
    setQuality,
    update,
    status: () => Object.freeze({
      atmosphereActorBudget: PARK_ATMOSPHERE_ACTOR_BUDGET,
      activeButterflies: butterflies.visible ? butterflies.count : 0,
      activeFireflies: fireflies.visible ? fireflies.count : 0,
      activeLeaves: leaves.visible ? leaves.count : 0
    })
  });
}
