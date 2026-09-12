import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as WesternStyleWorldRenderer } from "./westernStyleWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { districtThemeForEntity } from "../core/districts.js";
import { themeFitForEntity } from "../core/themeFit.js";

const MEDIEVAL_ROOT_LIMIT = 4;
const COLORS = Object.freeze({
  stone: 0x625f61,
  darkStone: 0x3e3c42,
  timber: 0x6d4e38,
  crimson: 0xa94d4d,
  blue: 0x526e9f,
  gold: 0xe0bd68,
  torch: 0xf0a052,
  cloth: 0xd2c6a0
});

function medievalMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0.03,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function signalMaterial(color, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false });
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
  return status === "signature" ? 1.08 : status === "strong" ? 0.97 : status === "compatible" ? 0.83 : 0.72;
}

function torchBoost(state) {
  const minute = ((Number(state?.clock?.minute) || 0) % 1440 + 1440) % 1440;
  const night = minute >= 1080 || minute < 360;
  const evening = minute >= 960 && minute < 1080;
  const cloudy = state?.weather?.type === "cloudy" || state?.weather?.type === "rain";
  return Math.min(1.42, 1 + (night ? 0.28 : evening ? 0.16 : 0) + (cloudy ? 0.08 : 0));
}

function createMedievalEntityDressing(fit, entity) {
  const root = new THREE.Group();
  root.name = `medieval-entity-dressing-${fit.status}`;
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.position.set(-Math.min(2.2, width * 0.46), 0.13, Math.min(1.7, depth * 0.32));
  root.scale.setScalar(fitScale(fit.status) * Math.min(1.24, 0.82 + Math.max(width, depth) * 0.055));

  const stone = medievalMaterial(COLORS.stone, { roughness: 0.96 });
  const timber = medievalMaterial(COLORS.timber, { roughness: 0.96 });
  const crimson = medievalMaterial(COLORS.crimson);
  const torch = signalMaterial(COLORS.torch, fit.status === "compatible" ? 0.68 : 0.9);

  addMesh(root, new THREE.CylinderGeometry(0.5, 0.56, 0.15, 8), stone, 0, 0.12, 0);
  const archLeft = addMesh(root, new THREE.BoxGeometry(0.12, 0.72, 0.16), stone, -0.28, 0.53, 0);
  const archRight = addMesh(root, new THREE.BoxGeometry(0.12, 0.72, 0.16), stone, 0.28, 0.53, 0);
  addMesh(root, new THREE.BoxGeometry(0.68, 0.12, 0.16), stone, 0, 0.85, 0);
  const mast = addMesh(root, new THREE.CylinderGeometry(0.035, 0.045, 0.92, 5), timber, 0.42, 0.55, 0);
  const banner = addMesh(root, new THREE.BoxGeometry(0.28, 0.4, 0.05), crimson, 0.52, 0.78, 0);
  const flame = addMesh(root, new THREE.OctahedronGeometry(0.1, 0), torch, -0.42, 0.82, 0);

  root.userData.updateVisual = (time, state) => {
    const boost = torchBoost(state);
    archLeft.rotation.z = Math.sin(time * 0.45) * 0.005;
    archRight.rotation.z = -Math.sin(time * 0.45) * 0.005;
    mast.rotation.z = Math.sin(time * 0.8) * 0.012;
    banner.rotation.y = Math.sin(time * 2.0) * 0.1 * boost;
    banner.scale.x = 0.96 + Math.sin(time * 2.3) * 0.04;
    flame.position.y = 0.82 + Math.sin(time * 4.2) * 0.04;
    flame.scale.setScalar(0.82 + Math.sin(time * 5.1) * 0.18 * boost);
  };
  markEntityPickTarget(root, entity.id);
  return root;
}

function createMedievalDistrictFrame(power) {
  const root = new THREE.Group();
  root.name = `medieval-district-frame-${power.districtId}`;
  const stone = medievalMaterial(COLORS.stone, { roughness: 0.97 });
  const darkStone = medievalMaterial(COLORS.darkStone, { roughness: 0.96 });
  const timber = medievalMaterial(COLORS.timber, { roughness: 0.96 });
  const crimson = medievalMaterial(COLORS.crimson);
  const blue = medievalMaterial(COLORS.blue);
  const torch = signalMaterial(COLORS.torch, 0.82);

  const court = addMesh(root, new THREE.TorusGeometry(1.48, 0.075, 6, 18), stone, 0, 0.11, 0);
  court.rotation.x = Math.PI / 2;
  const inner = addMesh(root, new THREE.TorusGeometry(1.22, 0.035, 5, 16), darkStone, 0, 0.16, 0);
  inner.rotation.x = Math.PI / 2;

  const towers = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * 1.05;
    const z = Math.sin(angle) * 1.05;
    const tower = addMesh(root, new THREE.CylinderGeometry(0.2, 0.24, 0.9, 8), stone, x, 0.55, z);
    const cap = addMesh(root, new THREE.ConeGeometry(0.3, 0.34, 6), darkStone, x, 1.16, z);
    const flame = addMesh(root, new THREE.OctahedronGeometry(0.08, 0), torch, x, 1.43, z);
    towers.push({ tower, cap, flame });
  }

  const banners = [];
  for (let index = 0; index < 4; index += 1) {
    const x = (index - 1.5) * 0.52;
    addMesh(root, new THREE.CylinderGeometry(0.03, 0.04, 0.95, 5), timber, x, 0.55, -0.12);
    const banner = addMesh(root, new THREE.BoxGeometry(0.28, 0.42, 0.045), index % 2 ? blue : crimson, x + 0.12, 0.78, -0.12);
    banners.push(banner);
  }

  root.userData.updateVisual = (time, state) => {
    const boost = torchBoost(state);
    inner.rotation.z = time * 0.035;
    towers.forEach(({ cap, flame }, index) => {
      cap.rotation.y = Math.sin(time * 0.35 + index) * 0.035;
      flame.position.y = 1.43 + Math.sin(time * 3.6 + index) * 0.045;
      flame.scale.setScalar(0.82 + Math.sin(time * 4.5 + index) * 0.18 * boost);
    });
    banners.forEach((banner, index) => {
      banner.rotation.y = Math.sin(time * 1.8 + index * 0.7) * 0.12 * boost;
      banner.scale.x = 0.95 + Math.sin(time * 2.1 + index) * 0.05;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

function createBannerwake(power) {
  const root = new THREE.Group();
  root.name = "medieval-bannerwake";
  const stone = medievalMaterial(COLORS.darkStone, { roughness: 0.95 });
  const lightStone = medievalMaterial(COLORS.stone, { roughness: 0.96 });
  const timber = medievalMaterial(COLORS.timber, { roughness: 0.96 });
  const crimson = medievalMaterial(COLORS.crimson);
  const blue = medievalMaterial(COLORS.blue);
  const gold = signalMaterial(COLORS.gold, 0.86);
  const torch = signalMaterial(COLORS.torch, 0.92);

  addMesh(root, new THREE.CylinderGeometry(0.92, 1.02, 0.12, 10), stone, 0, 0.09, 0);
  const keep = addMesh(root, new THREE.BoxGeometry(0.72, 1.05, 0.72), lightStone, 0, 0.68, 0);
  const crown = addMesh(root, new THREE.TorusGeometry(0.58, 0.045, 6, 16), gold, 0, 1.36, 0);
  crown.rotation.x = Math.PI / 2;

  const banners = [];
  const flames = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const radius = 1.14;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    addMesh(root, new THREE.CylinderGeometry(0.035, 0.045, 1.1, 5), timber, x, 0.65, z);
    const banner = addMesh(root, new THREE.BoxGeometry(0.26, 0.46, 0.045), index % 2 ? blue : crimson, x, 0.9, z);
    banner.rotation.y = -angle;
    banners.push(banner);
    const flame = addMesh(root, new THREE.OctahedronGeometry(0.09, 0), torch, x, 1.28, z);
    flames.push(flame);
  }

  const motes = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const mote = addMesh(root, new THREE.SphereGeometry(0.055, 5, 4), gold, Math.cos(angle) * 1.42, 0.48, Math.sin(angle) * 1.42);
    mote.userData.phase = angle;
    motes.push(mote);
  }

  root.userData.setQuality = (profile) => motes.forEach((mote, index) => {
    mote.visible = profile !== "tiny" || index % 2 === 0;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = torchBoost(state);
    keep.rotation.y = Math.sin(time * 0.22) * 0.025;
    crown.rotation.z = time * 0.13 * boost;
    banners.forEach((banner, index) => {
      banner.rotation.z = Math.sin(time * 1.9 + index * 0.7) * 0.06 * boost;
      banner.scale.x = 0.94 + Math.sin(time * 2.3 + index) * 0.06;
    });
    flames.forEach((flame, index) => {
      flame.position.y = 1.28 + Math.sin(time * 4.1 + index) * 0.055;
      flame.scale.setScalar(0.8 + Math.sin(time * 5.0 + index) * 0.2 * boost);
    });
    motes.forEach((mote, index) => {
      const angle = mote.userData.phase + time * 0.11 * boost;
      mote.position.x = Math.cos(angle) * 1.42;
      mote.position.z = Math.sin(angle) * 1.42;
      mote.position.y = 0.42 + ((time * 0.1 + index / motes.length) % 1) * 0.92;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

/** Medieval presentation layer: bounded, selectable and simulation-independent. */
export class WorldRenderer extends WesternStyleWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.medievalDistrictRoot = new THREE.Group();
    this.medievalDistrictRoot.name = "bounded-render-only-medieval-style";
    this.medievalDistrictRoots = new Map();
    this.globe.root.add(this.medievalDistrictRoot);
  }

  syncStyleSuperpowers() {
    super.syncStyleSuperpowers();
    if (!this.stylePowerPlan) return;
    for (const power of this.stylePowerPlan) {
      if (power.themeId !== "medieval" || !power.active) continue;
      const root = this.stylePowerRoots.get(power.districtId);
      if (!root) continue;
      const signature = `${power.id}:${power.stage}:${power.score}:${power.anchors.map((item) => item.entityId).join("|")}`;
      if (root.userData.medievalSignature === signature) continue;
      const previous = root.userData.medievalVisual;
      if (previous) { root.remove(previous); disposeTree(previous); }
      const baseUpdate = root.userData.baseMedievalWrapped ? root.userData.baseUpdateMedieval : root.userData.updateVisual;
      const baseQuality = root.userData.baseMedievalWrapped ? root.userData.baseQualityMedieval : root.userData.setQuality;
      const visual = createBannerwake(power);
      root.add(visual);
      root.userData.medievalVisual = visual;
      root.userData.medievalSignature = signature;
      root.userData.baseMedievalWrapped = true;
      root.userData.baseUpdateMedieval = baseUpdate;
      root.userData.baseQualityMedieval = baseQuality;
      root.userData.actorCount = actorCount(root);
      root.userData.setQuality = (profile) => { baseQuality?.(profile); visual.userData.setQuality?.(profile); };
      root.userData.updateVisual = (time, state) => { baseUpdate?.(time, state); visual.userData.updateVisual?.(time, state); };
      root.userData.setQuality?.(this.qualityProfile);
    }
  }

  syncWorld() {
    super.syncWorld();
    if (!this.state || !this.medievalDistrictRoot) return;
    this.syncMedievalDistrictFrames();
    this.syncMedievalEntityDressings();
  }

  syncMedievalDistrictFrames() {
    const live = new Set();
    for (const power of (this.stylePowerPlan ?? []).slice(0, MEDIEVAL_ROOT_LIMIT)) {
      if (power.themeId !== "medieval") continue;
      live.add(power.districtId);
      const signature = `${power.districtId}:${power.stage}:${power.score}:${power.center.x.toFixed(2)}:${power.center.z.toFixed(2)}`;
      let root = this.medievalDistrictRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) { this.medievalDistrictRoot.remove(root); disposeTree(root); }
      root = createMedievalDistrictFrame(power);
      root.userData.signature = signature;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.34 });
      this.medievalDistrictRoot.add(root);
      this.medievalDistrictRoots.set(power.districtId, root);
    }
    for (const [districtId, root] of this.medievalDistrictRoots) {
      if (live.has(districtId)) continue;
      this.medievalDistrictRoot.remove(root);
      disposeTree(root);
      this.medievalDistrictRoots.delete(districtId);
    }
  }

  syncMedievalEntityDressings() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      const fit = themeFitForEntity(this.state, entity);
      const shouldDress = identity.themeId === "medieval" && !["contrast", "neutral"].includes(fit.status);
      const signature = shouldDress ? `${identity.districtId}:${fit.status}:${fit.matchedTags.join("|")}:${entity.catalogId}` : "off";
      let root = model.userData.medievalStyleDressingRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "medieval-style-dressing-root";
        model.add(root);
        model.userData.medievalStyleDressingRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (shouldDress) root.add(createMedievalEntityDressing(fit, entity));
      root.userData.signature = signature;
      root.visible = shouldDress;
    }
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.medievalDistrictRoots.values()) root.userData.updateVisual?.(time, this.state);
    for (const model of this.entityModels.values()) {
      const root = model.userData.medievalStyleDressingRoot;
      for (const dressing of root?.children ?? []) dressing.userData.updateVisual?.(time, this.state);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    let dressedElements = 0;
    let actors = 0;
    for (const root of this.medievalDistrictRoots.values()) actors += root.userData.actorCount ?? 0;
    for (const model of this.entityModels.values()) if (model.userData.medievalStyleDressingRoot?.visible) dressedElements += 1;
    for (const root of this.stylePowerRoots.values()) if (root.userData.power?.themeId === "medieval") actors += root.userData.actorCount ?? 0;
    return Object.freeze({ ...base, medievalStyle: Object.freeze({ presentationOnly: true, districtBudget: MEDIEVAL_ROOT_LIMIT, styledDistricts: this.medievalDistrictRoots.size, dressedElements, actorCount: actors, powerId: "bannerwake" }) });
  }
}
