import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as FantasyStyleWorldRenderer } from "./fantasyStyleWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { districtThemeForEntity } from "../core/districts.js";
import { themeFitForEntity } from "../core/themeFit.js";

const WESTERN_ROOT_LIMIT = 4;
const COLORS = Object.freeze({
  timber: 0x795438,
  dark: 0x3d322b,
  dust: 0xc99a62,
  brass: 0xd9b66f,
  red: 0x9f5146,
  cream: 0xe0cc9c,
  sage: 0x83916b
});

function westernMaterial(color, options = {}) {
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

function signalMaterial(color, opacity = 0.86) {
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

function frontierBoost(state) {
  const minute = ((Number(state?.clock?.minute) || 0) % 1440 + 1440) % 1440;
  const lateDay = minute >= 900 && minute < 1140;
  const bright = state?.weather?.type === "bright";
  const raining = state?.weather?.type === "rain" || Number(state?.weather?.precipitation) > 0.05;
  return Math.min(1.38, 1 + (lateDay ? 0.22 : 0) + (bright ? 0.1 : 0) - (raining ? 0.08 : 0));
}

function createWesternEntityDressing(fit, entity) {
  const root = new THREE.Group();
  root.name = `western-entity-dressing-${fit.status}`;
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.position.set(-Math.min(2.2, width * 0.46), 0.13, Math.min(1.7, depth * 0.32));
  root.scale.setScalar(fitScale(fit.status) * Math.min(1.24, 0.82 + Math.max(width, depth) * 0.055));

  const timber = westernMaterial(COLORS.timber, { roughness: 0.96 });
  const dark = westernMaterial(COLORS.dark, { roughness: 0.94 });
  const brass = signalMaterial(COLORS.brass, fit.status === "compatible" ? 0.66 : 0.88);
  const red = westernMaterial(COLORS.red);

  addMesh(root, new THREE.BoxGeometry(0.88, 0.14, 0.42), timber, 0, 0.12, 0);
  const wheel = addMesh(root, new THREE.TorusGeometry(0.3, 0.055, 6, 12), dark, -0.28, 0.5, 0);
  wheel.rotation.y = Math.PI / 2;
  const post = addMesh(root, new THREE.CylinderGeometry(0.045, 0.06, 0.92, 6), timber, 0.34, 0.52, 0);
  const lantern = addMesh(root, new THREE.OctahedronGeometry(0.11, 0), brass, 0.34, 0.95, 0);
  const sign = addMesh(root, new THREE.BoxGeometry(0.48, 0.22, 0.08), red, 0.02, 0.78, 0.04);

  root.userData.updateVisual = (time, state) => {
    const boost = frontierBoost(state);
    wheel.rotation.z = time * 0.22 * boost;
    post.rotation.z = Math.sin(time * 0.8) * 0.018;
    lantern.position.y = 0.95 + Math.sin(time * 2.1) * 0.035 * boost;
    lantern.scale.setScalar(0.9 + Math.sin(time * 2.8) * 0.1);
    sign.rotation.y = Math.sin(time * 1.1) * 0.08;
  };
  markEntityPickTarget(root, entity.id);
  return root;
}

function createWesternDistrictFrame(power) {
  const root = new THREE.Group();
  root.name = `western-district-frame-${power.districtId}`;
  const timber = westernMaterial(COLORS.timber, { roughness: 0.97 });
  const dark = westernMaterial(COLORS.dark, { roughness: 0.95 });
  const dust = signalMaterial(COLORS.dust, 0.6);
  const brass = signalMaterial(COLORS.brass, 0.78);
  const sage = westernMaterial(COLORS.sage, { roughness: 0.95 });

  const trail = addMesh(root, new THREE.TorusGeometry(1.45, 0.065, 6, 18), timber, 0, 0.11, 0);
  trail.rotation.x = Math.PI / 2;
  const inner = addMesh(root, new THREE.TorusGeometry(1.2, 0.035, 5, 16), dust, 0, 0.16, 0);
  inner.rotation.x = Math.PI / 2;

  const wheels = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = index / 3 * Math.PI * 2;
    const wheel = addMesh(root, new THREE.TorusGeometry(0.24, 0.045, 6, 12), dark,
      Math.cos(angle) * 1.05, 0.48, Math.sin(angle) * 1.05);
    wheel.rotation.y = Math.PI / 2 - angle;
    wheels.push(wheel);
  }

  const tower = new THREE.Group();
  root.add(tower);
  const tank = addMesh(tower, new THREE.CylinderGeometry(0.34, 0.38, 0.5, 8), timber, 0, 1.18, 0);
  for (const [x, z] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]]) {
    addMesh(tower, new THREE.CylinderGeometry(0.035, 0.045, 1.0, 5), dark, x, 0.58, z);
  }
  const beacon = addMesh(tower, new THREE.OctahedronGeometry(0.1, 0), brass, 0, 1.55, 0);
  const tumble = addMesh(root, new THREE.IcosahedronGeometry(0.2, 0), sage, 1.42, 0.25, 0.25);

  root.userData.updateVisual = (time, state) => {
    const boost = frontierBoost(state);
    inner.rotation.z = time * 0.05 * boost;
    wheels.forEach((wheel, index) => { wheel.rotation.z = time * (0.16 + index * 0.025) * boost; });
    tank.rotation.y = Math.sin(time * 0.22) * 0.03;
    beacon.scale.setScalar(0.88 + Math.sin(time * 2.3) * 0.12);
    const loop = (time * 0.15 * boost) % 1;
    tumble.position.x = 1.42 - loop * 2.84;
    tumble.position.z = 0.25 + Math.sin(time * 0.9) * 0.22;
    tumble.rotation.x = time * 1.4;
    tumble.rotation.z = time * 0.9;
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

function createFrontierRush(power) {
  const root = new THREE.Group();
  root.name = "western-frontier-rush";
  const dark = westernMaterial(COLORS.dark, { roughness: 0.95 });
  const timber = westernMaterial(COLORS.timber, { roughness: 0.96 });
  const dust = signalMaterial(COLORS.dust, 0.74);
  const brass = signalMaterial(COLORS.brass, 0.9);
  const red = westernMaterial(COLORS.red);

  addMesh(root, new THREE.CylinderGeometry(0.78, 0.86, 0.1, 12), dark, 0, 0.08, 0);
  const wheel = addMesh(root, new THREE.TorusGeometry(0.62, 0.075, 6, 16), timber, 0, 0.72, 0);
  wheel.rotation.y = Math.PI / 2;
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const spoke = addMesh(root, new THREE.BoxGeometry(0.56, 0.055, 0.055), timber, 0, 0.72, 0);
    spoke.rotation.z = angle;
  }

  const lanterns = [];
  const dustMotes = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const lantern = addMesh(root, new THREE.OctahedronGeometry(0.105, 0), brass,
      Math.cos(angle) * 1.18, 0.62 + (index % 2) * 0.2, Math.sin(angle) * 1.18);
    lantern.userData.phase = angle;
    lanterns.push(lantern);
    const mote = addMesh(root, new THREE.SphereGeometry(0.07, 5, 4), dust,
      Math.cos(angle) * 1.45, 0.28, Math.sin(angle) * 1.45);
    mote.userData.phase = angle;
    dustMotes.push(mote);
  }
  const sign = addMesh(root, new THREE.BoxGeometry(1.0, 0.3, 0.1), red, 0, 1.48, 0);
  const post = addMesh(root, new THREE.CylinderGeometry(0.045, 0.06, 1.0, 6), timber, 0, 1.0, 0);

  root.userData.setQuality = (profile) => dustMotes.forEach((mote, index) => {
    mote.visible = profile !== "tiny" || index % 2 === 0;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = frontierBoost(state);
    wheel.rotation.z = time * 0.36 * boost;
    sign.rotation.y = Math.sin(time * 0.9) * 0.08;
    post.rotation.z = Math.sin(time * 0.7) * 0.012;
    lanterns.forEach((lantern, index) => {
      lantern.position.y = 0.62 + (index % 2) * 0.2 + Math.sin(time * 2.0 + index) * 0.08 * boost;
      lantern.scale.setScalar(0.86 + Math.sin(time * 2.7 + index) * 0.14);
    });
    dustMotes.forEach((mote, index) => {
      const angle = mote.userData.phase + time * 0.18 * boost;
      const radius = 1.36 + Math.sin(time * 1.1 + index) * 0.14;
      mote.position.x = Math.cos(angle) * radius;
      mote.position.z = Math.sin(angle) * radius;
      mote.position.y = 0.22 + ((time * 0.12 + index / dustMotes.length) % 1) * 0.62;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

/** Western presentation layer: bounded, selectable and simulation-independent. */
export class WorldRenderer extends FantasyStyleWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.westernDistrictRoot = new THREE.Group();
    this.westernDistrictRoot.name = "bounded-render-only-western-style";
    this.westernDistrictRoots = new Map();
    this.globe.root.add(this.westernDistrictRoot);
  }

  syncStyleSuperpowers() {
    super.syncStyleSuperpowers();
    if (!this.stylePowerPlan) return;
    for (const power of this.stylePowerPlan) {
      if (power.themeId !== "western" || !power.active) continue;
      const root = this.stylePowerRoots.get(power.districtId);
      if (!root) continue;
      const signature = `${power.id}:${power.stage}:${power.score}:${power.anchors.map((item) => item.entityId).join("|")}`;
      if (root.userData.westernSignature === signature) continue;
      const previous = root.userData.westernVisual;
      if (previous) { root.remove(previous); disposeTree(previous); }
      const baseUpdate = root.userData.baseWesternWrapped ? root.userData.baseUpdateWestern : root.userData.updateVisual;
      const baseQuality = root.userData.baseWesternWrapped ? root.userData.baseQualityWestern : root.userData.setQuality;
      const visual = createFrontierRush(power);
      root.add(visual);
      root.userData.westernVisual = visual;
      root.userData.westernSignature = signature;
      root.userData.baseWesternWrapped = true;
      root.userData.baseUpdateWestern = baseUpdate;
      root.userData.baseQualityWestern = baseQuality;
      root.userData.actorCount = actorCount(root);
      root.userData.setQuality = (profile) => { baseQuality?.(profile); visual.userData.setQuality?.(profile); };
      root.userData.updateVisual = (time, state) => { baseUpdate?.(time, state); visual.userData.updateVisual?.(time, state); };
      root.userData.setQuality?.(this.qualityProfile);
    }
  }

  syncWorld() {
    super.syncWorld();
    if (!this.state || !this.westernDistrictRoot) return;
    this.syncWesternDistrictFrames();
    this.syncWesternEntityDressings();
  }

  syncWesternDistrictFrames() {
    const live = new Set();
    for (const power of (this.stylePowerPlan ?? []).slice(0, WESTERN_ROOT_LIMIT)) {
      if (power.themeId !== "western") continue;
      live.add(power.districtId);
      const signature = `${power.districtId}:${power.stage}:${power.score}:${power.center.x.toFixed(2)}:${power.center.z.toFixed(2)}`;
      let root = this.westernDistrictRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) { this.westernDistrictRoot.remove(root); disposeTree(root); }
      root = createWesternDistrictFrame(power);
      root.userData.signature = signature;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.34 });
      this.westernDistrictRoot.add(root);
      this.westernDistrictRoots.set(power.districtId, root);
    }
    for (const [districtId, root] of this.westernDistrictRoots) {
      if (live.has(districtId)) continue;
      this.westernDistrictRoot.remove(root);
      disposeTree(root);
      this.westernDistrictRoots.delete(districtId);
    }
  }

  syncWesternEntityDressings() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      const fit = themeFitForEntity(this.state, entity);
      const shouldDress = identity.themeId === "western" && !["contrast", "neutral"].includes(fit.status);
      const signature = shouldDress ? `${identity.districtId}:${fit.status}:${fit.matchedTags.join("|")}:${entity.catalogId}` : "off";
      let root = model.userData.westernStyleDressingRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "western-style-dressing-root";
        model.add(root);
        model.userData.westernStyleDressingRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (shouldDress) root.add(createWesternEntityDressing(fit, entity));
      root.userData.signature = signature;
      root.visible = shouldDress;
    }
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.westernDistrictRoots.values()) root.userData.updateVisual?.(time, this.state);
    for (const model of this.entityModels.values()) {
      const root = model.userData.westernStyleDressingRoot;
      for (const dressing of root?.children ?? []) dressing.userData.updateVisual?.(time, this.state);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    let dressedElements = 0;
    let actors = 0;
    for (const root of this.westernDistrictRoots.values()) actors += root.userData.actorCount ?? 0;
    for (const model of this.entityModels.values()) if (model.userData.westernStyleDressingRoot?.visible) dressedElements += 1;
    for (const root of this.stylePowerRoots.values()) if (root.userData.power?.themeId === "western") actors += root.userData.actorCount ?? 0;
    return Object.freeze({ ...base, westernStyle: Object.freeze({ presentationOnly: true, districtBudget: WESTERN_ROOT_LIMIT, styledDistricts: this.westernDistrictRoots.size, dressedElements, actorCount: actors, powerId: "frontier-rush" }) });
  }
}
