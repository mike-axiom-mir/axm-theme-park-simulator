import * as THREE from "../../vendor/three.module.min.js";
import { TILE_SIZE, catalogDefinition } from "../core/catalog.js";
import { WATER_DISTRICT_CONTENT_IDS } from "../core/waterDistrictCatalog.js";
import { deriveRideMotion, deriveServiceMotion } from "../presentation/parkMotion.js";

const materialCache = new Map();
const geometryCache = new Map();

function material(color, options = {}) {
  const key = [
    color, options.emissive ?? 0, options.emissiveIntensity ?? 0, options.opacity ?? 1,
    options.roughness ?? 0.82, options.metalness ?? 0.04
  ].join("-");
  if (!materialCache.has(key)) {
    materialCache.set(key, new THREE.MeshStandardMaterial({
      color,
      flatShading: true,
      roughness: options.roughness ?? 0.82,
      metalness: options.metalness ?? 0.04,
      transparent: (options.opacity ?? 1) < 1,
      opacity: options.opacity ?? 1,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
      depthWrite: (options.opacity ?? 1) >= 0.72
    }));
  }
  return materialCache.get(key);
}

function box(width, height, depth, color, y = height / 2, options = {}) {
  const key = `box-${width}-${height}-${depth}`;
  if (!geometryCache.has(key)) geometryCache.set(key, new THREE.BoxGeometry(width, height, depth));
  const item = new THREE.Mesh(geometryCache.get(key), material(color, options));
  item.position.y = y;
  item.castShadow = (options.opacity ?? 1) >= 0.72;
  item.receiveShadow = true;
  return item;
}

function cylinder(top, bottom, height, sides, color, y = height / 2, options = {}) {
  const item = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, sides),
    material(color, options)
  );
  item.position.y = y;
  item.castShadow = (options.opacity ?? 1) >= 0.72;
  item.receiveShadow = true;
  return item;
}

function sphere(radius, color, y = 0, options = {}) {
  const item = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), material(color, options));
  item.position.y = y;
  item.castShadow = (options.opacity ?? 1) >= 0.72;
  return item;
}

function cone(radius, height, sides, color, y = height / 2, options = {}) {
  const item = new THREE.Mesh(new THREE.ConeGeometry(radius, height, sides), material(color, options));
  item.position.y = y;
  item.castShadow = (options.opacity ?? 1) >= 0.72;
  return item;
}

function base(group, definition, color = 0x526068) {
  const [width, depth] = definition.footprint;
  group.add(box(width * TILE_SIZE * 0.92, 0.2, depth * TILE_SIZE * 0.92, color, 0.1));
}

function waterPlate(width, depth, y = 0.23, color = 0x4ea0ba) {
  return box(width, 0.11, depth, color, y, { opacity: 0.78, roughness: 0.36, metalness: 0.08 });
}

function passenger(parent, x, y, z, color = 0x68c2cc) {
  const person = new THREE.Group();
  person.name = "animated-water-passenger";
  person.position.set(x, y, z);
  person.userData.baseY = y;
  person.add(box(0.23, 0.32, 0.2, color, 0.16));
  person.add(sphere(0.13, 0xd8ac85, 0.43));
  person.visible = false;
  parent.add(person);
  return person;
}

function showPassengers(items, motion, time) {
  items.forEach((item, index) => {
    item.visible = motion.active && index < motion.riderCount;
    item.position.y = item.userData.baseY
      + Math.sin(time * 4.2 + index * 0.7) * 0.025 * motion.boardingPulse;
  });
}

function setRideAnchor(group, parent, x = 0, y = 1.2, z = 0) {
  const anchor = new THREE.Object3D();
  anchor.position.set(x, y, z);
  parent.add(anchor);
  group.userData.rideAnchor = anchor;
}

function frontage(group, definition, color = definition.color) {
  const [width, depth] = definition.footprint;
  const root = new THREE.Group();
  root.position.z = depth * TILE_SIZE * 0.43;
  const left = cylinder(0.055, 0.065, 1.35, 6, 0x46545a, 0.68);
  left.position.x = -0.92;
  const right = left.clone();
  right.position.x = 0.92;
  const sign = box(Math.min(width * TILE_SIZE * 0.54, 2.3), 0.34, 0.11, color, 1.2);
  const lamp = sphere(0.1, 0xf6da79, 1.5, {
    emissive: 0xf6da79, emissiveIntensity: 1.1
  });
  root.add(left, right, sign, lamp);
  group.add(root);
  return (time, live) => {
    const open = live.open !== false;
    lamp.visible = open;
    lamp.scale.setScalar(0.86 + Math.sin(time * 4.2) * 0.14);
    sign.scale.y = open ? 0.96 + Math.sin(time * 2.1) * 0.04 : 0.72;
  };
}

function createCanalRide(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x4c6267);
  const [width, depth] = definition.footprint;
  group.add(waterPlate(width * TILE_SIZE * 0.82, depth * TILE_SIZE * 0.7));

  const lanterns = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const root = new THREE.Group();
    root.position.set(
      Math.cos(angle) * width * TILE_SIZE * 0.32,
      0,
      Math.sin(angle) * depth * TILE_SIZE * 0.25
    );
    root.add(cylinder(0.045, 0.055, 0.9, 6, 0x4d4a43, 0.45));
    const light = sphere(0.1, 0xf3d675, 1, {
      emissive: 0xf3d675, emissiveIntensity: 1.2
    });
    root.add(light);
    group.add(root);
    lanterns.push(light);
  }

  const boat = new THREE.Group();
  boat.add(box(1.9, 0.32, 0.72, 0x8d5d3d, 0.22));
  boat.add(box(1.45, 0.12, 0.52, 0xd7b16f, 0.42));
  const riders = [];
  for (let index = 0; index < 8; index += 1) {
    riders.push(passenger(
      boat,
      -0.62 + (index % 4) * 0.42,
      0.56,
      index < 4 ? -0.18 : 0.18,
      index % 2 ? 0x75d5ad : 0xe987a8
    ));
  }
  group.add(boat);
  setRideAnchor(group, boat, 0, 0.92, 0);
  const front = frontage(group, definition);

  group.userData.updateVisual = (time, live) => {
    const motion = deriveRideMotion(live, time);
    const phase = (time * 0.085 * motion.speed) % 1;
    const angle = phase * Math.PI * 2;
    boat.position.set(
      Math.cos(angle) * width * TILE_SIZE * 0.29,
      0.29 + Math.sin(time * 1.7) * 0.025,
      Math.sin(angle) * depth * TILE_SIZE * 0.22
    );
    boat.rotation.y = -angle + Math.PI / 2;
    lanterns.forEach((light, index) => {
      light.scale.setScalar(0.86 + Math.sin(time * 2.7 + index) * 0.12);
    });
    showPassengers(riders, motion, time);
    front(time, live);
  };
  return group;
}

function createWaterSpinner(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x4b626a);
  group.add(cylinder(3.15, 3.15, 0.16, 20, 0x4d9fbd, 0.22, { opacity: 0.8 }));

  const rotor = new THREE.Group();
  rotor.position.y = 0.32;
  group.add(rotor);
  rotor.add(cylinder(0.38, 0.48, 0.65, 9, 0x596873, 0.33));

  const pods = [];
  const riders = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const pod = new THREE.Group();
    pod.position.set(Math.cos(angle) * 2, 0.1, Math.sin(angle) * 2);
    pod.add(cylinder(0.56, 0.66, 0.42, 10, index % 2 ? 0x65bed1 : 0x75d5ad, 0.22));
    riders.push(passenger(pod, -0.16, 0.5, 0, 0xf0c766));
    riders.push(passenger(pod, 0.16, 0.5, 0, 0xe987a8));
    rotor.add(pod);
    pods.push(pod);
  }

  setRideAnchor(group, pods[0], 0, 0.82, 0);
  const front = frontage(group, definition);
  group.userData.updateVisual = (time, live) => {
    const motion = deriveRideMotion(live, time);
    rotor.rotation.y = time * 0.8 * motion.speed;
    pods.forEach((pod, index) => {
      pod.rotation.y = -rotor.rotation.y * 1.4 + index;
      pod.position.y = 0.1 + Math.sin(time * 2.6 + index) * 0.12 * motion.boardingPulse;
    });
    showPassengers(riders, motion, time);
    front(time, live);
  };
  return group;
}

function createSplashPlay(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x52676a);
  const [width, depth] = definition.footprint;
  group.add(waterPlate(width * TILE_SIZE * 0.78, depth * TILE_SIZE * 0.67, 0.22, 0x65b9c2));

  const jets = [];
  for (let index = 0; index < 9; index += 1) {
    const jet = cylinder(0.055, 0.08, 0.55, 6, 0x8edbea, 0.4, {
      opacity: 0.68, emissive: 0x2f7180, emissiveIntensity: 0.22
    });
    jet.position.x = -2 + (index % 3) * 2;
    jet.position.z = -1.2 + Math.floor(index / 3) * 1.2;
    jet.userData.phase = index * 0.65;
    group.add(jet);
    jets.push(jet);
  }

  const arch = new THREE.Group();
  arch.add(cylinder(0.08, 0.1, 2.1, 7, 0x55716d, 1.05));
  const spray = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.07, 6, 16, Math.PI),
    material(0x8edbea, { opacity: 0.7, emissive: 0x2f7180, emissiveIntensity: 0.18 })
  );
  spray.rotation.z = Math.PI;
  spray.position.y = 1.95;
  arch.add(spray);
  group.add(arch);

  const riders = [];
  for (let index = 0; index < 12; index += 1) {
    riders.push(passenger(
      group,
      -2.1 + (index % 4) * 1.4,
      0.42,
      -1.3 + Math.floor(index / 4) * 1.25,
      index % 3 === 0 ? 0xf0c766 : index % 3 === 1 ? 0x75d5ad : 0xe987a8
    ));
  }
  setRideAnchor(group, group, 0, 1.25, 0);
  const front = frontage(group, definition);

  group.userData.updateVisual = (time, live) => {
    const motion = deriveRideMotion(live, time);
    jets.forEach((jet) => {
      const pulse = motion.active ? Math.max(0.18, Math.sin(time * 3.6 + jet.userData.phase)) : 0.12;
      jet.scale.y = pulse;
      jet.position.y = 0.2 + pulse * 0.22;
    });
    riders.forEach((rider, index) => {
      rider.visible = motion.active && index < motion.riderCount;
      rider.position.y = rider.userData.baseY
        + Math.max(0, Math.sin(time * 2.8 + index)) * 0.18 * motion.boardingPulse;
    });
    front(time, live);
  };
  return group;
}

function createLagoonShow(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x485b67);
  const [width, depth] = definition.footprint;
  group.add(waterPlate(width * TILE_SIZE * 0.78, depth * TILE_SIZE * 0.68, 0.22, 0x4c86b6));

  const jets = [];
  const lights = [];
  for (let index = 0; index < 7; index += 1) {
    const x = -2.8 + index * 0.93;
    const jet = cylinder(0.055, 0.09, 1.2, 6, 0x8fddec, 0.72, { opacity: 0.68 });
    jet.position.x = x;
    jet.position.z = Math.sin(index) * 0.65;
    jet.userData.phase = index * 0.52;
    group.add(jet);
    jets.push(jet);

    const light = sphere(0.1, index % 2 ? 0xb8a7ea : 0x65bed1, 0.3, {
      emissive: index % 2 ? 0xb8a7ea : 0x65bed1, emissiveIntensity: 1.1
    });
    light.position.x = x;
    light.position.z = jet.position.z;
    group.add(light);
    lights.push(light);
  }

  const viewingDeck = box(width * TILE_SIZE * 0.58, 0.18, 1.1, 0x8a6548, 0.31);
  viewingDeck.position.z = depth * TILE_SIZE * 0.29;
  group.add(viewingDeck);
  const riders = [];
  for (let index = 0; index < 12; index += 1) {
    riders.push(passenger(
      group,
      -2.6 + (index % 6) * 1.04,
      0.5,
      depth * TILE_SIZE * 0.29 + (index < 6 ? -0.18 : 0.18),
      index % 2 ? 0xf0c766 : 0x75d5ad
    ));
  }

  setRideAnchor(group, group, 0, 1.35, depth * TILE_SIZE * 0.25);
  const front = frontage(group, definition);
  group.userData.updateVisual = (time, live) => {
    const motion = deriveRideMotion(live, time);
    jets.forEach((jet, index) => {
      const wave = motion.active
        ? 0.25 + Math.max(0, Math.sin(time * 2.4 + jet.userData.phase)) * 1.25
        : 0.16;
      jet.scale.y = wave;
      jet.position.y = 0.22 + wave * 0.42;
      lights[index].scale.setScalar(0.78 + wave * 0.18);
      lights[index].visible = live.open !== false;
    });
    showPassengers(riders, motion, time);
    front(time, live);
  };
  return group;
}

function createHarbourDrinks(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x6f5741);
  const [width, depth] = definition.footprint;
  group.add(box(width * TILE_SIZE * 0.74, 0.16, depth * TILE_SIZE * 0.72, 0x9a714d, 0.2));
  const kiosk = box(2.25, 2.3, 1.7, 0x5d7d82, 1.35);
  group.add(kiosk);
  const awning = box(2.5, 0.18, 0.78, definition.color, 2.3);
  awning.position.z = 1;
  group.add(awning);
  const sign = box(1.55, 0.38, 0.12, 0xf0c766, 2.72);
  sign.position.z = 0.9;
  group.add(sign);
  const bottles = [];
  for (let index = 0; index < 5; index += 1) {
    const bottle = cylinder(0.07, 0.09, 0.42, 7, index % 2 ? 0x75d5ad : 0x65bed1, 1.25);
    bottle.position.x = -0.7 + index * 0.35;
    bottle.position.z = 0.92;
    group.add(bottle);
    bottles.push(bottle);
  }
  const lantern = sphere(0.12, 0xf0d477, 2.85, {
    emissive: 0xf0d477, emissiveIntensity: 1.25
  });
  lantern.position.z = 0.96;
  group.add(lantern);

  group.userData.updateVisual = (time, live) => {
    const motion = deriveServiceMotion(live, time);
    sign.scale.y = motion.signPulse;
    lantern.visible = live.open !== false;
    lantern.scale.setScalar(0.86 + Math.sin(time * 4.2) * 0.14);
    bottles.forEach((bottle, index) => {
      bottle.position.y = 1.25 + Math.sin(time * 1.5 + index) * 0.018;
    });
  };
  return group;
}

function createWatersideRest(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x6d5b45);
  const [width, depth] = definition.footprint;
  group.add(waterPlate(width * TILE_SIZE * 0.28, depth * TILE_SIZE * 0.72, 0.2, 0x5aa9b8));
  const deck = box(width * TILE_SIZE * 0.56, 0.18, depth * TILE_SIZE * 0.76, 0x9a714d, 0.25);
  deck.position.x = width * TILE_SIZE * 0.15;
  group.add(deck);

  for (const x of [-1.6, 1.6]) {
    for (const z of [-0.7, 0.7]) {
      const post = cylinder(0.06, 0.07, 2.1, 6, 0x5a4b3f, 1.05);
      post.position.set(x, 1.05, z);
      group.add(post);
    }
  }
  const roof = cone(2.7, 1.05, 8, 0x78b69a, 2.55);
  roof.rotation.y = Math.PI / 8;
  group.add(roof);
  group.add(box(3.1, 0.22, 0.65, 0x7d5b43, 0.63));
  group.add(box(3.05, 0.58, 0.14, 0x7d5b43, 0.92));

  const lantern = sphere(0.12, 0xf0d477, 2.12, {
    emissive: 0xf0d477, emissiveIntensity: 1.1
  });
  group.add(lantern);
  group.userData.updateVisual = (time) => {
    lantern.scale.setScalar(0.88 + Math.sin(time * 2.6) * 0.12);
  };
  return group;
}

function createPonchoPier(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x6b5745);
  const [width, depth] = definition.footprint;
  group.add(box(width * TILE_SIZE * 0.8, 0.18, depth * TILE_SIZE * 0.8, 0x96704e, 0.22));
  group.add(box(2.6, 2.45, 1.75, 0x5d6872, 1.42));
  const awning = box(2.9, 0.18, 0.8, definition.color, 2.35);
  awning.position.z = 1.05;
  group.add(awning);

  const ponchos = [];
  for (let index = 0; index < 5; index += 1) {
    const poncho = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.75, 4),
      material([0x65bed1, 0xf0c766, 0xe987a8, 0x75d5ad, 0xb8a7ea][index])
    );
    poncho.position.set(-0.9 + index * 0.45, 1.42, 1.02);
    poncho.rotation.z = Math.PI;
    group.add(poncho);
    ponchos.push(poncho);
  }
  const buoy = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.08, 6, 12),
    material(0xf0c766)
  );
  buoy.position.set(1.05, 0.8, 1.05);
  buoy.rotation.x = Math.PI / 2;
  group.add(buoy);

  group.userData.updateVisual = (time) => {
    ponchos.forEach((poncho, index) => {
      poncho.rotation.y = Math.sin(time * 1.1 + index) * 0.08;
    });
    buoy.rotation.z = Math.sin(time * 0.9) * 0.08;
  };
  return group;
}

function createPond(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x536963);
  const [width, depth] = definition.footprint;
  group.add(waterPlate(width * TILE_SIZE * 0.82, depth * TILE_SIZE * 0.82, 0.2, 0x55a9a7));

  const lilies = [];
  for (let index = 0; index < 6; index += 1) {
    const lily = cylinder(0.22, 0.24, 0.05, 8, index % 2 ? 0x6fa45c : 0x7fba69, 0.29);
    lily.position.x = -1.15 + (index % 3) * 1.15;
    lily.position.z = -0.62 + Math.floor(index / 3) * 1.22;
    group.add(lily);
    lilies.push(lily);
  }
  const ripples = [];
  for (let index = 0; index < 3; index += 1) {
    const rippleMaterial = material(0x8edbea, {
      opacity: 0.55, emissive: 0x2f7180, emissiveIntensity: 0.15
    }).clone();
    rippleMaterial.transparent = true;
    rippleMaterial.depthWrite = false;
    const ripple = new THREE.Mesh(
      new THREE.TorusGeometry(0.34 + index * 0.16, 0.025, 5, 16),
      rippleMaterial
    );
    ripple.position.y = 0.3;
    ripple.rotation.x = Math.PI / 2;
    group.add(ripple);
    ripples.push(ripple);
  }
  group.userData.updateVisual = (time) => {
    ripples.forEach((ripple, index) => {
      const phase = (time * 0.35 + index / ripples.length) % 1;
      ripple.scale.setScalar(0.72 + phase * 0.65);
      ripple.material.opacity = 0.55 * (1 - phase);
    });
    lilies.forEach((lily, index) => {
      lily.rotation.y = Math.sin(time * 0.4 + index) * 0.08;
    });
  };
  return group;
}

function createWaterfall(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x59645b);
  const [width, depth] = definition.footprint;
  group.add(waterPlate(width * TILE_SIZE * 0.72, depth * TILE_SIZE * 0.46, 0.2, 0x55a8bd));

  const rocks = [];
  for (let index = 0; index < 8; index += 1) {
    const rock = sphere(0.42 + (index % 3) * 0.12, 0x69726d, 0.42 + Math.floor(index / 4) * 0.48);
    rock.position.x = -1.45 + (index % 4) * 0.95;
    rock.position.z = -0.5 + Math.floor(index / 4) * 0.42;
    group.add(rock);
    rocks.push(rock);
  }
  const sheet = box(2.25, 1.55, 0.12, 0x8edbea, 1.02, {
    opacity: 0.62, emissive: 0x2f7180, emissiveIntensity: 0.18
  });
  sheet.position.z = 0.15;
  group.add(sheet);

  const droplets = [];
  for (let index = 0; index < 8; index += 1) {
    const drop = sphere(0.08, 0x8edbea, 0.35, { opacity: 0.72 });
    drop.userData.phase = index / 8;
    group.add(drop);
    droplets.push(drop);
  }
  group.userData.updateVisual = (time) => {
    sheet.scale.y = 0.96 + Math.sin(time * 3.4) * 0.04;
    droplets.forEach((drop, index) => {
      const phase = (time * 0.72 + drop.userData.phase) % 1;
      drop.position.set(-0.9 + (index % 4) * 0.6, 1.7 - phase * 1.4, 0.24);
      drop.visible = phase < 0.92;
    });
  };
  return group;
}

function createReeds(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x5d6d5d);
  group.add(waterPlate(TILE_SIZE * 0.72, TILE_SIZE * 0.72, 0.19, 0x5aa6a4));
  const reeds = [];
  for (let index = 0; index < 9; index += 1) {
    const reed = cylinder(0.025, 0.035, 0.7 + (index % 3) * 0.18, 5, 0x759d5c, 0.55);
    reed.position.x = -0.58 + (index % 3) * 0.58;
    reed.position.z = -0.52 + Math.floor(index / 3) * 0.52;
    reed.userData.phase = index * 0.73;
    group.add(reed);
    reeds.push(reed);
  }
  group.userData.updateVisual = (time) => {
    reeds.forEach((reed) => {
      reed.rotation.z = Math.sin(time * 1.25 + reed.userData.phase) * 0.08;
    });
  };
  return group;
}

function createBoardwalk(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x665442);
  const [width, depth] = definition.footprint;
  const plankCount = Math.max(4, width * 5);
  for (let index = 0; index < plankCount; index += 1) {
    const plank = box(
      width * TILE_SIZE * 0.82 / plankCount - 0.03,
      0.12,
      depth * TILE_SIZE * 0.72,
      index % 2 ? 0x9a704e : 0x8b6346,
      0.25
    );
    plank.position.x = -width * TILE_SIZE * 0.41
      + (index + 0.5) * width * TILE_SIZE * 0.82 / plankCount;
    group.add(plank);
  }
  const posts = [];
  for (const x of [-width * TILE_SIZE * 0.36, width * TILE_SIZE * 0.36]) {
    for (const z of [-depth * TILE_SIZE * 0.32, depth * TILE_SIZE * 0.32]) {
      const post = cylinder(0.045, 0.055, 0.72, 6, 0x5a4637, 0.52);
      post.position.set(x, 0.52, z);
      group.add(post);
      posts.push(post);
    }
  }
  const lantern = sphere(0.09, 0xf0d477, 0.96, {
    emissive: 0xf0d477, emissiveIntensity: 1.05
  });
  lantern.position.x = width * TILE_SIZE * 0.36;
  lantern.position.z = depth * TILE_SIZE * 0.32;
  group.add(lantern);
  group.userData.updateVisual = (time) => {
    lantern.scale.setScalar(0.88 + Math.sin(time * 2.7) * 0.12);
  };
  return group;
}

function createLighthouse(entity, definition) {
  const group = new THREE.Group();
  base(group, definition, 0x5b6262);
  const tower = cylinder(0.42, 0.62, 3.4, 8, 0xe8dfc8, 1.8);
  group.add(tower);
  group.add(cylinder(0.5, 0.5, 0.22, 10, 0x4f6f80, 3.45));
  const cap = cone(0.62, 0.72, 8, 0xc86a5a, 3.92);
  group.add(cap);
  const lamp = sphere(0.17, 0xf0d477, 3.64, {
    emissive: 0xf0d477, emissiveIntensity: 1.6
  });
  group.add(lamp);
  const beam = cone(0.42, 2.7, 6, 0xf0d477, 1.35, {
    opacity: 0.22, emissive: 0xf0d477, emissiveIntensity: 0.35
  });
  beam.rotation.z = -Math.PI / 2;
  beam.position.set(1.35, 3.64, 0);
  group.add(beam);

  group.userData.updateVisual = (time) => {
    beam.rotation.y = time * 0.72;
    lamp.scale.setScalar(0.9 + Math.sin(time * 3.1) * 0.1);
  };
  return group;
}

const FACTORIES = Object.freeze({
  canalRide: createCanalRide,
  waterSpinner: createWaterSpinner,
  splashPlay: createSplashPlay,
  lagoonShow: createLagoonShow,
  harbourDrinks: createHarbourDrinks,
  watersideRest: createWatersideRest,
  poncho: createPonchoPier,
  pond: createPond,
  waterfall: createWaterfall,
  reeds: createReeds,
  boardwalk: createBoardwalk,
  lighthouse: createLighthouse
});

export const WATER_DISTRICT_VISUAL_FAMILIES = Object.freeze(Object.keys(FACTORIES));

function finalize(group, entity, definition) {
  group.name = entity.id;
  group.userData.entityId = entity.id;
  group.userData.definition = definition;
  group.userData.specialAttractionId = definition.id;
  group.userData.worldContentFamily = definition.visualFamily;
  group.userData.updateVisual ??= () => {};
  group.traverse((child) => { child.userData.entityId = entity.id; });
  return group;
}

export function createWaterDistrictModel(entity) {
  const definition = catalogDefinition(entity.catalogId);
  if (!WATER_DISTRICT_CONTENT_IDS.includes(definition.id)) {
    throw new Error(`Not an AXM water-district content id: ${definition.id}`);
  }
  const factory = FACTORIES[definition.visualFamily];
  if (!factory) throw new Error(`No water-district model family: ${definition.visualFamily}`);
  return finalize(factory(entity, definition), entity, definition);
}
