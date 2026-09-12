import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as FestivalTechMotionGuardWorldRenderer } from "./festivalTechMotionGuardWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { districtThemeForEntity } from "../core/districts.js";
import { themeFitForEntity } from "../core/themeFit.js";

const GILDED_ROOT_LIMIT = 4;
const GOLD = 0xd9aa35;
const BRIGHT_GOLD = 0xf2d16b;
const MARBLE_WHITE = 0xe9e6dc;
const MARBLE_BLACK = 0x28272b;
const VELVET = 0x8c2638;
const JEWEL = 0x6ec6cf;
const RUBY = 0xb43b55;

function luxuryMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.48,
    metalness: options.metalness ?? 0.12,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function glowMaterial(color, opacity = 0.9) {
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
  return status === "signature" ? 1.14
    : status === "strong" ? 1.08
      : status === "compatible" ? 1.02
        : status === "contrast" ? 0.94 : 0.98;
}

function nightBoost(state) {
  const minute = ((Number(state?.clock?.minute) || 0) % 1440 + 1440) % 1440;
  return minute >= 1080 || minute < 360 ? 1.28 : minute >= 960 ? 1.12 : 1;
}

function stagePulse(power) {
  return power.stage === "unleashed" ? 1
    : power.stage === "charged" ? 0.82
      : power.stage === "awakening" ? 0.64 : 0.48;
}

function materials() {
  return Object.freeze({
    gold: luxuryMaterial(GOLD, { roughness: 0.3, metalness: 0.42, emissive: GOLD, emissiveIntensity: 0.04 }),
    brightGold: glowMaterial(BRIGHT_GOLD, 0.92),
    white: luxuryMaterial(MARBLE_WHITE, { roughness: 0.72, metalness: 0.02 }),
    black: luxuryMaterial(MARBLE_BLACK, { roughness: 0.62, metalness: 0.08 }),
    velvet: luxuryMaterial(VELVET, { roughness: 0.84 }),
    jewel: glowMaterial(JEWEL, 0.88),
    ruby: glowMaterial(RUBY, 0.88)
  });
}

function createRideDressing(root, m) {
  addMesh(root, new THREE.BoxGeometry(1.08, 0.16, 0.62), m.black, 0, 0.13, 0);
  addMesh(root, new THREE.CylinderGeometry(0.08, 0.1, 1.05, 8), m.white, -0.46, 0.65, 0);
  addMesh(root, new THREE.CylinderGeometry(0.08, 0.1, 1.05, 8), m.white, 0.46, 0.65, 0);
  addMesh(root, new THREE.BoxGeometry(1.08, 0.14, 0.18), m.gold, 0, 1.15, 0);
  const crown = addMesh(root, new THREE.OctahedronGeometry(0.2, 0), m.brightGold, 0, 1.43, 0);
  const bulbs = [];
  for (let index = 0; index < 5; index += 1) {
    bulbs.push(addMesh(root, new THREE.SphereGeometry(0.055, 6, 5), index % 2 ? m.jewel : m.ruby,
      (index - 2) * 0.2, 1.18, 0.12));
  }
  root.userData.animateType = (time, boost) => {
    crown.rotation.y = time * 0.7;
    crown.position.y = 1.43 + Math.sin(time * 2.2) * 0.05 * boost;
    bulbs.forEach((bulb, index) => bulb.scale.setScalar(0.84 + Math.sin(time * 3 + index) * 0.16 * boost));
  };
}

function createServiceDressing(root, m) {
  addMesh(root, new THREE.BoxGeometry(1.1, 0.48, 0.7), m.white, 0, 0.34, 0);
  addMesh(root, new THREE.BoxGeometry(1.22, 0.12, 0.82), m.gold, 0, 0.68, 0);
  addMesh(root, new THREE.BoxGeometry(0.76, 0.18, 0.08), m.black, 0, 0.86, 0.34);
  const sign = addMesh(root, new THREE.OctahedronGeometry(0.13, 0), m.jewel, 0, 0.87, 0.4);
  const ropes = [];
  for (const x of [-0.5, 0.5]) {
    addMesh(root, new THREE.CylinderGeometry(0.04, 0.05, 0.56, 6), m.gold, x, 0.36, 0.48);
    ropes.push(addMesh(root, new THREE.SphereGeometry(0.06, 6, 5), m.ruby, x, 0.66, 0.48));
  }
  const chandelier = addMesh(root, new THREE.OctahedronGeometry(0.16, 0), m.brightGold, 0, 1.2, 0);
  root.userData.animateType = (time, boost) => {
    sign.scale.setScalar(0.88 + Math.sin(time * 2.8) * 0.12 * boost);
    chandelier.rotation.y = time * 0.52;
    chandelier.position.y = 1.2 + Math.sin(time * 1.7) * 0.04 * boost;
    ropes.forEach((rope, index) => rope.scale.setScalar(0.92 + Math.sin(time * 2.2 + index) * 0.08));
  };
}

function createStoreDressing(root, m) {
  addMesh(root, new THREE.BoxGeometry(1.16, 0.24, 0.72), m.black, 0, 0.18, 0);
  addMesh(root, new THREE.BoxGeometry(1.0, 0.54, 0.6), m.white, 0, 0.5, 0);
  addMesh(root, new THREE.BoxGeometry(1.2, 0.14, 0.76), m.gold, 0, 0.82, 0);
  const gems = [];
  for (let index = 0; index < 5; index += 1) {
    gems.push(addMesh(root, new THREE.OctahedronGeometry(0.08, 0), index % 2 ? m.ruby : m.jewel,
      (index - 2) * 0.2, 0.92, 0.36));
  }
  const crown = addMesh(root, new THREE.ConeGeometry(0.22, 0.28, 5), m.brightGold, 0, 1.12, 0);
  root.userData.animateType = (time, boost) => {
    crown.rotation.y = time * 0.6;
    gems.forEach((gem, index) => gem.scale.setScalar(0.84 + Math.sin(time * 3.2 + index * 0.7) * 0.16 * boost));
  };
}

function createSceneryDressing(root, m) {
  addMesh(root, new THREE.CylinderGeometry(0.5, 0.58, 0.18, 10), m.black, 0, 0.14, 0);
  addMesh(root, new THREE.CylinderGeometry(0.38, 0.44, 0.14, 10), m.white, 0, 0.3, 0);
  const bowl = addMesh(root, new THREE.TorusGeometry(0.32, 0.055, 6, 16), m.gold, 0, 0.52, 0);
  bowl.rotation.x = Math.PI / 2;
  const gem = addMesh(root, new THREE.OctahedronGeometry(0.17, 0), m.jewel, 0, 0.82, 0);
  root.userData.animateType = (time, boost) => {
    bowl.rotation.z = time * 0.2;
    gem.rotation.y = time * 0.7;
    gem.position.y = 0.82 + Math.sin(time * 1.8) * 0.07 * boost;
  };
}

function createGildedEntityDressing(fit, entity) {
  const root = new THREE.Group();
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.name = `gilded-entity-dressing-${definition.kind}-${fit.status}`;
  root.position.set(-Math.min(2.2, width * 0.46), 0.12, Math.min(1.72, depth * 0.34));
  root.scale.setScalar(fitScale(fit.status) * Math.min(1.3, 0.84 + Math.max(width, depth) * 0.055));
  const m = materials();

  if (definition.category === "Stores") createStoreDressing(root, m);
  else if (definition.kind === "service" || definition.category === "Services") createServiceDressing(root, m);
  else if (definition.kind === "ride") createRideDressing(root, m);
  else createSceneryDressing(root, m);

  root.userData.updateVisual = (time, state) => root.userData.animateType?.(time, nightBoost(state));
  root.userData.fitStatus = fit.status;
  markEntityPickTarget(root, entity.id);
  return root;
}

function createGildedDistrictFrame(power) {
  const root = new THREE.Group();
  root.name = `gilded-district-frame-${power.districtId}`;
  const m = materials();
  const outer = addMesh(root, new THREE.TorusGeometry(1.7, 0.11, 7, 20), m.black, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const goldRing = addMesh(root, new THREE.TorusGeometry(1.46, 0.07, 6, 20), m.gold, 0, 0.18, 0);
  goldRing.rotation.x = Math.PI / 2;
  const carpet = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2;
    const strip = addMesh(root, new THREE.BoxGeometry(0.5, 0.055, 1.05), m.velvet,
      Math.cos(angle) * 1.05, 0.11, Math.sin(angle) * 1.05);
    strip.rotation.y = -angle;
    carpet.push(strip);
  }
  const columns = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * 1.16;
    const z = Math.sin(angle) * 1.16;
    const column = addMesh(root, new THREE.CylinderGeometry(0.11, 0.14, 1.05, 8), m.white, x, 0.65, z);
    const capital = addMesh(root, new THREE.CylinderGeometry(0.17, 0.17, 0.1, 8), m.gold, x, 1.18, z);
    const jewel = addMesh(root, new THREE.OctahedronGeometry(0.13, 0), index % 2 ? m.jewel : m.ruby, x, 1.38, z);
    columns.push({ column, capital, jewel });
  }
  const fountain = addMesh(root, new THREE.CylinderGeometry(0.48, 0.56, 0.12, 12), m.white, 0, 0.15, 0);
  const fountainRing = addMesh(root, new THREE.TorusGeometry(0.38, 0.045, 6, 16), m.gold, 0, 0.27, 0);
  fountainRing.rotation.x = Math.PI / 2;
  root.userData.setQuality = () => {};
  root.userData.updateVisual = (time, state) => {
    const boost = nightBoost(state);
    goldRing.rotation.z = time * 0.08;
    fountain.rotation.y = time * 0.03;
    fountainRing.rotation.z = -time * 0.16;
    columns.forEach(({ column, capital, jewel }, index) => {
      column.rotation.y = Math.sin(time * 0.25 + index) * 0.015;
      capital.rotation.y = time * 0.12 * (index % 2 ? -1 : 1);
      jewel.scale.setScalar(0.86 + Math.sin(time * 2.2 + index) * 0.14 * boost);
    });
    carpet.forEach((strip, index) => { strip.scale.z = 0.96 + Math.sin(time * 0.7 + index) * 0.04; });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

function createGrandRadiance(power) {
  const root = new THREE.Group();
  root.name = "gilded-grand-radiance";
  const m = materials();
  const dais = addMesh(root, new THREE.CylinderGeometry(1.0, 1.12, 0.13, 12), m.black, 0, 0.1, 0);
  const fountainBase = addMesh(root, new THREE.CylinderGeometry(0.68, 0.78, 0.18, 12), m.white, 0, 0.25, 0);
  const bowls = [];
  for (let index = 0; index < 3; index += 1) {
    const bowl = addMesh(root, new THREE.TorusGeometry(0.5 - index * 0.12, 0.055, 6, 16), m.gold,
      0, 0.46 + index * 0.28, 0);
    bowl.rotation.x = Math.PI / 2;
    bowls.push(bowl);
  }
  const crownRing = addMesh(root, new THREE.TorusGeometry(0.72, 0.065, 6, 18), m.brightGold, 0, 1.35, 0);
  crownRing.rotation.x = Math.PI / 2;
  const crown = addMesh(root, new THREE.OctahedronGeometry(0.28, 0), m.brightGold, 0, 1.62, 0);

  const gems = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const gem = addMesh(root, new THREE.OctahedronGeometry(0.11 + (index % 2) * 0.02, 0), index % 2 ? m.ruby : m.jewel,
      Math.cos(angle) * 1.18, 0.82, Math.sin(angle) * 1.18);
    gem.userData.phase = angle;
    gems.push(gem);
  }

  const sparkles = [];
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2;
    const sparkle = addMesh(root, new THREE.SphereGeometry(0.05, 5, 4), m.brightGold,
      Math.cos(angle) * 1.45, 0.5 + (index % 3) * 0.28, Math.sin(angle) * 1.45);
    sparkle.userData.phase = angle;
    sparkles.push(sparkle);
  }

  const chandeliers = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const drop = addMesh(root, new THREE.OctahedronGeometry(0.15, 0), index % 2 ? m.jewel : m.ruby,
      Math.cos(angle) * 0.82, 1.18, Math.sin(angle) * 0.82);
    chandeliers.push(drop);
  }

  root.userData.setQuality = (profile) => {
    sparkles.forEach((sparkle, index) => { sparkle.visible = profile !== "tiny" || index % 2 === 0; });
    gems.forEach((gem, index) => { gem.visible = profile !== "tiny" || index < 6; });
  };
  root.userData.updateVisual = (time, state) => {
    const boost = nightBoost(state) * stagePulse(power);
    dais.rotation.y = time * 0.02;
    fountainBase.rotation.y = -time * 0.03;
    bowls.forEach((bowl, index) => {
      bowl.rotation.z = time * (0.12 + index * 0.05) * (index % 2 ? -1 : 1);
      bowl.scale.setScalar(0.96 + Math.sin(time * 1.2 + index) * 0.04 * boost);
    });
    crownRing.rotation.z = time * 0.3 * boost;
    crown.rotation.y = time * 0.62;
    crown.position.y = 1.62 + Math.sin(time * 1.8) * 0.08 * boost;
    gems.forEach((gem, index) => {
      const angle = gem.userData.phase + time * 0.18 * boost;
      gem.position.x = Math.cos(angle) * 1.18;
      gem.position.z = Math.sin(angle) * 1.18;
      gem.position.y = 0.78 + Math.sin(time * 2 + index) * 0.16 * boost;
      gem.rotation.y = time * (0.42 + index * 0.02);
    });
    sparkles.forEach((sparkle, index) => {
      const angle = sparkle.userData.phase + time * 0.08;
      sparkle.position.x = Math.cos(angle) * 1.45;
      sparkle.position.z = Math.sin(angle) * 1.45;
      sparkle.position.y = 0.45 + ((time * 0.14 + index / sparkles.length) % 1) * 1.18;
      sparkle.scale.setScalar(0.76 + Math.sin(time * 3 + index) * 0.18 * boost);
    });
    chandeliers.forEach((drop, index) => {
      drop.position.y = 1.18 + Math.sin(time * 1.4 + index) * 0.1 * boost;
      drop.rotation.y = time * (0.35 + index * 0.03);
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

/**
 * Final themed-land layer for unapologetic wealth/show-off presentation.
 * Unlike the softer fit dressings used by most themes, every entity inside a
 * Gilded district is dressed. Theme fit only contributes to Grand Radiance charge.
 * Simulation/economy/service authority remains completely outside this renderer.
 */
export class WorldRenderer extends FestivalTechMotionGuardWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.gildedDistrictRoot = new THREE.Group();
    this.gildedDistrictRoot.name = "bounded-render-only-gilded-wealth-style";
    this.gildedDistrictRoots = new Map();
    this.globe.root.add(this.gildedDistrictRoot);
  }

  syncStyleSuperpowers() {
    super.syncStyleSuperpowers();
    for (const power of this.stylePowerPlan ?? []) {
      if (power.themeId !== "gilded" || !power.active) continue;
      const root = this.stylePowerRoots.get(power.districtId);
      if (!root) continue;
      const signature = `${power.id}:${power.stage}:${power.score}:${power.anchors.map((item) => item.entityId).join("|")}`;
      if (root.userData.gildedSignature === signature) continue;

      const previous = root.userData.gildedVisual;
      if (previous) {
        root.remove(previous);
        disposeTree(previous);
      }
      const baseUpdate = root.userData.baseGildedWrapped ? root.userData.baseUpdate : root.userData.updateVisual;
      const baseQuality = root.userData.baseGildedWrapped ? root.userData.baseQuality : root.userData.setQuality;
      const visual = createGrandRadiance(power);
      root.add(visual);
      root.userData.gildedVisual = visual;
      root.userData.gildedSignature = signature;
      root.userData.baseGildedWrapped = true;
      root.userData.baseUpdate = baseUpdate;
      root.userData.baseQuality = baseQuality;
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
    if (!this.state || !this.gildedDistrictRoot) return;
    this.syncGildedDistrictFrames();
    this.syncGildedEntityDressings();
  }

  syncGildedDistrictFrames() {
    const live = new Set();
    for (const power of (this.stylePowerPlan ?? []).slice(0, GILDED_ROOT_LIMIT)) {
      if (power.themeId !== "gilded") continue;
      live.add(power.districtId);
      const signature = `${power.districtId}:${power.stage}:${power.score}:${power.center.x.toFixed(2)}:${power.center.z.toFixed(2)}`;
      let root = this.gildedDistrictRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) {
        this.gildedDistrictRoot.remove(root);
        disposeTree(root);
      }
      root = createGildedDistrictFrame(power);
      root.userData.signature = signature;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.34 });
      root.userData.setQuality?.(this.qualityProfile);
      this.gildedDistrictRoot.add(root);
      this.gildedDistrictRoots.set(power.districtId, root);
    }
    for (const [districtId, root] of this.gildedDistrictRoots) {
      if (live.has(districtId)) continue;
      this.gildedDistrictRoot.remove(root);
      disposeTree(root);
      this.gildedDistrictRoots.delete(districtId);
    }
  }

  syncGildedEntityDressings() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      const fit = themeFitForEntity(this.state, entity);
      const shouldDress = identity.themeId === "gilded";
      const signature = shouldDress
        ? `${identity.districtId}:${fit.status}:${entity.catalogId}`
        : "off";

      let root = model.userData.gildedStyleDressingRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "gilded-style-dressing-root";
        model.add(root);
        model.userData.gildedStyleDressingRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (shouldDress) root.add(createGildedEntityDressing(fit, entity));
      root.userData.signature = signature;
      root.visible = shouldDress;
    }
  }

  setQuality(profile) {
    super.setQuality(profile);
    for (const root of this.gildedDistrictRoots?.values?.() ?? []) root.userData.setQuality?.(this.qualityProfile);
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.gildedDistrictRoots.values()) root.userData.updateVisual?.(time, this.state);
    for (const model of this.entityModels.values()) {
      const root = model.userData.gildedStyleDressingRoot;
      for (const dressing of root?.children ?? []) dressing.userData.updateVisual?.(time, this.state);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    let dressedElements = 0;
    let actorCountTotal = 0;
    for (const root of this.gildedDistrictRoots.values()) actorCountTotal += root.userData.actorCount ?? 0;
    for (const model of this.entityModels.values()) {
      if (model.userData.gildedStyleDressingRoot?.visible) dressedElements += 1;
    }
    for (const root of this.stylePowerRoots.values()) {
      if (root.userData.power?.themeId === "gilded") actorCountTotal += root.userData.actorCount ?? 0;
    }
    return Object.freeze({
      ...base,
      gildedWealth: Object.freeze({
        presentationOnly: true,
        dressesEveryEntity: true,
        districtBudget: GILDED_ROOT_LIMIT,
        styledDistricts: this.gildedDistrictRoots.size,
        dressedElements,
        actorCount: actorCountTotal,
        powerId: "grand-radiance"
      })
    });
  }
}
