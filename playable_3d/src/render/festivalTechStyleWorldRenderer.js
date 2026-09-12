import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as MedievalStyleWorldRenderer } from "./medievalStyleWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { districtThemeForEntity } from "../core/districts.js";
import { themeFitForEntity } from "../core/themeFit.js";

const LAND_ROOT_LIMIT = 4;
const LAND_THEME_IDS = Object.freeze(["halloween", "christmas", "newyear", "robotica", "software"]);
const LAND_THEME_SET = new Set(LAND_THEME_IDS);

const PALETTES = Object.freeze({
  halloween: Object.freeze({ dark: 0x292231, primary: 0xf07a35, secondary: 0x8c68ca, accent: 0xa8cf6b }),
  christmas: Object.freeze({ dark: 0x294036, primary: 0xc9484d, secondary: 0x4f9b67, accent: 0xf2d68b }),
  newyear: Object.freeze({ dark: 0x293149, primary: 0xe6c76f, secondary: 0xb9c6df, accent: 0x7ec9e8 }),
  robotica: Object.freeze({ dark: 0x39434b, primary: 0xd59a49, secondary: 0x6db7c7, accent: 0xd9dde0 }),
  software: Object.freeze({ dark: 0x252d45, primary: 0x65bed1, secondary: 0xb28be1, accent: 0x77d6ac })
});

function flatMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.04,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function glowMaterial(color, opacity = 0.88) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: false
  });
}

function addMesh(root, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = material.opacity >= 0.72;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function actorCount(root) {
  let count = 0;
  root.traverse((item) => { if (item.isMesh) count += 1; });
  return count;
}

function disposeTree(root) {
  root.traverse((item) => {
    item.geometry?.dispose?.();
    if (Array.isArray(item.material)) item.material.forEach((value) => value?.dispose?.());
    else item.material?.dispose?.();
  });
}

function clearChildren(root) {
  while (root.children.length) {
    const child = root.children[0];
    root.remove(child);
    disposeTree(child);
  }
}

function markEntityPickTarget(root, entityId) {
  root.traverse((item) => { item.userData.entityId = entityId; });
}

function fitScale(status) {
  return status === "signature" ? 1.08
    : status === "strong" ? 0.97
      : status === "compatible" ? 0.83 : 0.72;
}

function themeBoost(themeId, state) {
  const minute = ((Number(state?.clock?.minute) || 0) % 1440 + 1440) % 1440;
  const night = minute >= 1080 || minute < 360;
  const late = minute >= 1200 || minute < 120;
  const daytime = minute >= 540 && minute < 1080;
  const raining = state?.weather?.type === "rain" || Number(state?.weather?.precipitation) > 0.05;
  const cloudy = state?.weather?.type === "cloudy";
  let boost = 1;
  if (themeId === "halloween") boost += (night ? 0.3 : 0) + (raining ? 0.1 : 0);
  if (themeId === "christmas") boost += (night ? 0.28 : 0) + (cloudy ? 0.06 : 0);
  if (themeId === "newyear") boost += late ? 0.38 : night ? 0.16 : 0;
  if (themeId === "robotica") boost += daytime ? 0.12 : 0;
  if (themeId === "software") boost += night ? 0.3 : 0;
  return Math.min(1.45, boost);
}

function stagePulse(power) {
  return power.stage === "unleashed" ? 1
    : power.stage === "charged" ? 0.82
      : power.stage === "awakening" ? 0.62 : 0.46;
}

function createHalloweenFrame(power) {
  const root = new THREE.Group();
  root.name = `halloween-land-frame-${power.districtId}`;
  const p = PALETTES.halloween;
  const dark = flatMaterial(p.dark, { roughness: 0.94 });
  const orange = flatMaterial(p.primary, { emissive: p.primary, emissiveIntensity: 0.06 });
  const purple = glowMaterial(p.secondary, 0.76);
  const green = flatMaterial(p.accent);
  const outer = addMesh(root, new THREE.TorusGeometry(1.56, 0.08, 6, 18), dark, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const fogRing = addMesh(root, new THREE.TorusGeometry(1.3, 0.045, 5, 18), purple, 0, 0.17, 0);
  fogRing.rotation.x = Math.PI / 2;
  const pumpkins = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * 1.05;
    const z = Math.sin(angle) * 1.05;
    const body = addMesh(root, new THREE.SphereGeometry(0.22, 7, 5), orange, x, 0.36, z);
    body.scale.y = 0.78;
    const stem = addMesh(root, new THREE.ConeGeometry(0.07, 0.2, 5), green, x, 0.56, z);
    stem.rotation.z = index % 2 ? 0.2 : -0.18;
    pumpkins.push(body);
  }
  const crooked = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2;
    const post = addMesh(root, new THREE.BoxGeometry(0.09, 0.76, 0.09), dark,
      Math.cos(angle) * 1.45, 0.48, Math.sin(angle) * 1.45);
    post.rotation.z = index % 2 ? 0.18 : -0.22;
    const lamp = addMesh(root, new THREE.OctahedronGeometry(0.11, 0), purple,
      Math.cos(angle) * 1.45, 0.91, Math.sin(angle) * 1.45);
    crooked.push({ post, lamp });
  }
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("halloween", state);
    fogRing.rotation.z = time * 0.08 * boost;
    pumpkins.forEach((pumpkin, index) => {
      const pulse = 0.94 + Math.sin(time * 1.8 + index) * 0.06 * boost;
      pumpkin.scale.set(pulse, 0.78 * pulse, pulse);
    });
    crooked.forEach(({ post, lamp }, index) => {
      post.rotation.y = Math.sin(time * 0.7 + index) * 0.05;
      lamp.position.y = 0.91 + Math.sin(time * 2.1 + index) * 0.05 * boost;
    });
  };
  root.userData.setQuality = () => {};
  root.userData.actorCount = actorCount(root);
  return root;
}

function createChristmasFrame(power) {
  const root = new THREE.Group();
  root.name = `christmas-land-frame-${power.districtId}`;
  const p = PALETTES.christmas;
  const dark = flatMaterial(p.dark, { roughness: 0.92 });
  const red = flatMaterial(p.primary);
  const green = flatMaterial(p.secondary);
  const gold = glowMaterial(p.accent, 0.86);
  const outer = addMesh(root, new THREE.TorusGeometry(1.56, 0.075, 6, 18), dark, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const lightRing = addMesh(root, new THREE.TorusGeometry(1.3, 0.04, 5, 20), gold, 0, 0.18, 0);
  lightRing.rotation.x = Math.PI / 2;
  const trees = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * 1.02;
    const z = Math.sin(angle) * 1.02;
    const tree = addMesh(root, new THREE.ConeGeometry(0.28, 0.86, 6), green, x, 0.52, z);
    const ornament = addMesh(root, new THREE.OctahedronGeometry(0.09, 0), index % 2 ? gold : red, x, 0.76, z + 0.18);
    trees.push({ tree, ornament });
  }
  const canes = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2;
    const cane = addMesh(root, new THREE.CylinderGeometry(0.045, 0.055, 0.72, 6), index % 2 ? red : gold,
      Math.cos(angle) * 1.45, 0.47, Math.sin(angle) * 1.45);
    canes.push(cane);
  }
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("christmas", state);
    lightRing.rotation.z = time * 0.06 * boost;
    trees.forEach(({ tree, ornament }, index) => {
      tree.rotation.y = Math.sin(time * 0.45 + index) * 0.04;
      ornament.scale.setScalar(0.86 + Math.sin(time * 2.3 + index) * 0.14 * boost);
    });
    canes.forEach((cane, index) => { cane.rotation.z = Math.sin(time * 0.8 + index) * 0.035; });
  };
  root.userData.setQuality = () => {};
  root.userData.actorCount = actorCount(root);
  return root;
}

function createNewYearFrame(power) {
  const root = new THREE.Group();
  root.name = `newyear-land-frame-${power.districtId}`;
  const p = PALETTES.newyear;
  const dark = flatMaterial(p.dark, { roughness: 0.8 });
  const gold = glowMaterial(p.primary, 0.9);
  const silver = flatMaterial(p.secondary, { metalness: 0.16 });
  const blue = glowMaterial(p.accent, 0.78);
  const outer = addMesh(root, new THREE.TorusGeometry(1.54, 0.075, 6, 20), dark, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const clock = addMesh(root, new THREE.TorusGeometry(1.26, 0.04, 5, 20), gold, 0, 0.18, 0);
  clock.rotation.x = Math.PI / 2;
  const pylons = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * 1.08;
    const z = Math.sin(angle) * 1.08;
    const pylon = addMesh(root, new THREE.BoxGeometry(0.13, 0.78 + (index % 2) * 0.18, 0.13), silver,
      x, 0.52 + (index % 2) * 0.09, z);
    const spark = addMesh(root, new THREE.OctahedronGeometry(0.11, 0), index % 2 ? gold : blue,
      x, 0.98 + (index % 2) * 0.18, z);
    pylons.push({ pylon, spark });
  }
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("newyear", state);
    clock.rotation.z = time * 0.12 * boost;
    pylons.forEach(({ pylon, spark }, index) => {
      pylon.scale.y = 0.94 + Math.sin(time * 1.15 + index) * 0.06;
      spark.position.y = 0.98 + (index % 2) * 0.18 + Math.sin(time * 2.6 + index) * 0.1 * boost;
      spark.rotation.y = time * (0.4 + index * 0.04);
    });
  };
  root.userData.setQuality = () => {};
  root.userData.actorCount = actorCount(root);
  return root;
}

function createRoboticaFrame(power) {
  const root = new THREE.Group();
  root.name = `robotica-land-frame-${power.districtId}`;
  const p = PALETTES.robotica;
  const dark = flatMaterial(p.dark, { roughness: 0.68, metalness: 0.18 });
  const amber = glowMaterial(p.primary, 0.84);
  const cyan = glowMaterial(p.secondary, 0.76);
  const steel = flatMaterial(p.accent, { roughness: 0.58, metalness: 0.24 });
  const outer = addMesh(root, new THREE.TorusGeometry(1.55, 0.08, 6, 18), dark, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const gearRing = addMesh(root, new THREE.TorusGeometry(1.27, 0.055, 5, 16), amber, 0, 0.18, 0);
  gearRing.rotation.x = Math.PI / 2;
  const servos = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2;
    const x = Math.cos(angle) * 1.12;
    const z = Math.sin(angle) * 1.12;
    const body = addMesh(root, new THREE.BoxGeometry(0.28, 0.48, 0.28), steel, x, 0.38, z);
    const arm = addMesh(root, new THREE.BoxGeometry(0.12, 0.58, 0.12), dark, x, 0.82, z);
    const node = addMesh(root, new THREE.OctahedronGeometry(0.1, 0), index % 2 ? cyan : amber, x, 1.12, z);
    servos.push({ body, arm, node });
  }
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("robotica", state);
    gearRing.rotation.z = time * 0.22 * boost;
    servos.forEach(({ body, arm, node }, index) => {
      body.rotation.y = Math.sin(time * 0.8 + index) * 0.08;
      arm.scale.y = 0.82 + Math.max(0, Math.sin(time * 2.1 + index * 1.2)) * 0.34 * boost;
      node.position.y = 1.12 + Math.sin(time * 2.8 + index) * 0.06;
    });
  };
  root.userData.setQuality = () => {};
  root.userData.actorCount = actorCount(root);
  return root;
}

function createSoftwareFrame(power) {
  const root = new THREE.Group();
  root.name = `software-land-frame-${power.districtId}`;
  const p = PALETTES.software;
  const dark = flatMaterial(p.dark, { roughness: 0.64, metalness: 0.08 });
  const cyan = glowMaterial(p.primary, 0.82);
  const violet = glowMaterial(p.secondary, 0.78);
  const green = glowMaterial(p.accent, 0.76);
  const outer = addMesh(root, new THREE.TorusGeometry(1.55, 0.07, 6, 20), dark, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const network = addMesh(root, new THREE.TorusGeometry(1.28, 0.035, 5, 20), cyan, 0, 0.18, 0);
  network.rotation.x = Math.PI / 2;
  const nodes = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const node = addMesh(root, new THREE.OctahedronGeometry(0.1, 0), index % 3 === 0 ? green : index % 2 ? violet : cyan,
      Math.cos(angle) * 1.18, 0.52 + (index % 2) * 0.2, Math.sin(angle) * 1.18);
    node.userData.phase = angle;
    const glyph = addMesh(root, new THREE.BoxGeometry(0.22, 0.08, 0.06), index % 2 ? cyan : violet,
      Math.cos(angle) * 1.48, 0.34 + (index % 3) * 0.12, Math.sin(angle) * 1.48);
    glyph.rotation.y = -angle;
    nodes.push({ node, glyph });
  }
  root.userData.setQuality = (profile) => nodes.forEach(({ glyph }, index) => {
    glyph.visible = profile !== "tiny" || index % 2 === 0;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("software", state);
    network.rotation.z = time * 0.13 * boost;
    nodes.forEach(({ node, glyph }, index) => {
      const angle = node.userData.phase + time * 0.08 * boost;
      node.position.x = Math.cos(angle) * 1.18;
      node.position.z = Math.sin(angle) * 1.18;
      node.position.y = 0.52 + (index % 2) * 0.2 + Math.sin(time * 1.7 + index) * 0.09 * boost;
      glyph.scale.x = 0.82 + Math.sin(time * 2.2 + index) * 0.18;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

function createLandFrame(power) {
  if (power.themeId === "halloween") return createHalloweenFrame(power);
  if (power.themeId === "christmas") return createChristmasFrame(power);
  if (power.themeId === "newyear") return createNewYearFrame(power);
  if (power.themeId === "robotica") return createRoboticaFrame(power);
  return createSoftwareFrame(power);
}

function createEntityDressing(themeId, fit, entity) {
  const root = new THREE.Group();
  root.name = `${themeId}-land-entity-dressing-${fit.status}`;
  const p = PALETTES[themeId];
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.position.set(-Math.min(2.2, width * 0.46), 0.13, Math.min(1.7, depth * 0.32));
  root.scale.setScalar(fitScale(fit.status) * Math.min(1.22, 0.82 + Math.max(width, depth) * 0.055));
  const dark = flatMaterial(p.dark, { roughness: themeId === "robotica" ? 0.64 : 0.86, metalness: themeId === "robotica" ? 0.2 : 0.04 });
  const primary = glowMaterial(p.primary, fit.status === "compatible" ? 0.68 : 0.9);
  const secondary = flatMaterial(p.secondary, { emissive: p.secondary, emissiveIntensity: 0.05 });
  const accent = glowMaterial(p.accent, 0.82);

  const base = addMesh(root, new THREE.CylinderGeometry(0.46, 0.54, 0.12, 8), dark, 0, 0.12, 0);
  const ring = addMesh(root, new THREE.TorusGeometry(0.36, 0.04, 5, 14), primary, 0, 0.22, 0);
  ring.rotation.x = Math.PI / 2;
  const marker = addMesh(root,
    themeId === "robotica" ? new THREE.BoxGeometry(0.24, 0.38, 0.24) : new THREE.OctahedronGeometry(0.17, 0),
    secondary, 0, 0.58, 0);
  const left = addMesh(root, new THREE.SphereGeometry(0.07, 6, 5), accent, -0.36, 0.42, 0.06);
  const right = addMesh(root, new THREE.SphereGeometry(0.07, 6, 5), primary, 0.36, 0.42, -0.04);

  if (themeId === "halloween") {
    marker.scale.y = 0.76;
    const stem = addMesh(root, new THREE.ConeGeometry(0.05, 0.15, 5), accent, 0, 0.76, 0);
    stem.rotation.z = 0.2;
  } else if (themeId === "christmas") {
    marker.geometry.dispose?.();
    marker.geometry = new THREE.ConeGeometry(0.22, 0.54, 6);
    marker.position.y = 0.54;
  } else if (themeId === "newyear") {
    const spark = addMesh(root, new THREE.BoxGeometry(0.6, 0.045, 0.08), accent, 0, 0.76, 0);
    spark.rotation.z = 0.48;
  } else if (themeId === "robotica") {
    const arm = addMesh(root, new THREE.BoxGeometry(0.09, 0.42, 0.09), primary, 0.16, 0.82, 0);
    arm.rotation.z = -0.35;
  } else {
    const glyph = addMesh(root, new THREE.BoxGeometry(0.5, 0.055, 0.08), accent, 0, 0.78, 0);
    glyph.rotation.z = -0.18;
  }

  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost(themeId, state);
    ring.rotation.z = time * (themeId === "robotica" ? 0.36 : 0.22) * boost;
    marker.rotation.y = time * (themeId === "software" ? 0.62 : 0.32) * boost;
    marker.position.y = (themeId === "christmas" ? 0.54 : 0.58) + Math.sin(time * 1.8 + entity.id.length) * 0.045 * boost;
    left.position.y = 0.42 + Math.sin(time * 2.4) * 0.05;
    right.position.y = 0.42 + Math.sin(time * 2.4 + Math.PI) * 0.05;
    base.rotation.y = Math.sin(time * 0.3) * 0.025;
  };
  markEntityPickTarget(root, entity.id);
  return root;
}

function createHauntfall(power) {
  const root = new THREE.Group();
  root.name = "halloween-hauntfall";
  const p = PALETTES.halloween;
  const dark = flatMaterial(p.dark, { roughness: 0.94 });
  const orange = glowMaterial(p.primary, 0.92);
  const purple = glowMaterial(p.secondary, 0.72);
  const green = glowMaterial(p.accent, 0.72);
  const dais = addMesh(root, new THREE.CylinderGeometry(0.9, 1, 0.1, 10), dark, 0, 0.1, 0);
  const pumpkin = addMesh(root, new THREE.SphereGeometry(0.42, 8, 6), orange, 0, 0.52, 0);
  pumpkin.scale.y = 0.76;
  const stem = addMesh(root, new THREE.ConeGeometry(0.1, 0.32, 5), green, 0, 0.88, 0);
  stem.rotation.z = 0.2;
  const bats = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const bat = addMesh(root, new THREE.ConeGeometry(0.13, 0.42, 3), dark,
      Math.cos(angle) * 1.25, 0.86 + (index % 2) * 0.22, Math.sin(angle) * 1.25);
    bat.rotation.z = Math.PI / 2;
    bat.userData.phase = angle;
    bats.push(bat);
  }
  const fog = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const mote = addMesh(root, new THREE.SphereGeometry(0.09, 5, 4), index % 3 === 0 ? orange : purple,
      Math.cos(angle) * 1.45, 0.28, Math.sin(angle) * 1.45);
    mote.userData.phase = angle;
    fog.push(mote);
  }
  root.userData.setQuality = (profile) => fog.forEach((mote, index) => { mote.visible = profile !== "tiny" || index % 2 === 0; });
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("halloween", state) * stagePulse(power);
    dais.rotation.y = time * 0.02;
    pumpkin.scale.set(1 + Math.sin(time * 1.7) * 0.04 * boost, 0.76 - Math.sin(time * 1.7) * 0.025, 1 + Math.sin(time * 1.7) * 0.04 * boost);
    bats.forEach((bat, index) => {
      const angle = bat.userData.phase + time * (0.18 + index * 0.01) * boost;
      bat.position.x = Math.cos(angle) * 1.25;
      bat.position.z = Math.sin(angle) * 1.25;
      bat.position.y = 0.86 + (index % 2) * 0.22 + Math.sin(time * 2.5 + index) * 0.13;
      bat.rotation.y = -angle;
    });
    fog.forEach((mote, index) => {
      const angle = mote.userData.phase + time * 0.07;
      mote.position.x = Math.cos(angle) * (1.25 + index * 0.04);
      mote.position.z = Math.sin(angle) * (1.25 + index * 0.04);
      mote.position.y = 0.2 + ((time * 0.08 + index / fog.length) % 1) * 0.58 * boost;
    });
  };
  return root;
}

function createSnowglow(power) {
  const root = new THREE.Group();
  root.name = "christmas-snowglow";
  const p = PALETTES.christmas;
  const green = flatMaterial(p.secondary);
  const red = glowMaterial(p.primary, 0.88);
  const gold = glowMaterial(p.accent, 0.9);
  const dark = flatMaterial(p.dark);
  const base = addMesh(root, new THREE.CylinderGeometry(0.88, 0.98, 0.1, 10), dark, 0, 0.1, 0);
  const tree = addMesh(root, new THREE.ConeGeometry(0.58, 1.5, 7), green, 0, 0.84, 0);
  const star = addMesh(root, new THREE.OctahedronGeometry(0.18, 0), gold, 0, 1.72, 0);
  const ornaments = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const ornament = addMesh(root, new THREE.SphereGeometry(0.08, 6, 5), index % 2 ? red : gold,
      Math.cos(angle) * (0.34 + (index % 3) * 0.06), 0.6 + (index % 4) * 0.22, Math.sin(angle) * (0.34 + (index % 3) * 0.06));
    ornaments.push(ornament);
  }
  const snow = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2;
    const flake = addMesh(root, new THREE.OctahedronGeometry(0.055, 0), gold,
      Math.cos(angle) * 1.35, 0.6 + (index % 3) * 0.38, Math.sin(angle) * 1.35);
    flake.userData.phase = index / 10;
    snow.push(flake);
  }
  root.userData.setQuality = (profile) => snow.forEach((flake, index) => { flake.visible = profile !== "tiny" || index % 2 === 0; });
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("christmas", state) * stagePulse(power);
    base.rotation.y = time * 0.025;
    tree.rotation.y = Math.sin(time * 0.35) * 0.04;
    star.rotation.y = time * 0.48;
    star.scale.setScalar(0.88 + Math.sin(time * 2.1) * 0.12 * boost);
    ornaments.forEach((ornament, index) => { ornament.scale.setScalar(0.88 + Math.sin(time * 2.6 + index) * 0.1 * boost); });
    snow.forEach((flake, index) => {
      const fall = (flake.userData.phase + time * 0.08 * boost) % 1;
      flake.position.y = 1.75 - fall * 1.45;
      flake.position.x += Math.sin(time * 0.7 + index) * 0.0015;
      flake.rotation.y = time * (0.3 + index * 0.02);
    });
  };
  return root;
}

function createCountdownBurst(power) {
  const root = new THREE.Group();
  root.name = "newyear-countdown-burst";
  const p = PALETTES.newyear;
  const dark = flatMaterial(p.dark);
  const gold = glowMaterial(p.primary, 0.92);
  const silver = glowMaterial(p.secondary, 0.82);
  const blue = glowMaterial(p.accent, 0.82);
  const dais = addMesh(root, new THREE.CylinderGeometry(0.82, 0.94, 0.1, 10), dark, 0, 0.1, 0);
  const rings = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = addMesh(root, new THREE.TorusGeometry(0.46 + index * 0.32, 0.04, 5, 18), index === 1 ? silver : gold, 0, 0.65 + index * 0.2, 0);
    ring.rotation.x = index === 0 ? Math.PI / 2 : Math.PI / 3 + index * 0.2;
    rings.push(ring);
  }
  const bursts = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    const ray = addMesh(root, new THREE.BoxGeometry(0.58, 0.045, 0.07), index % 3 === 0 ? blue : index % 2 ? silver : gold,
      Math.cos(angle) * 1.1, 1.1, Math.sin(angle) * 1.1);
    ray.rotation.y = -angle;
    ray.userData.phase = angle;
    bursts.push(ray);
  }
  root.userData.setQuality = (profile) => bursts.forEach((ray, index) => { ray.visible = profile !== "tiny" || index % 2 === 0; });
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("newyear", state) * stagePulse(power);
    dais.rotation.y = time * 0.025;
    rings.forEach((ring, index) => {
      ring.rotation.z = time * (0.18 + index * 0.07) * (index % 2 ? -1 : 1) * boost;
      ring.scale.setScalar(0.94 + Math.sin(time * 1.5 + index) * 0.06 * boost);
    });
    bursts.forEach((ray, index) => {
      const pulse = 0.72 + Math.max(0, Math.sin(time * 3.2 + index * 0.52)) * 0.5 * boost;
      ray.scale.x = pulse;
      ray.position.y = 0.9 + Math.max(0, Math.sin(time * 2.1 + index)) * 0.45 * boost;
    });
  };
  return root;
}

function createServoSurge(power) {
  const root = new THREE.Group();
  root.name = "robotica-servo-surge";
  const p = PALETTES.robotica;
  const dark = flatMaterial(p.dark, { metalness: 0.22 });
  const amber = glowMaterial(p.primary, 0.9);
  const cyan = glowMaterial(p.secondary, 0.82);
  const steel = flatMaterial(p.accent, { metalness: 0.25 });
  const core = addMesh(root, new THREE.CylinderGeometry(0.5, 0.62, 0.38, 8), dark, 0, 0.28, 0);
  const gears = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = addMesh(root, new THREE.TorusGeometry(0.56 + index * 0.28, 0.06, 5, 16), index === 1 ? cyan : amber,
      0, 0.72 + index * 0.16, 0);
    ring.rotation.x = Math.PI / 2 + index * 0.22;
    gears.push(ring);
  }
  const pistons = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2;
    const x = Math.cos(angle) * 1.18;
    const z = Math.sin(angle) * 1.18;
    const housing = addMesh(root, new THREE.BoxGeometry(0.26, 0.42, 0.26), steel, x, 0.38, z);
    const piston = addMesh(root, new THREE.CylinderGeometry(0.05, 0.065, 0.7, 6), amber, x, 0.83, z);
    const node = addMesh(root, new THREE.OctahedronGeometry(0.1, 0), cyan, x, 1.18, z);
    pistons.push({ housing, piston, node });
  }
  root.userData.setQuality = () => {};
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("robotica", state) * stagePulse(power);
    core.rotation.y = time * 0.12;
    gears.forEach((gear, index) => { gear.rotation.z = time * (0.24 + index * 0.12) * (index % 2 ? -1 : 1) * boost; });
    pistons.forEach(({ housing, piston, node }, index) => {
      housing.rotation.y = Math.sin(time * 0.7 + index) * 0.08;
      piston.scale.y = 0.72 + Math.max(0, Math.sin(time * 2.6 + index * 1.4)) * 0.46 * boost;
      node.position.y = 1.18 + Math.sin(time * 3.1 + index) * 0.08;
    });
  };
  return root;
}

function createCodewave(power) {
  const root = new THREE.Group();
  root.name = "software-codewave";
  const p = PALETTES.software;
  const dark = flatMaterial(p.dark, { metalness: 0.08 });
  const cyan = glowMaterial(p.primary, 0.9);
  const violet = glowMaterial(p.secondary, 0.84);
  const green = glowMaterial(p.accent, 0.84);
  const core = addMesh(root, new THREE.OctahedronGeometry(0.34, 0), cyan, 0, 0.82, 0);
  const rings = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = addMesh(root, new THREE.TorusGeometry(0.52 + index * 0.34, 0.035, 5, 18), index === 1 ? violet : cyan,
      0, 0.82, 0);
    ring.rotation.x = Math.PI / 2 + index * 0.3;
    rings.push(ring);
  }
  const nodes = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2;
    const node = addMesh(root, new THREE.SphereGeometry(0.075, 6, 5), index % 3 === 0 ? green : index % 2 ? violet : cyan,
      Math.cos(angle) * 1.35, 0.55 + (index % 3) * 0.22, Math.sin(angle) * 1.35);
    node.userData.phase = angle;
    const glyph = addMesh(root, new THREE.BoxGeometry(0.34, 0.055, 0.07), index % 2 ? cyan : violet,
      Math.cos(angle) * 1.58, 0.38 + (index % 4) * 0.17, Math.sin(angle) * 1.58);
    glyph.rotation.y = -angle;
    nodes.push({ node, glyph });
  }
  root.userData.setQuality = (profile) => nodes.forEach(({ glyph, node }, index) => {
    glyph.visible = profile !== "tiny" || index % 2 === 0;
    node.visible = profile !== "tiny" || index < 6;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = themeBoost("software", state) * stagePulse(power);
    core.rotation.y = time * 0.58 * boost;
    core.scale.setScalar(0.9 + Math.sin(time * 2.1) * 0.1 * boost);
    rings.forEach((ring, index) => {
      ring.rotation.z = time * (0.16 + index * 0.08) * (index % 2 ? -1 : 1) * boost;
      ring.rotation.y = time * (0.08 + index * 0.03) * boost;
    });
    nodes.forEach(({ node, glyph }, index) => {
      const angle = node.userData.phase + time * (0.08 + index * 0.003) * boost;
      node.position.x = Math.cos(angle) * 1.35;
      node.position.z = Math.sin(angle) * 1.35;
      node.position.y = 0.55 + (index % 3) * 0.22 + Math.sin(time * 1.8 + index) * 0.12 * boost;
      glyph.scale.x = 0.72 + Math.max(0, Math.sin(time * 2.8 + index * 0.6)) * 0.42 * boost;
    });
  };
  return root;
}

function createLandPowerVisual(power) {
  if (power.themeId === "halloween") return createHauntfall(power);
  if (power.themeId === "christmas") return createSnowglow(power);
  if (power.themeId === "newyear") return createCountdownBurst(power);
  if (power.themeId === "robotica") return createServoSurge(power);
  return createCodewave(power);
}

/**
 * Full themed-land layer for seasonal and technology identities. Baseline land
 * presentation is visible immediately; fitting attractions receive local dressing;
 * the shared Style Superpower charge only controls the larger district spectacle.
 * No authoritative simulation values are changed here.
 */
export class WorldRenderer extends MedievalStyleWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.festivalTechRoot = new THREE.Group();
    this.festivalTechRoot.name = "bounded-render-only-seasonal-robotica-software-styles";
    this.festivalTechDistrictRoots = new Map();
    this.globe.root.add(this.festivalTechRoot);
  }

  syncStyleSuperpowers() {
    super.syncStyleSuperpowers();
    for (const power of this.stylePowerPlan ?? []) {
      if (!LAND_THEME_SET.has(power.themeId) || !power.active) continue;
      const root = this.stylePowerRoots.get(power.districtId);
      if (!root) continue;
      const signature = `${power.id}:${power.stage}:${power.score}:${power.anchors.map((item) => item.entityId).join("|")}`;
      if (root.userData.festivalTechSignature === signature) continue;
      const previous = root.userData.festivalTechVisual;
      if (previous) {
        root.remove(previous);
        disposeTree(previous);
      }
      const baseUpdate = root.userData.festivalTechWrapped ? root.userData.festivalTechBaseUpdate : root.userData.updateVisual;
      const baseQuality = root.userData.festivalTechWrapped ? root.userData.festivalTechBaseQuality : root.userData.setQuality;
      const visual = createLandPowerVisual(power);
      root.add(visual);
      root.userData.festivalTechVisual = visual;
      root.userData.festivalTechSignature = signature;
      root.userData.festivalTechWrapped = true;
      root.userData.festivalTechBaseUpdate = baseUpdate;
      root.userData.festivalTechBaseQuality = baseQuality;
      root.userData.actorCount = actorCount(root);
      root.userData.setQuality = (profile) => {
        baseQuality?.(profile);
        visual.userData.setQuality?.(profile);
      };
      root.userData.updateVisual = (time, state) => {
        baseUpdate?.(time, state);
        visual.userData.updateVisual?.(time, state);
      };
      root.userData.setQuality?.(this.qualityProfile);
    }
  }

  syncWorld() {
    super.syncWorld();
    if (!this.state || !this.festivalTechRoot) return;
    this.syncFestivalTechDistrictFrames();
    this.syncFestivalTechEntityDressings();
  }

  syncFestivalTechDistrictFrames() {
    const live = new Set();
    for (const power of (this.stylePowerPlan ?? []).slice(0, LAND_ROOT_LIMIT)) {
      if (!LAND_THEME_SET.has(power.themeId)) continue;
      live.add(power.districtId);
      const signature = `${power.districtId}:${power.themeId}:${power.stage}:${power.score}:${power.center.x.toFixed(2)}:${power.center.z.toFixed(2)}`;
      let root = this.festivalTechDistrictRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) {
        this.festivalTechRoot.remove(root);
        disposeTree(root);
      }
      root = createLandFrame(power);
      root.userData.signature = signature;
      root.userData.themeId = power.themeId;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.34 });
      root.userData.setQuality?.(this.qualityProfile);
      this.festivalTechRoot.add(root);
      this.festivalTechDistrictRoots.set(power.districtId, root);
    }
    for (const [districtId, root] of this.festivalTechDistrictRoots) {
      if (live.has(districtId)) continue;
      this.festivalTechRoot.remove(root);
      disposeTree(root);
      this.festivalTechDistrictRoots.delete(districtId);
    }
  }

  syncFestivalTechEntityDressings() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      const fit = themeFitForEntity(this.state, entity);
      const shouldDress = LAND_THEME_SET.has(identity.themeId)
        && !["contrast", "neutral"].includes(fit.status);
      const signature = shouldDress
        ? `${identity.districtId}:${identity.themeId}:${fit.status}:${fit.matchedTags.join("|")}:${entity.catalogId}`
        : "off";

      let root = model.userData.festivalTechStyleDressingRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "festival-tech-style-dressing-root";
        model.add(root);
        model.userData.festivalTechStyleDressingRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (shouldDress) root.add(createEntityDressing(identity.themeId, fit, entity));
      root.userData.signature = signature;
      root.userData.themeId = identity.themeId;
      root.visible = shouldDress;
    }
  }

  setQuality(profile) {
    super.setQuality(profile);
    for (const root of this.festivalTechDistrictRoots?.values?.() ?? []) root.userData.setQuality?.(this.qualityProfile);
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.festivalTechDistrictRoots.values()) root.userData.updateVisual?.(time, this.state);
    for (const model of this.entityModels.values()) {
      const root = model.userData.festivalTechStyleDressingRoot;
      for (const dressing of root?.children ?? []) dressing.userData.updateVisual?.(time, this.state);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    const styledDistricts = { halloween: 0, christmas: 0, newyear: 0, robotica: 0, software: 0 };
    let dressedElements = 0;
    let actorCountTotal = 0;
    for (const root of this.festivalTechDistrictRoots.values()) {
      actorCountTotal += root.userData.actorCount ?? 0;
      if (styledDistricts[root.userData.themeId] !== undefined) styledDistricts[root.userData.themeId] += 1;
    }
    for (const model of this.entityModels.values()) {
      if (model.userData.festivalTechStyleDressingRoot?.visible) dressedElements += 1;
    }
    for (const root of this.stylePowerRoots.values()) {
      if (LAND_THEME_SET.has(root.userData.power?.themeId)) actorCountTotal += root.userData.actorCount ?? 0;
    }
    return Object.freeze({
      ...base,
      seasonalTechStyles: Object.freeze({
        presentationOnly: true,
        districtBudget: LAND_ROOT_LIMIT,
        styledDistricts: Object.freeze(styledDistricts),
        dressedElements,
        actorCount: actorCountTotal,
        powers: Object.freeze({
          halloween: "hauntfall",
          christmas: "snowglow",
          newyear: "countdown-burst",
          robotica: "servo-surge",
          software: "codewave"
        })
      })
    });
  }
}
