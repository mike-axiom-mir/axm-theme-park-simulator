import * as THREE from "../../vendor/three.module.min.js";
import { TILE_SIZE, catalogDefinition } from "../core/catalog.js";
import { deriveRideMotion } from "../presentation/parkMotion.js";

const materialCache = new Map();
const geometryCache = new Map();

function material(color, options = {}) {
  const key = `${color}-${options.emissive ?? 0}-${options.opacity ?? 1}-${options.roughness ?? 0.84}-${options.metalness ?? 0.04}-${options.emissiveIntensity ?? 0}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: options.roughness ?? 0.84,
      metalness: options.metalness ?? 0.04,
      transparent: options.opacity !== undefined && options.opacity < 1,
      opacity: options.opacity ?? 1,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0
    }));
  }
  return materialCache.get(key);
}

function box(width, height, depth, color, y = height / 2) {
  const key = `box-${width}-${height}-${depth}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
  const mesh = new THREE.Mesh(geometryCache.get(key), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cylinder(radiusTop, radiusBottom, height, sides, color, y = height / 2) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides),
    material(color)
  );
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sphere(radius, color, y = 0) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

function addPassenger(parent, x, z, color) {
  const passenger = new THREE.Group();
  passenger.name = "animated-ride-passenger";
  passenger.position.set(x, 0.9, z);
  passenger.add(box(0.26, 0.38, 0.22, color, 0.2));
  passenger.add(sphere(0.14, 0xd7aa82, 0.5));
  passenger.visible = false;
  parent.add(passenger);
  return passenger;
}

function addFrontage(group, definition) {
  const root = new THREE.Group();
  root.position.z = definition.footprint[1] * TILE_SIZE * 0.44;
  root.name = "animated-galleon-frontage";

  const postA = box(0.1, 2.15, 0.1, 0x3f4852, 1.08);
  postA.position.x = -1.35;
  const postB = postA.clone();
  postB.position.x = 1.35;
  const sign = box(2.9, 0.52, 0.18, definition.color, 1.9);
  const barrierPivot = new THREE.Group();
  barrierPivot.position.set(-1.1, 0.86, 0.18);
  const barrier = box(1.75, 0.1, 0.1, 0xe8cf8a, 0);
  barrier.position.x = 0.86;
  barrierPivot.add(barrier);

  const bulbs = [];
  for (const x of [-0.95, -0.32, 0.32, 0.95]) {
    const bulb = sphere(0.1, 0xffd66a, 1.92);
    bulb.position.x = x;
    bulb.position.z = 0.12;
    bulb.material = material(0x55431d, { emissive: 0xffce55, emissiveIntensity: 1.7 });
    bulbs.push(bulb);
    root.add(bulb);
  }
  root.add(postA, postB, sign, barrierPivot);
  group.add(root);

  let gate = 0;
  let lastTime = null;
  return (time, motion) => {
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - lastTime));
    lastTime = time;
    gate += ((motion.open ? 1 : 0) - gate) * (1 - Math.exp(-dt * 5));
    barrierPivot.rotation.z = -gate * 1.25;
    sign.scale.y = motion.marqueePulse;
    bulbs.forEach((bulb, index) => {
      bulb.visible = motion.open;
      bulb.scale.setScalar(0.82 + Math.sin(time * 5 + index * 1.4) * 0.18 * (0.35 + motion.boardingPulse));
    });
  };
}

function addEvolutionVisuals(group) {
  const root = new THREE.Group();
  root.name = "galleon-evolution-dressing";
  group.add(root);
  let appliedLevel = -1;

  const sync = (level) => {
    const nextLevel = Math.max(0, Math.min(3, Math.floor(Number(level) || 0)));
    if (nextLevel === appliedLevel) return;
    appliedLevel = nextLevel;
    while (root.children.length) root.remove(root.children[0]);
    delete root.userData.beacon;

    if (nextLevel >= 1) {
      const crest = box(1.7, 0.34, 0.12, 0xf0c766, 6.55);
      crest.position.z = -0.22;
      root.add(crest);
    }
    if (nextLevel >= 2) {
      for (const [x, z] of [[-4, -2], [4, -2], [-4, 2], [4, 2]]) {
        const post = cylinder(0.05, 0.07, 1.35, 5, 0x46525c, 0.68);
        post.position.x = x;
        post.position.z = z;
        const lamp = sphere(0.14, 0xffdc78, 1.48);
        lamp.position.x = x;
        lamp.position.z = z;
        lamp.material = material(0x5a481f, { emissive: 0xffd15f, emissiveIntensity: 1.5 });
        root.add(post, lamp);
      }
    }
    if (nextLevel >= 3) {
      const beacon = sphere(0.28, 0xffdf7c, 7.1);
      beacon.material = material(0x634f20, { emissive: 0xffd15f, emissiveIntensity: 1.9 });
      root.add(beacon);
      root.userData.beacon = beacon;
    }
  };

  return { root, sync };
}

export function createGalleonModel(entity) {
  const definition = catalogDefinition(entity.catalogId);
  if (definition.id !== "galleon") throw new Error(`Unsupported extra attraction: ${definition.id}`);

  const group = new THREE.Group();
  group.name = entity.id;
  group.userData.entityId = entity.id;
  group.userData.definition = definition;
  group.userData.specialAttractionId = "galleon";

  group.add(box(5 * TILE_SIZE * 0.94, 0.22, 3 * TILE_SIZE * 0.94, 0x4b5056, 0.11));

  const supportColor = 0x4e5961;
  for (const x of [-3.35, 3.35]) {
    const front = box(0.24, 6.7, 0.24, supportColor, 3.25);
    front.position.x = x;
    front.position.z = 1.55;
    front.rotation.z = x < 0 ? -0.22 : 0.22;
    const back = front.clone();
    back.position.z = -1.55;
    group.add(front, back);
  }
  const crossbeam = box(7.3, 0.3, 0.36, 0x64717a, 6.05);
  group.add(crossbeam);

  const pivot = new THREE.Group();
  pivot.position.y = 5.75;
  group.add(pivot);
  const hanger = box(0.2, 4.4, 0.2, 0xc9d0d2, -2.2);
  pivot.add(hanger);

  const ship = new THREE.Group();
  ship.position.y = -4.45;
  pivot.add(ship);

  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 1.25, 5.9, 8, 1, false, 0, Math.PI),
    material(0x8c4c31, { roughness: 0.78 })
  );
  hull.rotation.z = Math.PI / 2;
  hull.rotation.y = Math.PI / 2;
  hull.position.y = 0.4;
  hull.castShadow = true;
  ship.add(hull);

  const deck = box(5.35, 0.18, 1.65, 0xc38a52, 0.9);
  ship.add(deck);
  const bow = box(0.5, 0.62, 1.2, 0xe0b168, 1.12);
  bow.position.x = 2.72;
  bow.rotation.z = -0.35;
  ship.add(bow);
  const stern = bow.clone();
  stern.position.x = -2.72;
  stern.rotation.z = 0.35;
  ship.add(stern);

  const mast = cylinder(0.08, 0.11, 2.9, 7, 0x7b5635, 2.25);
  mast.position.x = 0;
  ship.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.45), material(0xe7d3a5, { opacity: 0.92 }));
  sail.position.set(0.78, 2.6, 0);
  sail.rotation.y = Math.PI / 2;
  ship.add(sail);

  const passengers = [];
  const seatColors = [0xe56b70, 0x68c2cc, 0xf1b85b, 0x8bc36e];
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const passenger = addPassenger(
        ship,
        -2 + column * 0.8,
        row === 0 ? -0.48 : 0.48,
        seatColors[(row * 6 + column) % seatColors.length]
      );
      passengers.push(passenger);
    }
  }

  const bulbs = [];
  for (let index = 0; index < 10; index += 1) {
    const x = -2.5 + index * (5 / 9);
    const bulb = sphere(0.09, 0xffd86a, 1.15);
    bulb.position.x = x;
    bulb.position.z = index % 2 ? 0.84 : -0.84;
    bulb.material = material(0x5b4920, { emissive: 0xffd55f, emissiveIntensity: 1.5 });
    ship.add(bulb);
    bulbs.push(bulb);
  }

  const conditionLight = sphere(0.16, 0xe86d77, 0.48);
  conditionLight.name = "galleon-condition-warning";
  conditionLight.position.x = 4.15;
  conditionLight.position.z = 2.15;
  conditionLight.visible = !entity.open || Number(entity.condition) < 35;
  conditionLight.material = material(0x5b2027, { emissive: 0xef5865, emissiveIntensity: 1.8 });
  group.add(conditionLight);

  const evolution = addEvolutionVisuals(group);
  evolution.sync(entity.evolutionLevel);

  const rideAnchor = new THREE.Object3D();
  rideAnchor.position.set(0.3, 1.38, 0);
  ship.add(rideAnchor);
  group.userData.rideAnchor = rideAnchor;

  const updateFrontage = addFrontage(group, definition);
  let phase = 0;
  let lastTime = null;
  group.userData.updateVisual = (time, liveEntity) => {
    const motion = deriveRideMotion(liveEntity, time);
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - lastTime));
    lastTime = time;
    phase += dt * motion.speed * 1.55;
    const amplitude = motion.active ? 0.82 : motion.waiting ? 0.12 : motion.open ? 0.035 : 0;
    pivot.rotation.z = Math.sin(phase) * amplitude;
    ship.rotation.y = Math.sin(phase * 0.5) * 0.025 * motion.boardingPulse;
    sail.rotation.z = Math.sin(time * 2.1) * 0.04 * (motion.open ? 1 : 0.2);
    passengers.forEach((passenger, index) => {
      passenger.visible = motion.active && index < motion.riderCount;
      passenger.rotation.x = -Math.sin(phase) * amplitude * 0.18;
    });
    bulbs.forEach((bulb, index) => {
      bulb.visible = motion.open;
      bulb.scale.setScalar(0.82 + Math.sin(time * 5.3 + index * 0.72) * 0.18 * (0.3 + motion.boardingPulse));
    });
    conditionLight.visible = !liveEntity.open || Number(liveEntity.condition) < 35;
    conditionLight.scale.setScalar(0.88 + Math.sin(time * 5.1) * 0.12);
    evolution.sync(liveEntity.evolutionLevel);
    if (evolution.root.userData.beacon) {
      evolution.root.userData.beacon.scale.setScalar(0.9 + Math.sin(time * 2.4) * 0.1);
    }
    updateFrontage(time, motion);
  };

  group.traverse((child) => { child.userData.entityId = entity.id; });
  return group;
}
