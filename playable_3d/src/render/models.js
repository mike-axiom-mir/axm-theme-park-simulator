import * as THREE from "../../vendor/three.module.min.js";
import { TILE_SIZE, catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { deriveRideMotion, deriveServiceMotion } from "../presentation/parkMotion.js";
import { pathDecorDescriptor, stableVisualPhase } from "../presentation/parkDecor.js";

const materialCache = new Map();
const geometryCache = new Map();

function material(color, options = {}) {
  const key = `${color}-${options.emissive ?? 0}-${options.opacity ?? 1}-${options.roughness ?? 0.86}-${options.metalness ?? 0.03}-${options.emissiveIntensity ?? 0}`;
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.86,
      metalness: options.metalness ?? 0.03,
      flatShading: true,
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

function cone(radius, height, sides, color, y = height / 2) {
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(radius, height, sides), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

function sphere(radius, detail, color, y = 0) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), material(color));
  mesh.position.y = y;
  mesh.castShadow = true;
  return mesh;
}

function addBase(group, width, depth, color = 0x645b54) {
  group.add(box(width * TILE_SIZE * 0.94, 0.22, depth * TILE_SIZE * 0.94, color, 0.11));
}

function advanceVisualPhase(state, time, speed) {
  if (state.lastTime === null) state.lastTime = time;
  const dt = Math.max(0, Math.min(0.1, time - state.lastTime));
  state.lastTime = time;
  state.phase += dt * speed;
  return state.phase;
}

function addRidePassenger(parent, x, y, z, color = 0x68c2cc) {
  const passenger = new THREE.Group();
  passenger.name = "animated-ride-passenger";
  passenger.position.set(x, y, z);
  passenger.userData.baseY = y;
  passenger.add(box(0.25, 0.34, 0.2, color, 0.17));
  passenger.add(sphere(0.14, 0, 0xd7aa82, 0.47));
  passenger.visible = false;
  parent.add(passenger);
  return passenger;
}

function updateRidePassengers(passengers, motion, time) {
  passengers.forEach((passenger, index) => {
    passenger.visible = motion.active && index < motion.riderCount;
    passenger.position.y = passenger.userData.baseY
      + Math.sin(time * 4.6 + index * 0.8) * 0.025 * motion.boardingPulse;
  });
}

function addRideFrontage(group, definition) {
  const root = new THREE.Group();
  root.name = "animated-ride-boarding-gate";
  root.position.z = definition.footprint[1] * TILE_SIZE * 0.45;
  const signPostA = box(0.09, 1.85, 0.09, 0x3f4852, 0.93);
  signPostA.position.x = -1.05;
  const signPostB = signPostA.clone();
  signPostB.position.x = 1.05;
  const marquee = box(2.35, 0.5, 0.16, definition.color, 1.72);
  const barrierPivot = new THREE.Group();
  barrierPivot.position.set(-0.92, 0.92, 0.18);
  const barrier = box(1.55, 0.1, 0.1, 0xe8cf8a, 0);
  barrier.position.x = 0.76;
  barrierPivot.add(barrier);
  const turnstile = new THREE.Group();
  turnstile.position.set(0.68, 0.58, 0.22);
  turnstile.add(cylinder(0.06, 0.08, 1.12, 6, 0x59636d, 0.56));
  for (let index = 0; index < 3; index += 1) {
    const arm = box(0.76, 0.07, 0.07, 0xe6c56f, 0.62);
    arm.position.x = 0.38;
    arm.rotation.y = index / 3 * Math.PI * 2;
    turnstile.add(arm);
  }
  const bulbs = [];
  for (const x of [-0.82, -0.28, 0.28, 0.82]) {
    const bulb = sphere(0.09, 0, 0xffdb72, 1.74);
    bulb.position.x = x;
    bulb.position.z = 0.1;
    bulb.material = material(0x624e22, { emissive: 0xffd35f, emissiveIntensity: 1.7 });
    root.add(bulb);
    bulbs.push(bulb);
  }
  root.add(signPostA, signPostB, marquee, barrierPivot, turnstile);
  group.add(root);
  let barrierAmount = 0;
  let lastTime = null;
  return (time, entity) => {
    const motion = deriveRideMotion(entity, time);
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - lastTime));
    lastTime = time;
    barrierAmount += ((motion.open ? 1 : 0) - barrierAmount) * (1 - Math.exp(-dt * 6));
    barrierPivot.rotation.z = -barrierAmount * 1.28;
    turnstile.rotation.y += dt * motion.turnstileSpeed;
    marquee.scale.y = motion.marqueePulse;
    bulbs.forEach((bulb, index) => {
      bulb.visible = motion.open;
      bulb.scale.setScalar(0.82 + Math.sin(time * 5.2 + index * 1.6) * 0.18 * (0.35 + motion.boardingPulse));
    });
  };
}

function createCarousel(definition) {
  const group = new THREE.Group();
  const rotor = new THREE.Group();
  const motionState = { phase: 0, lastTime: null };
  addBase(group, 3, 3, 0x8e6047);
  rotor.position.y = 0.22;
  rotor.add(cylinder(2.45, 2.45, 0.25, 16, 0xd88c56, 0.13));
  rotor.add(cylinder(0.12, 0.18, 3.6, 8, 0xffd36b, 1.9));
  rotor.add(cone(2.7, 1.25, 12, 0xb94d63, 3.82));
  const mounts = [];
  const bulbs = [];
  const passengers = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const mount = new THREE.Group();
    mount.position.set(Math.cos(angle) * 1.85, 0.2, Math.sin(angle) * 1.85);
    mount.add(cylinder(0.035, 0.035, 2.5, 5, 0xf6d88a, 1.5));
    const horse = box(0.72, 0.42, 0.24, index % 2 ? 0x69c9c4 : 0xf2c36b, 1.1);
    horse.position.x = 0.2;
    mount.add(horse);
    passengers.push(addRidePassenger(mount, 0.08, 1.26, 0, index % 2 ? 0xe56b70 : 0x68c2cc));
    if (index < 2) passengers.push(addRidePassenger(mount, -0.18, 1.24, 0, 0xf1b85b));
    rotor.add(mount);
    mounts.push(mount);
    const bulb = sphere(0.1, 0, 0xffdc73, 3.45);
    bulb.position.set(Math.cos(angle) * 2.18, 3.45, Math.sin(angle) * 2.18);
    bulb.material = material(0x5f4d24, { emissive: 0xffd45f, emissiveIntensity: 1.65 });
    rotor.add(bulb);
    bulbs.push(bulb);
  }
  const anchor = new THREE.Object3D();
  anchor.position.set(1.8, 1.55, 0);
  rotor.add(anchor);
  group.add(rotor);
  group.userData.rideAnchor = anchor;
  group.userData.updateVisual = (time, entity) => {
    const motion = deriveRideMotion(entity, time);
    const phase = advanceVisualPhase(motionState, time, motion.speed * 0.78);
    rotor.rotation.y = phase;
    mounts.forEach((mount, index) => {
      mount.position.y = 0.2 + Math.sin(phase * 2.4 + index) * (0.04 + motion.boardingPulse * 0.2);
    });
    bulbs.forEach((bulb, index) => {
      const chase = 0.84 + Math.sin(phase * 9 - index * 1.35) * 0.16 * (0.3 + motion.boardingPulse);
      bulb.scale.setScalar(chase);
      bulb.visible = motion.open;
    });
    updateRidePassengers(passengers, motion, time);
  };
  return group;
}

function createWheel() {
  const group = new THREE.Group();
  const motionState = { phase: 0, lastTime: null };
  addBase(group, 4, 2, 0x59636a);
  const supportColor = 0x4b7588;
  const wheel = new THREE.Group();
  wheel.position.y = 3.9;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.12, 6, 24), material(0x68cad4));
  rim.castShadow = true;
  wheel.add(rim);
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const spoke = box(0.07, 3.05, 0.07, 0xa4dce1, 1.52);
    spoke.rotation.z = angle + Math.PI / 2;
    wheel.add(spoke);
  }
  const cabins = [];
  const rimBulbs = [];
  const passengers = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * 3.15, Math.sin(angle) * 3.15, 0);
    const cabin = box(0.75, 0.55, 0.62, index % 2 ? 0xf0bd58 : 0xe56b70, -0.2);
    pivot.add(cabin);
    passengers.push(addRidePassenger(pivot, -0.2, -0.02, 0, index % 2 ? 0x8bc36e : 0xf1b85b));
    passengers.push(addRidePassenger(pivot, 0.2, -0.02, 0, index % 2 ? 0x68c2cc : 0xe35f68));
    wheel.add(pivot);
    cabins.push(pivot);
    const bulb = sphere(0.11, 0, 0xffdf75, 0);
    bulb.position.set(Math.cos(angle) * 3.15, Math.sin(angle) * 3.15, 0.16);
    bulb.material = material(0x5b4d26, { emissive: 0xffd968, emissiveIntensity: 1.6 });
    wheel.add(bulb);
    rimBulbs.push(bulb);
  }
  const legA = box(0.22, 6.8, 0.22, supportColor, 3.25);
  legA.position.x = -1.55;
  legA.rotation.z = -0.23;
  const legB = legA.clone();
  legB.position.x = 1.55;
  legB.rotation.z = 0.23;
  group.add(legA, legB, wheel);
  const anchor = new THREE.Object3D();
  cabins[0].add(anchor);
  anchor.position.set(0, -0.05, 0.8);
  group.userData.rideAnchor = anchor;
  group.userData.updateVisual = (time, entity) => {
    const motion = deriveRideMotion(entity, time);
    const angle = advanceVisualPhase(motionState, time, motion.speed * 0.3);
    wheel.rotation.z = angle;
    cabins.forEach((cabin, index) => {
      cabin.rotation.z = -angle + Math.sin(time * 2.2 + index) * 0.055 * motion.boardingPulse;
    });
    rimBulbs.forEach((bulb, index) => {
      bulb.visible = motion.open;
      bulb.scale.setScalar(0.82 + Math.sin(time * 4.4 - index * 0.9) * 0.18 * (0.35 + motion.boardingPulse));
    });
    updateRidePassengers(passengers, motion, time);
  };
  return group;
}

function createCoaster() {
  const group = new THREE.Group();
  const motionState = { phase: 0, lastTime: null };
  addBase(group, 7, 5, 0x455b43);
  const points = [
    new THREE.Vector3(-5.2, 0.8, -2.7), new THREE.Vector3(-4.3, 4.6, -2.8),
    new THREE.Vector3(-1.2, 6.4, -2.5), new THREE.Vector3(2.8, 2.3, -2.0),
    new THREE.Vector3(5.1, 1.1, 0.2), new THREE.Vector3(3.6, 3.5, 2.8),
    new THREE.Vector3(0.5, 1.35, 3.0), new THREE.Vector3(-3.3, 2.5, 2.2),
    new THREE.Vector3(-5.2, 0.8, -0.2)
  ];
  const curve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.46);
  const track = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, 0.13, 5, true),
    material(0xdc5964, { metalness: 0.16 })
  );
  track.castShadow = true;
  group.add(track);
  for (let index = 0; index < 18; index += 1) {
    const point = curve.getPointAt(index / 18);
    const support = cylinder(0.08, 0.11, Math.max(0.25, point.y), 5, 0x476875, point.y / 2);
    support.position.x = point.x;
    support.position.z = point.z;
    group.add(support);
  }
  const station = box(3.2, 1.3, 1.8, 0x805342, 0.76);
  station.position.set(-3.7, 0, -0.1);
  group.add(station);
  const train = new THREE.Group();
  const trainLights = [];
  const passengers = [];
  for (let index = 0; index < 3; index += 1) {
    const car = box(0.9, 0.48, 0.68, index === 0 ? 0xffcc56 : 0xf28a52, 0.22);
    car.position.z = index * 0.72;
    train.add(car);
    for (const [seatIndex, x] of [-0.22, 0, 0.22].entries()) {
      passengers.push(addRidePassenger(train, x, 0.38, index * 0.72,
        [0xe35f68, 0x68c2cc, 0xf1b85b][(index + seatIndex) % 3]));
    }
    const light = sphere(0.09, 0, 0xffe186, 0.43);
    light.position.set(0, 0.43, index * 0.72 - 0.28);
    light.material = material(0x5a4b24, { emissive: 0xffd764, emissiveIntensity: 1.75 });
    train.add(light);
    trainLights.push(light);
  }
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.75, -0.9);
  train.add(anchor);
  group.add(train);
  group.userData.rideAnchor = anchor;
  group.userData.updateVisual = (time, entity) => {
    const motion = deriveRideMotion(entity, time);
    const phase = advanceVisualPhase(motionState, time, motion.speed * 0.115) % 1;
    const point = curve.getPointAt(phase);
    const ahead = curve.getPointAt((phase + 0.006) % 1);
    train.position.copy(point);
    train.lookAt(ahead);
    trainLights.forEach((light, index) => {
      light.visible = motion.open;
      light.scale.setScalar(0.85 + Math.sin(time * 7 - index * 1.4) * 0.15 * (0.3 + motion.boardingPulse));
    });
    updateRidePassengers(passengers, motion, time);
  };
  return group;
}

function createSplash() {
  const group = new THREE.Group();
  const motionState = { phase: 0, lastTime: null };
  addBase(group, 5, 4, 0x466d54);
  const waterMaterial = material(0x3e9ac3, { roughness: 0.35, opacity: 0.92 });
  const channel = new THREE.Mesh(new THREE.TorusGeometry(3.25, 0.72, 6, 24), waterMaterial);
  channel.rotation.x = Math.PI / 2;
  channel.scale.z = 0.7;
  channel.position.y = 0.32;
  group.add(channel);
  const boat = new THREE.Group();
  boat.add(box(1.15, 0.35, 0.62, 0xe3a850, 0.24));
  boat.add(box(0.55, 0.45, 0.42, 0xf7d98a, 0.5));
  const passengers = [];
  for (const [row, z] of [-0.14, 0.14].entries()) {
    for (const [seat, x] of [-0.36, -0.12, 0.12, 0.36].entries()) {
      passengers.push(addRidePassenger(boat, x, 0.43, z,
        [0x68c2cc, 0xf1b85b, 0xe35f68, 0x8bc36e][(row + seat) % 4]));
    }
  }
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.85, 0.2);
  boat.add(anchor);
  group.add(boat);
  const splashDrops = [];
  for (let index = 0; index < 7; index += 1) {
    const drop = sphere(0.16 + index % 3 * 0.035, 0, 0x88deef, 0);
    drop.material = material(0x4c9fb6, { emissive: 0x2b6f84, emissiveIntensity: 0.35, opacity: 0.78 });
    group.add(drop);
    splashDrops.push(drop);
  }
  group.userData.rideAnchor = anchor;
  group.userData.updateVisual = (time, entity) => {
    const motion = deriveRideMotion(entity, time);
    const angle = advanceVisualPhase(motionState, time, motion.speed * 0.48);
    boat.position.set(Math.cos(angle) * 3.25, 0.58 + Math.sin(angle * 3) * 0.12, Math.sin(angle) * 2.3);
    boat.rotation.y = -angle + Math.PI / 2;
    const splashStrength = motion.active * Math.max(0, Math.sin(angle));
    splashDrops.forEach((drop, index) => {
      const dropPhase = (time * 1.8 + index * 0.17) % 1;
      const spread = (index - 3) * 0.24;
      drop.visible = splashStrength > 0.2;
      drop.position.set(-3.05 + spread, 0.35 + Math.sin(dropPhase * Math.PI) * (0.7 + index % 2 * 0.25), spread * 0.45);
      drop.scale.setScalar((1 - dropPhase * 0.45) * splashStrength);
    });
    updateRidePassengers(passengers, motion, time);
  };
  return group;
}

function createHaunted() {
  const group = new THREE.Group();
  const windows = [];
  addBase(group, 4, 3, 0x3e4146);
  const house = box(6.6, 3.4, 4.5, 0x4e4057, 1.92);
  group.add(house);
  const roof = cone(4.6, 2.4, 4, 0x252332, 4.45);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.74;
  group.add(roof);
  for (const x of [-2.05, 0, 2.05]) {
    const windowMesh = box(0.7, 0.85, 0.08, 0xe6b85c, 2.25);
    windowMesh.position.x = x;
    windowMesh.position.z = 2.29;
    windowMesh.material = material(0x554426, { emissive: 0xe6a850, emissiveIntensity: 0.8 });
    group.add(windowMesh);
    windows.push(windowMesh);
  }
  const tower = cylinder(0.68, 0.82, 4.8, 6, 0x66516f, 2.5);
  tower.position.set(2.3, 0, -1.1);
  group.add(tower);
  const ghosts = [];
  for (let index = 0; index < 3; index += 1) {
    const ghost = new THREE.Group();
    const body = sphere(0.32, 0, 0xb9dce5, 0.35);
    body.material = material(0x65848d, { emissive: 0x8bc6d4, emissiveIntensity: 0.8, opacity: 0.7 });
    const tail = cone(0.34, 0.65, 5, 0x88b6c1, -0.08);
    tail.rotation.z = Math.PI;
    tail.material = body.material;
    ghost.add(body, tail);
    group.add(ghost);
    ghosts.push(ghost);
  }
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 2.1, 3.3);
  group.add(anchor);
  group.userData.rideAnchor = anchor;
  group.userData.updateVisual = (time, entity) => {
    const motion = deriveRideMotion(entity, time);
    tower.rotation.y = Math.sin(time * 0.9) * (0.015 + motion.boardingPulse * 0.04);
    windows.forEach((windowMesh, index) => {
      const flicker = motion.open ? 0.83 + Math.sin(time * (3.1 + index * 0.3) + index * 2) * 0.17 : 0.58;
      windowMesh.scale.set(1, flicker, 1);
    });
    ghosts.forEach((ghost, index) => {
      const angle = time * (0.38 + motion.speed * 0.65) + index / ghosts.length * Math.PI * 2;
      ghost.visible = motion.active;
      ghost.position.set(Math.cos(angle) * (2.2 + index * 0.22), 3.2 + Math.sin(time * 1.7 + index) * 0.5, Math.sin(angle) * 2.25);
      ghost.rotation.y = -angle + Math.PI / 2;
      ghost.scale.setScalar(0.82 + Math.sin(time * 2.4 + index) * 0.12);
    });
  };
  return group;
}

function createSpinner() {
  const group = new THREE.Group();
  const motionState = { phase: 0, lastTime: null };
  addBase(group, 3, 3, 0x61516b);
  group.add(cylinder(0.55, 0.75, 2.2, 8, 0xb76aa1, 1.25));
  const rotor = new THREE.Group();
  rotor.position.y = 2.25;
  const anchors = [];
  const passengers = [];
  for (let index = 0; index < 6; index += 1) {
    const arm = new THREE.Group();
    arm.rotation.y = index / 6 * Math.PI * 2;
    const beam = box(0.15, 0.15, 2.7, 0xe8b9de, 0);
    beam.position.z = 1.35;
    arm.add(beam);
    const seat = box(0.8, 0.48, 0.55, index % 2 ? 0x69ced0 : 0xf0b85c, 0);
    seat.position.set(0, 0, 2.9);
    arm.add(seat);
    passengers.push(addRidePassenger(arm, 0, 0.2, 2.9, index % 2 ? 0x68c2cc : 0xf1b85b));
    if (index < 2) passengers.push(addRidePassenger(arm, index ? 0.2 : -0.2, 0.18, 2.9, 0xe35f68));
    rotor.add(arm);
    anchors.push(arm);
  }
  const anchor = new THREE.Object3D();
  anchor.position.set(0, 0.55, 3.1);
  anchors[0].add(anchor);
  rotor.add(cone(0.8, 1.5, 8, 0xf0d167, 0.8));
  group.add(rotor);
  group.userData.rideAnchor = anchor;
  group.userData.updateVisual = (time, entity) => {
    const motion = deriveRideMotion(entity, time);
    const phase = advanceVisualPhase(motionState, time, motion.speed * 1.1);
    rotor.rotation.y = phase;
    rotor.position.y = 2.25 + Math.sin(phase * 1.7) * (0.05 + motion.boardingPulse * 0.3);
    anchors.forEach((arm, index) => {
      arm.rotation.z = Math.sin(phase * 2 + index * 0.8) * 0.14 * motion.boardingPulse;
    });
    updateRidePassengers(passengers, motion, time);
  };
  return group;
}

function createService(definition) {
  const group = new THREE.Group();
  group.name = `animated-service-${definition.id}`;
  const [width, depth] = definition.footprint;
  const front = depth * TILE_SIZE * 0.38;
  addBase(group, width, depth, 0x58504a);
  const building = box(width * TILE_SIZE * 0.78, 2.45, depth * TILE_SIZE * 0.74, definition.color, 1.34);
  group.add(building);
  const roof = cone(Math.max(width, depth) * 1.25, 1.25, 4, 0x3e3540, 3.05);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = depth / width;
  group.add(roof);

  const signRoot = new THREE.Group();
  signRoot.name = "animated-service-sign";
  signRoot.position.set(0, 3.25, front + 0.16);
  const sign = box(1.75, 0.58, 0.16, definition.color, 0);
  signRoot.add(sign);
  const signBulbs = [];
  for (const x of [-0.62, 0, 0.62]) {
    const bulb = sphere(0.09, 0, 0xffdf79, 0);
    bulb.position.set(x, 0.02, 0.12);
    bulb.material = material(0x5f4d24, { emissive: 0xffd866, emissiveIntensity: 1.7 });
    signRoot.add(bulb);
    signBulbs.push(bulb);
  }
  group.add(signRoot);

  const shutter = box(width * 1.16, 1.42, 0.14, 0x4a535d, 1.62);
  shutter.name = "animated-service-shutter";
  shutter.position.z = front + 0.14;
  group.add(shutter);
  const activityLight = sphere(0.13, 0, 0x8ff3a0, 2.28);
  activityLight.position.set(width * 0.62, 2.28, front + 0.24);
  activityLight.material = material(0x315b35, { emissive: 0x65e678, emissiveIntensity: 1.6 });
  group.add(activityLight);

  let updateServiceProp = () => {};
  if (definition.id === "snacks") {
    const counter = box(width * 1.05, 0.72, 0.46, 0xf3d6a2, 0.92);
    counter.position.z = front + 0.32;
    group.add(counter);
    const belt = box(1.85, 0.11, 0.46, 0x38434b, 1.35);
    belt.position.z = front + 0.36;
    group.add(belt);
    const snacks = [];
    for (let index = 0; index < 4; index += 1) {
      const snack = new THREE.Group();
      snack.name = "animated-snack-tray";
      snack.add(cylinder(0.18, 0.2, 0.12, 8, 0xe0a84d, 0));
      const filling = cylinder(0.19, 0.19, 0.07, 8, 0x72a95b, 0.08);
      const bun = cylinder(0.16, 0.2, 0.13, 8, 0xeac068, 0.17);
      snack.add(filling, bun);
      group.add(snack);
      snacks.push(snack);
    }
    const rocket = new THREE.Group();
    rocket.position.set(0, 4.05, 0);
    const body = cylinder(0.18, 0.25, 0.9, 7, 0xf4e0b5, 0);
    const nose = cone(0.25, 0.42, 7, 0xe45f61, 0.65);
    rocket.add(body, nose);
    group.add(rocket);
    updateServiceProp = (time, motion, phase) => {
      snacks.forEach((snack, index) => {
        const beltPhase = (phase * 0.36 + index / snacks.length) % 1;
        snack.position.set(-0.78 + beltPhase * 1.56, 1.48, front + 0.36);
        snack.visible = motion.open;
      });
      rocket.rotation.y = phase * 0.85;
      rocket.position.y = 4.05 + Math.sin(time * 2.1) * 0.09 * motion.servicePulse;
    };
  } else if (definition.id === "drinks") {
    const counter = box(width * 1.05, 0.72, 0.46, 0xe2f0f4, 0.92);
    counter.position.z = front + 0.32;
    group.add(counter);
    const tank = cylinder(0.48, 0.48, 1.15, 10, 0x71cce5, 1.65);
    tank.position.set(-0.38, 1.65, front + 0.02);
    group.add(tank);
    const cup = cylinder(0.22, 0.17, 0.48, 8, 0xf2f0df, 1.47);
    cup.position.set(0.62, 1.47, front + 0.35);
    const straw = box(0.06, 0.65, 0.06, 0xe35f68, 1.88);
    straw.position.set(0.68, 1.88, front + 0.35);
    group.add(cup, straw);
    const bubbles = [];
    for (let index = 0; index < 6; index += 1) {
      const bubble = sphere(0.1 + index % 2 * 0.035, 0, 0xb7eff6, 0);
      bubble.material = material(0x579bb0, { emissive: 0x58bad2, emissiveIntensity: 0.55, opacity: 0.68 });
      group.add(bubble);
      bubbles.push(bubble);
    }
    updateServiceProp = (time, motion, phase) => {
      bubbles.forEach((bubble, index) => {
        const rise = (phase * 0.45 + index / bubbles.length) % 1;
        bubble.visible = motion.active;
        bubble.position.set(-0.38 + Math.sin(index * 2.2) * 0.26, 1.1 + rise * 2.05, front + 0.48);
        bubble.scale.setScalar(0.62 + (1 - rise) * 0.5);
      });
      cup.rotation.y = Math.sin(time * 2.7) * 0.08 * motion.servicePulse;
      straw.rotation.z = Math.sin(time * 3.2) * 0.08 * motion.servicePulse;
    };
  } else {
    const step = box(width * 1.2, 0.2, 0.62, 0xd4e0d5, 0.3);
    step.position.z = front + 0.38;
    group.add(step);
    const doorPivots = [];
    for (const [index, x] of [-0.72, 0.72].entries()) {
      const pivot = new THREE.Group();
      pivot.name = "animated-comfort-door";
      pivot.position.set(x + (index === 0 ? -0.55 : 0.55), 0, front + 0.16);
      const door = box(1.08, 1.86, 0.14, index === 0 ? 0xcde6d1 : 0xb9d8c1, 1.38);
      door.position.x = index === 0 ? 0.54 : -0.54;
      pivot.add(door);
      group.add(pivot);
      doorPivots.push(pivot);
    }
    const availableLight = sphere(0.12, 0, 0x7be58e, 2.48);
    availableLight.position.set(-0.72, 2.48, front + 0.28);
    availableLight.material = material(0x315b35, { emissive: 0x5be26f, emissiveIntensity: 1.6 });
    const occupiedLight = sphere(0.12, 0, 0xef6971, 2.48);
    occupiedLight.position.set(0.72, 2.48, front + 0.28);
    occupiedLight.material = material(0x5d292e, { emissive: 0xef5965, emissiveIntensity: 1.6 });
    group.add(availableLight, occupiedLight);
    updateServiceProp = (time, motion) => {
      const doorSwing = motion.open ? 0.06 + motion.servicePulse * (0.42 + Math.sin(time * 1.55) * 0.08) : 0;
      doorPivots[0].rotation.y = doorSwing;
      doorPivots[1].rotation.y = -doorSwing;
      availableLight.visible = motion.open && !motion.active;
      occupiedLight.visible = motion.open && motion.active;
    };
  }

  let shutterAmount = 0;
  let lastTime = null;
  const propMotionState = { phase: 0, lastTime: null };
  group.userData.updateVisual = (time, entity) => {
    const motion = deriveServiceMotion(entity, time);
    const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - lastTime));
    lastTime = time;
    shutterAmount += (motion.shutterTarget - shutterAmount) * (1 - Math.exp(-dt * 6));
    shutter.position.y = 1.62 + shutterAmount * 1.24;
    shutter.scale.y = 1 - shutterAmount * 0.7;
    signRoot.scale.setScalar(motion.signPulse);
    signBulbs.forEach((bulb, index) => {
      bulb.visible = motion.open;
      bulb.scale.setScalar(0.82 + Math.sin(time * 5.4 - index * 1.4) * 0.18 * (0.3 + motion.servicePulse));
    });
    activityLight.visible = motion.active || motion.waiting;
    activityLight.scale.setScalar(0.82 + Math.sin(time * 5.6) * 0.18 * (0.35 + motion.servicePulse));
    const phase = advanceVisualPhase(propMotionState, time, motion.counterSpeed * 1.45);
    updateServiceProp(time, motion, phase);
  };
  return group;
}

function createScenery(definition) {
  const group = new THREE.Group();
  if (definition.id === "tree") {
    group.add(cylinder(0.15, 0.28, 2.8, 6, 0x76502e, 1.4));
    const crownRoot = new THREE.Group();
    crownRoot.name = "animated-tree-canopy";
    crownRoot.position.y = 2.62;
    const crownA = sphere(1.25, 0, 0x3f8f55, 0.53);
    const crownB = sphere(0.85, 0, 0x58a75c, 1.48);
    crownB.position.x = 0.35;
    const leafClusters = [];
    for (let index = 0; index < 4; index += 1) {
      const angle = index / 4 * Math.PI * 2;
      const cluster = sphere(0.38, 0, index % 2 ? 0x69b868 : 0x4f9f58, 0.92 + index % 2 * 0.28);
      cluster.position.x = Math.cos(angle) * 0.92;
      cluster.position.z = Math.sin(angle) * 0.78;
      crownRoot.add(cluster);
      leafClusters.push(cluster);
    }
    crownRoot.add(crownA, crownB);
    group.add(crownRoot);
    group.userData.updateVisual = (time, entity) => {
      const phase = stableVisualPhase(entity?.id);
      const sway = Math.sin(time * 1.15 + phase) * 0.045 + Math.sin(time * 2.7 + phase * 0.4) * 0.014;
      crownRoot.rotation.z = sway;
      crownRoot.rotation.x = Math.sin(time * 0.86 + phase) * 0.026;
      leafClusters.forEach((cluster, index) => {
        cluster.scale.setScalar(0.96 + Math.sin(time * 1.8 + phase + index * 1.3) * 0.04);
      });
    };
  } else if (definition.id === "lantern") {
    group.add(cylinder(0.08, 0.13, 2.4, 6, 0x39434e, 1.2));
    const lanternHead = new THREE.Group();
    lanternHead.name = "animated-lantern-head";
    lanternHead.position.y = 2.38;
    const glow = box(0.38, 0.55, 0.38, 0xf6d365, 0);
    glow.material = material(0x5c4d23, { emissive: 0xf6c95a, emissiveIntensity: 1.2 });
    const cap = cone(0.34, 0.36, 4, 0x39434e, 0.43);
    cap.rotation.y = Math.PI / 4;
    lanternHead.add(glow, cap);
    group.add(lanternHead);
    const moths = [];
    for (let index = 0; index < 2; index += 1) {
      const moth = sphere(0.07, 0, 0xf6e5a4, 0);
      moth.name = "animated-lantern-moth";
      moth.material = material(0x665d35, { emissive: 0xffe58a, emissiveIntensity: 1.1 });
      group.add(moth);
      moths.push(moth);
    }
    group.userData.updateVisual = (time, entity) => {
      const phase = stableVisualPhase(entity?.id);
      lanternHead.rotation.z = Math.sin(time * 1.35 + phase) * 0.035;
      glow.scale.setScalar(0.9 + Math.sin(time * 4.2 + phase) * 0.1);
      moths.forEach((moth, index) => {
        const angle = time * (1.2 + index * 0.32) + phase + index * Math.PI;
        moth.position.set(Math.cos(angle) * (0.46 + index * 0.12), 2.42 + Math.sin(angle * 1.7) * 0.22, Math.sin(angle) * 0.46);
      });
    };
  } else if (definition.id === "fountain") {
    group.add(cylinder(1.65, 1.8, 0.4, 12, 0x737c83, 0.2));
    group.add(cylinder(1.35, 1.35, 0.18, 12, 0x55b6d1, 0.48));
    group.add(cylinder(0.12, 0.28, 1.65, 8, 0x8c969d, 1.15));
    const water = cone(0.42, 1.4, 7, 0x83d7e7, 2.1);
    water.material = material(0x5bafc2, { emissive: 0x275d6c, emissiveIntensity: 0.25, opacity: 0.8 });
    const ripple = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.055, 5, 18),
      material(0x69c6dc, { emissive: 0x275d6c, emissiveIntensity: 0.2, opacity: 0.72 })
    );
    ripple.name = "animated-fountain-ripple";
    ripple.position.y = 0.61;
    ripple.rotation.x = Math.PI / 2;
    const droplets = [];
    for (let index = 0; index < 8; index += 1) {
      const droplet = sphere(0.1, 0, 0x91dfed, 0);
      droplet.name = "animated-fountain-droplet";
      droplet.material = material(0x5bafc2, { emissive: 0x275d6c, emissiveIntensity: 0.3, opacity: 0.76 });
      group.add(droplet);
      droplets.push(droplet);
    }
    group.add(water, ripple);
    group.userData.updateVisual = (time, entity) => {
      const phase = stableVisualPhase(entity?.id);
      water.scale.y = 0.9 + Math.sin(time * 3 + phase) * 0.08;
      ripple.scale.setScalar(0.84 + ((time * 0.42 + phase) % 1) * 0.34);
      droplets.forEach((droplet, index) => {
        const arc = (time * 0.58 + index / droplets.length + phase / (Math.PI * 2)) % 1;
        const angle = index / droplets.length * Math.PI * 2 + phase;
        const radius = 0.26 + Math.sin(arc * Math.PI) * 0.92;
        droplet.position.set(Math.cos(angle) * radius, 0.72 + Math.sin(arc * Math.PI) * 1.35, Math.sin(angle) * radius);
        droplet.scale.setScalar(0.72 + (1 - arc) * 0.32);
      });
    };
  } else if (definition.id === "bench") {
    const seat = box(1.45, 0.18, 0.48, 0x8b5e3c, 0.72);
    const back = box(1.45, 0.62, 0.14, 0x8b5e3c, 1.03);
    back.position.z = -0.2;
    const legA = box(0.12, 0.7, 0.12, 0x3d454b, 0.35);
    legA.position.x = -0.5;
    const legB = legA.clone();
    legB.position.x = 0.5;
    const flowerRoots = [];
    for (let index = 0; index < 4; index += 1) {
      const flower = new THREE.Group();
      flower.name = "animated-bench-flower";
      flower.position.set(index < 2 ? -0.94 : 0.94, 0.12, index % 2 ? 0.28 : -0.22);
      flower.add(cylinder(0.025, 0.035, 0.42 + index % 2 * 0.1, 5, 0x4f9850, 0.22));
      const bloom = sphere(0.13, 0, index % 2 ? 0xe987a8 : 0xf1c65c, 0.48 + index % 2 * 0.1);
      flower.add(bloom);
      group.add(flower);
      flowerRoots.push(flower);
    }
    const planterA = box(0.46, 0.28, 0.62, 0x6d5546, 0.2);
    planterA.position.x = -0.94;
    const planterB = planterA.clone();
    planterB.position.x = 0.94;
    group.add(seat, back, legA, legB, planterA, planterB);
    group.userData.updateVisual = (time, entity) => {
      const phase = stableVisualPhase(entity?.id);
      flowerRoots.forEach((flower, index) => {
        flower.rotation.z = Math.sin(time * 1.6 + phase + index * 0.8) * 0.075;
        flower.rotation.x = Math.sin(time * 1.05 + phase + index) * 0.035;
      });
    };
  }
  group.userData.updateVisual ??= () => {};
  return group;
}

function refreshEvolutionDecor(group, entity, definition) {
  if (group.userData.appliedEvolution === entity.evolutionLevel) return;
  group.userData.appliedEvolution = entity.evolutionLevel;
  const root = group.userData.evolutionRoot;
  while (root.children.length) root.remove(root.children[0]);
  if (entity.evolutionLevel < 1 || definition.kind !== "ride") return;
  const [width, depth] = definition.footprint;
  const front = depth * TILE_SIZE * 0.43;
  const signPost = cylinder(0.055, 0.075, 2.25, 5, 0x443d42, 1.12);
  signPost.position.set(-width * TILE_SIZE * 0.3, 1.12, front);
  const sign = box(1.35, 0.48, 0.12, definition.color, 2.08);
  sign.position.set(-width * TILE_SIZE * 0.3, 2.08, front);
  root.add(signPost, sign);
  if (entity.evolutionLevel >= 2) {
    const halfX = width * TILE_SIZE * 0.39;
    const halfZ = depth * TILE_SIZE * 0.39;
    for (const [x, z] of [[-halfX, -halfZ], [halfX, -halfZ], [-halfX, halfZ], [halfX, halfZ]]) {
      const post = cylinder(0.045, 0.065, 1.45, 5, 0x3c4650, 0.72);
      post.position.set(x, 0.72, z);
      const lamp = sphere(0.16, 0, 0xf6d365, 1.55);
      lamp.position.set(x, 1.55, z);
      lamp.material = material(0x6e5a24, { emissive: 0xf6d365, emissiveIntensity: 1.45 });
      root.add(post, lamp);
    }
  }
  if (entity.evolutionLevel >= 3) {
    const beacon = sphere(0.34, 1, 0xffdd79, 4.4);
    beacon.material = material(0x8a6c25, { emissive: 0xffcc55, emissiveIntensity: 1.8 });
    root.add(beacon);
    root.userData.beacon = beacon;
  }
}

export function createEntityModel(entity) {
  const definition = catalogDefinition(entity.catalogId);
  let group;
  if (definition.id === "carousel") group = createCarousel(definition);
  else if (definition.id === "wheel") group = createWheel(definition);
  else if (definition.id === "coaster") group = createCoaster(definition);
  else if (definition.id === "splash") group = createSplash(definition);
  else if (definition.id === "haunted") group = createHaunted(definition);
  else if (definition.id === "spinner") group = createSpinner(definition);
  else if (definition.kind === "service") group = createService(definition);
  else group = createScenery(definition);
  group.name = entity.id;
  group.userData.entityId = entity.id;
  group.userData.definition = definition;
  const frontageUpdate = definition.kind === "ride" ? addRideFrontage(group, definition) : null;
  const originalUpdate = group.userData.updateVisual ?? (() => {});
  const evolutionRoot = new THREE.Group();
  group.add(evolutionRoot);
  const statusLight = sphere(0.14, 0, 0xe55d69, 0.52);
  statusLight.material = material(0x551b23, { emissive: 0xf04e5d, emissiveIntensity: 1.7 });
  statusLight.position.set(definition.footprint[0] * TILE_SIZE * 0.4, 0.52, definition.footprint[1] * TILE_SIZE * 0.4);
  group.add(statusLight);
  group.userData.evolutionRoot = evolutionRoot;
  group.userData.appliedEvolution = -1;
  group.userData.updateVisual = (time, liveEntity) => {
    refreshEvolutionDecor(group, liveEntity, definition);
    statusLight.visible = !liveEntity.open || liveEntity.condition < 35;
    if (evolutionRoot.userData.beacon) evolutionRoot.userData.beacon.scale.setScalar(0.92 + Math.sin(time * 2.2) * 0.08);
    originalUpdate(time, liveEntity);
    frontageUpdate?.(time, liveEntity);
  };
  refreshEvolutionDecor(group, entity, definition);
  group.traverse((child) => { child.userData.entityId = entity.id; });
  return group;
}

export function createPathModel(type = "path", x = 0, z = 0) {
  const group = new THREE.Group();
  const descriptor = pathDecorDescriptor(x, z, type);
  group.userData.decorDescriptor = descriptor;
  const color = type === "queue" ? 0x6e9aaa : 0xb7a27c;
  const tile = box(TILE_SIZE * 0.9, 0.16, TILE_SIZE * 0.9, color, 0.08);
  tile.receiveShadow = true;
  group.add(tile);
  const insetColors = type === "queue"
    ? [0x8bb1bd, 0x83aab7, 0x91b7c1, 0x7fa4b1]
    : [0xc7b58f, 0xc0aa82, 0xd0bf9b, 0xb9a17a];
  const inset = box(1.05, 0.045, 1.05, insetColors[descriptor.variant], 0.18);
  inset.name = "path-inset-stone";
  inset.rotation.y = descriptor.variant * Math.PI / 8;
  group.add(inset);
  if (type === "queue") {
    for (const x of [-0.62, 0.62]) {
      const rail = box(0.07, 0.46, 1.55, 0xe3d8be, 0.36);
      rail.position.x = x;
      group.add(rail);
    }
    if (descriptor.animatedAccent) {
      const pennants = [];
      for (const [index, side] of [-0.62, 0.62].entries()) {
        const pivot = new THREE.Group();
        pivot.name = "animated-queue-pennant";
        pivot.position.set(side, 0.72, index ? -0.38 : 0.38);
        const flag = cone(0.18, 0.38, 3, index ? 0xf1c65c : 0xe77d8b, 0);
        flag.rotation.z = index ? Math.PI / 2 : -Math.PI / 2;
        flag.position.x = index ? -0.18 : 0.18;
        pivot.add(flag);
        group.add(pivot);
        pennants.push(pivot);
      }
      group.userData.updateVisual = (time) => {
        pennants.forEach((pennant, index) => {
          pennant.rotation.z = Math.sin(time * 3.2 + descriptor.phase + index * 1.4) * 0.13;
          pennant.rotation.y = Math.sin(time * 2.1 + descriptor.phase + index) * 0.09;
        });
      };
    }
  } else {
    if (descriptor.natureAccent) {
      const tuft = new THREE.Group();
      tuft.name = "path-nature-accent";
      tuft.position.set(descriptor.variant % 2 ? -0.76 : 0.76, 0.18, descriptor.variant < 2 ? -0.72 : 0.72);
      for (let index = 0; index < 3; index += 1) {
        const blade = cone(0.08, 0.34 + index * 0.06, 4, index % 2 ? 0x67a65c : 0x4f8f50, 0.19);
        blade.position.x = (index - 1) * 0.1;
        blade.rotation.z = (index - 1) * 0.15;
        tuft.add(blade);
      }
      group.add(tuft);
    }
    if (descriptor.animatedAccent) {
      const flower = new THREE.Group();
      flower.name = "animated-path-flower";
      flower.position.set(descriptor.variant % 2 ? 0.72 : -0.72, 0.18, descriptor.variant < 2 ? 0.7 : -0.7);
      flower.add(cylinder(0.025, 0.035, 0.48, 5, 0x4f9850, 0.24));
      const bloom = sphere(0.14, 0, descriptor.variant % 2 ? 0xe987a8 : 0xf1c65c, 0.53);
      flower.add(bloom);
      group.add(flower);
      group.userData.updateVisual = (time) => {
        flower.rotation.z = Math.sin(time * 1.8 + descriptor.phase) * 0.11;
        flower.rotation.x = Math.sin(time * 1.22 + descriptor.phase * 0.7) * 0.055;
        bloom.scale.setScalar(0.94 + Math.sin(time * 2.4 + descriptor.phase) * 0.06);
      };
    }
  }
  return group;
}

export function createEntranceModel() {
  const group = new THREE.Group();
  const left = box(0.55, 3.6, 0.55, 0x805568, 1.8);
  left.position.x = -1.7;
  const right = left.clone();
  right.position.x = 1.7;
  const beam = box(4.0, 0.55, 0.65, 0xd5a557, 3.45);
  const crown = cone(1.0, 1.25, 5, 0xe6c260, 4.3);
  const leftGate = new THREE.Group();
  const rightGate = new THREE.Group();
  leftGate.position.set(-1.42, 0, 0.08);
  rightGate.position.set(1.42, 0, 0.08);
  const leftPanel = box(1.34, 1.42, 0.14, 0x9b6e67, 0.78);
  leftPanel.position.x = 0.67;
  const rightPanel = box(1.34, 1.42, 0.14, 0x9b6e67, 0.78);
  rightPanel.position.x = -0.67;
  for (const panel of [leftPanel, rightPanel]) {
    for (const x of [-0.42, 0, 0.42]) {
      const bar = box(0.07, 1.22, 0.19, 0xe2bd6a, 0.78);
      bar.position.x = x;
      bar.position.y = 0;
      panel.add(bar);
    }
  }
  leftGate.add(leftPanel);
  rightGate.add(rightPanel);
  const pennantPivot = new THREE.Group();
  pennantPivot.position.set(0, 4.16, 0.03);
  const pennant = cone(0.48, 0.9, 3, 0xe86d77, 0);
  pennant.rotation.z = -Math.PI / 2;
  pennant.position.x = 0.42;
  pennantPivot.add(pennant);
  const crownGlow = sphere(0.16, 0, 0xffdf78, 4.76);
  crownGlow.material = material(0x5a471f, { emissive: 0xffd76a, emissiveIntensity: 1.4 });
  group.add(left, right, beam, crown, leftGate, rightGate, pennantPivot, crownGlow);

  let gateAmount = 0;
  let lastTime = 0;
  let openingActive = false;
  const applyGate = (amount) => {
    const eased = amount * amount * (3 - 2 * amount);
    leftGate.rotation.y = eased * 1.22;
    rightGate.rotation.y = -eased * 1.22;
  };
  group.userData.resetOpening = () => {
    openingActive = true;
    gateAmount = 0;
    applyGate(0);
  };
  group.userData.finishOpening = () => { openingActive = false; };
  group.userData.updateVisual = (time, park, openingGateProgress = null) => {
    const dt = lastTime ? Math.max(0, Math.min(0.1, time - lastTime)) : 0;
    lastTime = time;
    if (openingActive && Number.isFinite(openingGateProgress)) gateAmount = openingGateProgress;
    else {
      const target = park?.open ? 1 : 0;
      gateAmount += (target - gateAmount) * (1 - Math.exp(-dt * 4.8));
    }
    applyGate(gateAmount);
    pennantPivot.rotation.z = Math.sin(time * 3.2) * 0.11 + Math.sin(time * 6.1) * 0.035;
    crownGlow.scale.setScalar(0.9 + Math.sin(time * 2.6) * 0.1);
  };
  return group;
}

export function createDiscoveryModel(id = "discovery") {
  const palette = [0xffd765, 0x75d5ad, 0x65bed1, 0xe98fc4, 0xff946b];
  const color = palette[[...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length];
  const group = new THREE.Group();
  const pedestal = cylinder(0.22, 0.34, 0.34, 6, 0x4a4d59, 0.17);
  const orb = sphere(0.28, 1, color, 0.92);
  orb.material = material(0x473f24, { emissive: color, emissiveIntensity: 1.65 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.045, 5, 12), material(color, { emissive: color, emissiveIntensity: 0.7 }));
  ring.position.y = 0.92;
  ring.rotation.x = Math.PI / 2;
  group.add(pedestal, orb, ring);
  group.userData.updateVisual = (time) => {
    ring.rotation.z = time * 0.8;
    orb.position.y = 0.92 + Math.sin(time * 2.4) * 0.11;
    orb.rotation.y = time * 0.7;
  };
  return group;
}

const segmentColors = {
  family: 0xf1b85b,
  thrill: 0xe35f68,
  explorer: 0x68c2cc,
  local: 0x8bc36e
};

const guestSignalTextures = new Map();

function paintGuestSignalIcon(context, type) {
  const pixel = (x, y, width = 1, height = 1, color = "#f7dc76") => {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  };
  if (type === "comfort") {
    pixel(5, 4, 2, 5, "#7ed7c3"); pixel(9, 4, 2, 5, "#7ed7c3");
    pixel(4, 9, 8, 2, "#7ed7c3"); pixel(6, 11, 4, 1, "#7ed7c3");
  } else if (type === "drink") {
    pixel(5, 4, 6, 1, "#72cbe0"); pixel(6, 5, 5, 6, "#72cbe0");
    pixel(11, 6, 2, 3, "#72cbe0"); pixel(9, 2, 1, 3, "#f7dc76");
  } else if (type === "snack") {
    pixel(5, 5, 6, 1, "#efb55b"); pixel(4, 6, 8, 2, "#ef7b64");
    pixel(5, 8, 6, 2, "#77b768"); pixel(4, 10, 8, 2, "#efb55b");
  } else if (type === "wait") {
    pixel(5, 3, 6, 1, "#f0c766"); pixel(6, 4, 4, 2, "#f0c766");
    pixel(7, 6, 2, 3, "#f0c766"); pixel(6, 9, 4, 2, "#f0c766"); pixel(5, 11, 6, 1, "#f0c766");
  } else {
    pixel(4, 5, 5, 2, "#b8a7ea"); pixel(7, 7, 2, 2, "#b8a7ea"); pixel(4, 9, 5, 2, "#b8a7ea");
    pixel(10, 3, 3, 1, "#efe8ff"); pixel(12, 4, 1, 2, "#efe8ff"); pixel(10, 6, 3, 1, "#efe8ff");
  }
}

function guestSignalTexture(type) {
  if (guestSignalTextures.has(type)) return guestSignalTextures.get(type);
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 16, 16);
  context.fillStyle = "rgba(10,14,21,.94)";
  context.fillRect(2, 1, 12, 12);
  context.fillStyle = "#f0c766";
  context.fillRect(3, 0, 10, 1);
  context.fillRect(1, 3, 1, 8);
  context.fillRect(14, 3, 1, 8);
  context.fillRect(3, 13, 8, 1);
  context.fillRect(6, 14, 2, 2);
  paintGuestSignalIcon(context, type);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  guestSignalTextures.set(type, texture);
  return texture;
}

export function createGuestSignalSprite(type = "rest") {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: guestSignalTexture(type), transparent: true, depthTest: false, depthWrite: false
  }));
  sprite.name = "animated-pixel-guest-status-signal";
  sprite.position.set(0, 2.35, 0);
  sprite.scale.set(0.86, 0.86, 1);
  sprite.renderOrder = 36;
  sprite.userData.signalType = type;
  return sprite;
}

export function setGuestSignalSpriteType(sprite, type) {
  if (!sprite || sprite.userData.signalType === type) return;
  sprite.material.map = guestSignalTexture(type);
  sprite.material.needsUpdate = true;
  sprite.userData.signalType = type;
}

export function createPersonModel(segment = "local", avatar = false) {
  const group = new THREE.Group();
  const bodyColor = avatar ? 0xf0d264 : segmentColors[segment] ?? segmentColors.local;
  const torso = box(0.48, 0.78, 0.3, bodyColor, 1.1);
  const head = sphere(0.25, 0, avatar ? 0xf0c6a0 : 0xd7aa82, 1.73);
  const armLeft = box(0.13, 0.56, 0.15, bodyColor, 1.12);
  armLeft.position.x = -0.34;
  const armRight = armLeft.clone();
  armRight.position.x = 0.34;
  const legLeft = box(0.16, 0.62, 0.18, 0x374458, 0.4);
  legLeft.position.x = -0.13;
  const legRight = legLeft.clone();
  legRight.position.x = 0.13;
  group.add(torso, head, armLeft, armRight, legLeft, legRight);
  group.userData.legs = [legLeft, legRight];
  group.userData.arms = [armLeft, armRight];
  group.userData.personParts = { torso, head, armLeft, armRight, legLeft, legRight };
  return group;
}

export function createStaffModel(role = "cleaner") {
  const group = new THREE.Group();
  const cleaner = role === "cleaner";
  const torso = box(0.52, 0.82, 0.34, cleaner ? 0x4db19d : 0xd68a4a, 1.1);
  const vest = box(0.56, 0.22, 0.37, cleaner ? 0xdff4d3 : 0xf4d15f, 1.18);
  const head = sphere(0.25, 0, 0xd7aa82, 1.75);
  const cap = box(0.5, 0.12, 0.42, cleaner ? 0x266f68 : 0x85502f, 1.98);
  const armLeft = box(0.13, 0.58, 0.15, cleaner ? 0x358d80 : 0xb76b3b, 1.12);
  armLeft.position.x = -0.36;
  const armRight = armLeft.clone();
  armRight.position.x = 0.36;
  const legLeft = box(0.16, 0.62, 0.18, 0x31404a, 0.4);
  legLeft.position.x = -0.13;
  const legRight = legLeft.clone();
  legRight.position.x = 0.13;
  const toolRoot = new THREE.Group();
  group.add(torso, vest, head, cap, armLeft, armRight, legLeft, legRight, toolRoot);
  if (cleaner) {
    const broom = box(0.08, 1.65, 0.08, 0xa98252, 0.86);
    broom.position.x = 0.42;
    broom.rotation.z = -0.2;
    const brush = box(0.55, 0.16, 0.22, 0xe0bd66, 0.13);
    brush.position.x = 0.55;
    toolRoot.add(broom, brush);
  } else {
    const caseBody = box(0.62, 0.42, 0.28, 0x49606a, 0.82);
    caseBody.position.x = 0.47;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.045, 4, 8, Math.PI), material(0xb9cad0));
    handle.position.set(0.47, 1.04, 0);
    handle.rotation.z = Math.PI;
    const wrench = box(0.08, 0.68, 0.08, 0xc8d2d5, 1.35);
    wrench.position.x = -0.38;
    wrench.rotation.z = 0.24;
    toolRoot.add(caseBody, handle, wrench);
  }
  group.userData.legs = [legLeft, legRight];
  group.userData.arms = [armLeft, armRight];
  group.userData.updateWorkVisual = (time, agent) => {
    const working = Number(agent?.cooldown) > 0;
    if (cleaner) {
      toolRoot.rotation.y = working ? Math.sin(time * 9.5) * 0.72 : Math.sin(time * 1.6) * 0.055;
      toolRoot.rotation.z = -0.08 + (working ? Math.sin(time * 4.75) * 0.1 : 0);
    } else {
      toolRoot.rotation.x = working ? Math.sin(time * 10.5) * 0.38 : Math.sin(time * 1.3) * 0.035;
      toolRoot.rotation.z = working ? Math.sin(time * 5.25) * 0.18 : 0;
    }
    vest.scale.y = working ? 1 + Math.sin(time * 8) * 0.04 : 1;
  };
  return group;
}

export function createLitterModel() {
  const group = new THREE.Group();
  const scraps = [
    [-0.22, 0.08, -0.12, 0xe7c965],
    [0.18, 0.1, 0.08, 0x6fc6cf],
    [0.02, 0.07, 0.26, 0xd86570]
  ];
  for (const [x, y, z, color] of scraps) {
    const scrap = box(0.34, 0.08, 0.22, color, y);
    scrap.position.set(x, y, z);
    scrap.rotation.y = (x + z) * 2.3;
    group.add(scrap);
  }
  group.userData.updateVisual = (time, amount = 1) => {
    const liveScale = Math.max(0.55, Math.min(1.25, 0.65 + amount * 0.16));
    group.userData.liveScale = liveScale;
    group.scale.setScalar(liveScale);
    group.rotation.y = Math.sin(time * 0.4 + stableLitterPhase(group)) * 0.04;
  };
  return group;
}

function stableLitterPhase(group) {
  return Number(group.userData.litterId?.split("-").at(-1) ?? 0);
}

export function animatePerson(group, time, moving = true, serviceGesture = false, pose = "standing") {
  const [left, right] = group.userData.legs ?? [];
  if (!left || !right) return;
  const resting = pose === "resting";
  const parts = group.userData.personParts ?? {};
  if (parts.torso) parts.torso.position.y = resting ? 1.04 : 1.1;
  if (parts.head) parts.head.position.y = resting ? 1.65 : 1.73;
  left.position.y = resting ? 0.63 : 0.4;
  right.position.y = resting ? 0.63 : 0.4;
  const amount = moving ? 0.5 : 0.04;
  left.rotation.x = resting ? -1.18 + Math.sin(time * 2.2) * 0.035 : Math.sin(time * 6) * amount;
  right.rotation.x = resting ? -1.18 - Math.sin(time * 2.2) * 0.035 : -left.rotation.x;
  const [armLeft, armRight] = group.userData.arms ?? [];
  if (armLeft && armRight) {
    if (resting) {
      armLeft.rotation.x = -0.2 + Math.sin(time * 1.8) * 0.035;
      armRight.rotation.x = -0.2 - Math.sin(time * 1.8) * 0.035;
    } else if (serviceGesture) {
      armLeft.rotation.x = -0.42 + Math.sin(time * 3.4) * 0.16;
      armRight.rotation.x = -0.3 + Math.sin(time * 3.4 + 1.2) * 0.13;
    } else {
      armLeft.rotation.x = -left.rotation.x * 0.72;
      armRight.rotation.x = left.rotation.x * 0.72;
    }
  }
}

export function modelFootprint(entity) {
  return rotatedFootprint(catalogDefinition(entity.catalogId), entity.rotation);
}
