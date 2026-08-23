import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as CartoonStyleWorldRenderer } from "./cartoonStyleWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { districtThemeForEntity } from "../core/districts.js";
import { themeFitForEntity } from "../core/themeFit.js";

const FANTASY_ROOT_LIMIT = 4;
const FANTASY_COLORS = Object.freeze({
  violet: 0xa88be8,
  aether: 0x79d6d2,
  gold: 0xe6cf83,
  moss: 0x789b69,
  stone: 0x555260,
  deep: 0x272736
});

function fantasyMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.05,
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

function magicBoost(state) {
  const minute = ((Number(state?.clock?.minute) || 0) % 1440 + 1440) % 1440;
  const night = minute >= 1080 || minute < 360;
  const twilight = (minute >= 1020 && minute < 1080) || (minute >= 360 && minute < 420);
  const raining = state?.weather?.type === "rain" || Number(state?.weather?.precipitation) > 0.05;
  return Math.min(1.46, 1 + (night ? 0.3 : twilight ? 0.14 : 0) + (raining ? 0.08 : 0));
}

function createFantasyEntityDressing(fit, entity) {
  const root = new THREE.Group();
  root.name = `fantasy-entity-dressing-${fit.status}`;
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.position.set(-Math.min(2.2, width * 0.46), 0.13, Math.min(1.7, depth * 0.32));
  root.scale.setScalar(fitScale(fit.status) * Math.min(1.24, 0.82 + Math.max(width, depth) * 0.055));

  const stone = fantasyMaterial(FANTASY_COLORS.stone, { roughness: 0.95 });
  const violet = fantasyMaterial(FANTASY_COLORS.violet, {
    emissive: FANTASY_COLORS.violet, emissiveIntensity: 0.1, roughness: 0.5
  });
  const aether = glowMaterial(FANTASY_COLORS.aether, fit.status === "compatible" ? 0.68 : 0.9);
  const gold = glowMaterial(FANTASY_COLORS.gold, 0.82);

  const base = addMesh(root, new THREE.CylinderGeometry(0.48, 0.56, 0.13, 8), stone, 0, 0.12, 0);
  const rune = addMesh(root, new THREE.TorusGeometry(0.37, 0.035, 5, 14), aether, 0, 0.22, 0);
  rune.rotation.x = Math.PI / 2;

  const crystals = [];
  for (const [x, z, height] of [[-0.24, 0.02, 0.52], [0.03, -0.04, 0.68], [0.28, 0.07, 0.44]]) {
    const baseY = 0.2 + height / 2;
    const crystal = addMesh(root, new THREE.ConeGeometry(0.12, height, 5), violet, x, baseY, z);
    crystal.userData.baseY = baseY;
    crystals.push(crystal);
  }

  const wisps = [];
  for (let index = 0; index < 3; index += 1) {
    const wisp = addMesh(root, new THREE.OctahedronGeometry(0.07, 0), index === 2 ? gold : aether, 0, 0.75, 0);
    wisp.userData.phase = index / 3 * Math.PI * 2;
    wisps.push(wisp);
  }

  root.userData.updateVisual = (time, state) => {
    const boost = magicBoost(state);
    rune.rotation.z = time * 0.22 * boost;
    base.rotation.y = Math.sin(time * 0.2) * 0.04;
    crystals.forEach((crystal, index) => {
      crystal.position.y = crystal.userData.baseY + Math.sin(time * 1.45 + index * 1.6) * 0.045 * boost;
      crystal.rotation.y = time * (0.08 + index * 0.02);
    });
    wisps.forEach((wisp, index) => {
      const angle = wisp.userData.phase + time * (0.42 + index * 0.04) * boost;
      const radius = 0.52 + index * 0.08;
      wisp.position.x = Math.cos(angle) * radius;
      wisp.position.z = Math.sin(angle) * radius;
      wisp.position.y = 0.72 + Math.sin(time * 1.9 + index) * 0.13 * boost;
      wisp.scale.setScalar(0.82 + Math.sin(time * 2.7 + index) * 0.12);
    });
  };
  markEntityPickTarget(root, entity.id);
  return root;
}

function createFantasyDistrictFrame(power) {
  const root = new THREE.Group();
  root.name = `fantasy-district-frame-${power.districtId}`;
  const stone = fantasyMaterial(FANTASY_COLORS.stone, { roughness: 0.96 });
  const moss = fantasyMaterial(FANTASY_COLORS.moss, { roughness: 0.94 });
  const violet = glowMaterial(FANTASY_COLORS.violet, 0.72);
  const aether = glowMaterial(FANTASY_COLORS.aether, 0.72);
  const gold = glowMaterial(FANTASY_COLORS.gold, 0.74);

  const outer = addMesh(root, new THREE.TorusGeometry(1.55, 0.075, 6, 18), stone, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const runeRing = addMesh(root, new THREE.TorusGeometry(1.28, 0.035, 5, 18), violet, 0, 0.17, 0);
  runeRing.rotation.x = Math.PI / 2;

  const stones = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * 1.03;
    const z = Math.sin(angle) * 1.03;
    const monolith = addMesh(root, new THREE.BoxGeometry(0.2, 0.9 + (index % 2) * 0.2, 0.24), stone,
      x, 0.56 + (index % 2) * 0.1, z);
    monolith.rotation.y = -angle + 0.12;
    const crystal = addMesh(root, new THREE.OctahedronGeometry(0.13, 0), index % 2 ? aether : gold,
      x, 1.12 + (index % 2) * 0.14, z);
    stones.push({ monolith, crystal });
  }

  const roots = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2;
    const rootBar = addMesh(root, new THREE.BoxGeometry(0.68, 0.07, 0.12), moss,
      Math.cos(angle) * 1.42, 0.19, Math.sin(angle) * 1.42);
    rootBar.rotation.y = -angle;
    rootBar.rotation.z = index % 2 ? 0.18 : -0.14;
    roots.push(rootBar);
  }

  const runes = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const shard = addMesh(root, new THREE.BoxGeometry(0.09, 0.34, 0.04), index % 2 ? violet : aether,
      Math.cos(angle) * 1.62, 0.62 + (index % 2) * 0.2, Math.sin(angle) * 1.62);
    shard.userData.phase = angle;
    runes.push(shard);
  }

  root.userData.setQuality = (profile) => runes.forEach((rune, index) => {
    rune.visible = profile !== "tiny" || index % 2 === 0;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = magicBoost(state);
    runeRing.rotation.z = time * 0.09 * boost;
    stones.forEach(({ monolith, crystal }, index) => {
      monolith.rotation.z = Math.sin(time * 0.65 + index) * 0.012;
      crystal.position.y = 1.12 + (index % 2) * 0.14 + Math.sin(time * 1.5 + index) * 0.06 * boost;
      crystal.rotation.y = time * (0.24 + index * 0.03);
    });
    roots.forEach((item, index) => { item.scale.x = 0.94 + Math.sin(time * 0.72 + index) * 0.06; });
    runes.forEach((rune, index) => {
      const angle = rune.userData.phase + time * 0.06 * boost;
      rune.position.x = Math.cos(angle) * 1.62;
      rune.position.z = Math.sin(angle) * 1.62;
      rune.position.y = 0.62 + (index % 2) * 0.2 + Math.sin(time * 1.2 + index) * 0.1 * boost;
      rune.rotation.y = -angle;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

function createAetherveil(power) {
  const root = new THREE.Group();
  root.name = "fantasy-aetherveil";
  const stone = fantasyMaterial(FANTASY_COLORS.deep, { roughness: 0.92 });
  const violet = glowMaterial(FANTASY_COLORS.violet, 0.9);
  const aether = glowMaterial(FANTASY_COLORS.aether, 0.9);
  const gold = glowMaterial(FANTASY_COLORS.gold, 0.86);

  const dais = addMesh(root, new THREE.CylinderGeometry(0.92, 1.02, 0.12, 10), stone, 0, 0.1, 0);
  const rings = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = addMesh(root, new THREE.TorusGeometry(0.56 + index * 0.3, 0.035, 5, 18), index === 1 ? aether : violet,
      0, 0.72 + index * 0.16, 0);
    ring.rotation.x = index === 0 ? Math.PI / 2 : Math.PI / 3 + index * 0.34;
    ring.userData.baseZ = index * 0.6;
    ring.rotation.z = ring.userData.baseZ;
    rings.push(ring);
  }

  const crystals = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const crystal = addMesh(root, new THREE.ConeGeometry(0.14, 0.58 + (index % 2) * 0.18, 5), index % 3 === 0 ? gold : violet,
      Math.cos(angle) * 1.18, 0.5 + (index % 2) * 0.1, Math.sin(angle) * 1.18);
    crystal.userData.phase = angle;
    crystals.push(crystal);
  }

  const wisps = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const wisp = addMesh(root, new THREE.OctahedronGeometry(0.08 + (index % 2) * 0.02, 0), index % 3 === 0 ? gold : aether,
      Math.cos(angle) * 1.45, 0.82, Math.sin(angle) * 1.45);
    wisp.userData.phase = angle;
    wisps.push(wisp);
  }

  const runes = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = index / 5 * Math.PI * 2;
    const rune = addMesh(root, new THREE.BoxGeometry(0.1, 0.42, 0.045), violet,
      Math.cos(angle) * 0.78, 1.42 + (index % 2) * 0.14, Math.sin(angle) * 0.78);
    rune.userData.phase = angle;
    runes.push(rune);
  }

  root.userData.setQuality = (profile) => {
    wisps.forEach((wisp, index) => { wisp.visible = profile !== "tiny" || index % 2 === 0; });
    runes.forEach((rune, index) => { rune.visible = profile !== "tiny" || index < 3; });
    rings.forEach((ring, index) => { ring.visible = profile !== "tiny" || index < 2; });
  };
  root.userData.updateVisual = (time, state) => {
    const boost = magicBoost(state);
    dais.rotation.y = time * 0.025;
    rings.forEach((ring, index) => {
      ring.rotation.z = ring.userData.baseZ + time * (0.16 + index * 0.06) * (index % 2 ? -1 : 1) * boost;
      ring.rotation.y = time * (0.08 + index * 0.03) * (index % 2 ? -1 : 1) * boost;
      ring.scale.setScalar(0.94 + Math.sin(time * 1.15 + index) * 0.06 * boost);
    });
    crystals.forEach((crystal, index) => {
      const angle = crystal.userData.phase + time * 0.08 * boost;
      crystal.position.x = Math.cos(angle) * 1.18;
      crystal.position.z = Math.sin(angle) * 1.18;
      crystal.position.y = 0.5 + (index % 2) * 0.1 + Math.sin(time * 1.4 + index) * 0.09 * boost;
      crystal.rotation.y = time * (0.18 + index * 0.018);
    });
    wisps.forEach((wisp, index) => {
      const angle = wisp.userData.phase + time * (0.22 + index * 0.008) * boost;
      const radius = 1.35 + Math.sin(time * 0.8 + index) * 0.18;
      wisp.position.x = Math.cos(angle) * radius;
      wisp.position.z = Math.sin(angle) * radius;
      wisp.position.y = 0.72 + Math.sin(time * 1.7 + index * 0.7) * 0.38 * boost;
      wisp.scale.setScalar(0.78 + Math.sin(time * 2.3 + index) * 0.16);
    });
    runes.forEach((rune, index) => {
      const angle = rune.userData.phase - time * 0.11 * boost;
      rune.position.x = Math.cos(angle) * 0.78;
      rune.position.z = Math.sin(angle) * 0.78;
      rune.position.y = 1.42 + (index % 2) * 0.14 + Math.sin(time * 1.05 + index) * 0.14 * boost;
      rune.rotation.y = -angle;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

/**
 * Additive Fantasy identity layer. It derives everything from the existing
 * district/theme-fit/superpower plan and never mutates simulation authority.
 */
export class WorldRenderer extends CartoonStyleWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.fantasyDistrictRoot = new THREE.Group();
    this.fantasyDistrictRoot.name = "bounded-render-only-fantasy-style";
    this.fantasyDistrictRoots = new Map();
    this.globe.root.add(this.fantasyDistrictRoot);
  }

  syncStyleSuperpowers() {
    super.syncStyleSuperpowers();
    if (!this.stylePowerPlan) return;
    for (const power of this.stylePowerPlan) {
      if (power.themeId !== "fantasy" || !power.active) continue;
      const root = this.stylePowerRoots.get(power.districtId);
      if (!root) continue;
      const signature = `${power.id}:${power.stage}:${power.score}:${power.anchors.map((item) => item.entityId).join("|")}`;
      if (root.userData.fantasySignature === signature) continue;

      const previous = root.userData.fantasyVisual;
      if (previous) {
        root.remove(previous);
        disposeTree(previous);
      }
      const baseUpdate = root.userData.baseFantasyWrapped ? root.userData.baseFantasyUpdate : root.userData.updateVisual;
      const baseQuality = root.userData.baseFantasyWrapped ? root.userData.baseFantasyQuality : root.userData.setQuality;
      const visual = createAetherveil(power);
      root.add(visual);
      root.userData.fantasyVisual = visual;
      root.userData.fantasySignature = signature;
      root.userData.baseFantasyWrapped = true;
      root.userData.baseFantasyUpdate = baseUpdate;
      root.userData.baseFantasyQuality = baseQuality;
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
    if (!this.state || !this.fantasyDistrictRoot) return;
    this.syncFantasyDistrictFrames();
    this.syncFantasyEntityDressings();
  }

  syncFantasyDistrictFrames() {
    const live = new Set();
    for (const power of (this.stylePowerPlan ?? []).slice(0, FANTASY_ROOT_LIMIT)) {
      if (power.themeId !== "fantasy") continue;
      live.add(power.districtId);
      const signature = `${power.districtId}:${power.themeId}:${power.stage}:${power.score}:${power.center.x.toFixed(2)}:${power.center.z.toFixed(2)}`;
      let root = this.fantasyDistrictRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) {
        this.fantasyDistrictRoot.remove(root);
        disposeTree(root);
      }
      root = createFantasyDistrictFrame(power);
      root.userData.signature = signature;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.34 });
      root.userData.setQuality?.(this.qualityProfile);
      this.fantasyDistrictRoot.add(root);
      this.fantasyDistrictRoots.set(power.districtId, root);
    }
    for (const [districtId, root] of this.fantasyDistrictRoots) {
      if (live.has(districtId)) continue;
      this.fantasyDistrictRoot.remove(root);
      disposeTree(root);
      this.fantasyDistrictRoots.delete(districtId);
    }
  }

  syncFantasyEntityDressings() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      const fit = themeFitForEntity(this.state, entity);
      const shouldDress = identity.themeId === "fantasy"
        && !["contrast", "neutral"].includes(fit.status);
      const signature = shouldDress
        ? `${identity.districtId}:${fit.status}:${fit.matchedTags.join("|")}:${entity.catalogId}`
        : "off";

      let root = model.userData.fantasyStyleDressingRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "fantasy-style-dressing-root";
        model.add(root);
        model.userData.fantasyStyleDressingRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (shouldDress) root.add(createFantasyEntityDressing(fit, entity));
      root.userData.signature = signature;
      root.visible = shouldDress;
    }
  }

  setQuality(profile) {
    super.setQuality(profile);
    for (const root of this.fantasyDistrictRoots?.values?.() ?? []) root.userData.setQuality?.(this.qualityProfile);
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.fantasyDistrictRoots.values()) root.userData.updateVisual?.(time, this.state);
    for (const model of this.entityModels.values()) {
      const root = model.userData.fantasyStyleDressingRoot;
      for (const dressing of root?.children ?? []) dressing.userData.updateVisual?.(time, this.state);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    let dressedElements = 0;
    let actorCountTotal = 0;
    for (const root of this.fantasyDistrictRoots.values()) actorCountTotal += root.userData.actorCount ?? 0;
    for (const model of this.entityModels.values()) {
      if (model.userData.fantasyStyleDressingRoot?.visible) dressedElements += 1;
    }
    for (const root of this.stylePowerRoots.values()) {
      if (root.userData.power?.themeId === "fantasy") actorCountTotal += root.userData.actorCount ?? 0;
    }
    return Object.freeze({
      ...base,
      fantasyStyle: Object.freeze({
        presentationOnly: true,
        districtBudget: FANTASY_ROOT_LIMIT,
        styledDistricts: this.fantasyDistrictRoots.size,
        dressedElements,
        actorCount: actorCountTotal,
        powerId: "aetherveil"
      })
    });
  }
}
