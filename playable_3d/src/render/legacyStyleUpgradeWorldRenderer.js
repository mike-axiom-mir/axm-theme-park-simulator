import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as GildedStyleWorldRenderer } from "./gildedStyleWorldRenderer.js";
import { districtThemeForEntity } from "../core/districts.js";
import { legacyStyleCapabilities } from "../core/legacyCareer.js";

const LEGACY_DISTRICT_BUDGET = 4;
const LEGACY_ENTITY_ACCENT_BUDGET = 48;
const SEASONAL = new Set(["halloween", "christmas", "newyear"]);

const PALETTE = Object.freeze({
  garden: 0x80c77a, adventure: 0xd7924e, storybook: 0xefb55e, cartoon: 0xf06e9f,
  fantasy: 0x8d75d8, western: 0xb47748, medieval: 0xb8a074, halloween: 0xb267d4,
  christmas: 0x5cae78, newyear: 0xe6c95c, future: 0x67c9da, robotica: 0xd58a48,
  software: 0x6dc8e8, waterfront: 0x5cb6c7, gilded: 0xe1b94c, neutral: 0x9ba4aa
});

const colorFor = (themeId) => PALETTE[themeId] ?? PALETTE.neutral;

function glow(color, opacity = 0.84) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false });
}

function solid(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.58, metalness: 0.12 });
}

function add(root, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  root.add(mesh);
  return mesh;
}

function disposeTree(root) {
  root.traverse((item) => {
    item.geometry?.dispose?.();
    if (Array.isArray(item.material)) item.material.forEach((material) => material?.dispose?.());
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

function meshCount(root) {
  let count = 0;
  root.traverse((item) => { if (item.isMesh) count += 1; });
  return count;
}

function createEntityAccent(themeId, entityId) {
  const color = colorFor(themeId);
  const root = new THREE.Group();
  root.name = "legacy-style-entity-accent";
  const ring = add(root, new THREE.TorusGeometry(0.28, 0.04, 5, 12), glow(color, 0.72), 0, 0.84, 0);
  ring.rotation.x = Math.PI / 2;
  const crest = add(root, new THREE.OctahedronGeometry(0.12, 0), glow(color, 0.92), 0, 1.03, 0);
  root.userData.entityId = entityId;
  root.traverse((item) => { item.userData.entityId = entityId; });
  root.userData.updateVisual = (time) => {
    ring.rotation.z = time * 0.28;
    crest.rotation.y = time * 0.55;
    crest.position.y = 1.03 + Math.sin(time * 1.9) * 0.045;
  };
  return root;
}

function createDistrictLegacyVisual(power, capabilities) {
  const color = colorFor(power.themeId);
  const root = new THREE.Group();
  root.name = `legacy-style-upgrades-${power.districtId}`;
  const optional = [];

  if (capabilities.prestigeFrontages) {
    const frontage = new THREE.Group();
    frontage.name = "legacy-prestige-frontage";
    add(frontage, new THREE.BoxGeometry(1.35, 0.12, 0.2), solid(color), 0, 1.12, 0);
    add(frontage, new THREE.CylinderGeometry(0.08, 0.11, 1.05, 6), solid(color), -0.56, 0.6, 0);
    add(frontage, new THREE.CylinderGeometry(0.08, 0.11, 1.05, 6), solid(color), 0.56, 0.6, 0);
    const crest = add(frontage, new THREE.OctahedronGeometry(0.17, 0), glow(color), 0, 1.38, 0);
    frontage.userData.updateVisual = (time) => { crest.rotation.y = time * 0.42; };
    root.add(frontage);
  }

  if (capabilities.districtFinales && power.stage === "unleashed") {
    const finale = new THREE.Group();
    finale.name = "legacy-district-finale";
    const halo = add(finale, new THREE.TorusGeometry(1.12, 0.065, 6, 18), glow(color, 0.68), 0, 1.55, 0);
    halo.rotation.x = Math.PI / 2;
    const rays = [];
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const ray = add(finale, new THREE.BoxGeometry(0.055, 0.48, 0.055), glow(color, 0.74),
        Math.cos(angle) * 1.1, 1.52, Math.sin(angle) * 1.1);
      rays.push(ray);
      optional.push(ray);
    }
    finale.userData.updateVisual = (time) => {
      halo.rotation.z = time * 0.22;
      rays.forEach((ray, index) => { ray.scale.y = 0.75 + Math.sin(time * 2 + index) * 0.2; });
    };
    root.add(finale);
  }

  if (capabilities.seasonalPageantry && SEASONAL.has(power.themeId)) {
    const seasonal = new THREE.Group();
    seasonal.name = "legacy-seasonal-pageantry";
    const orbiters = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = index / 8 * Math.PI * 2;
      const orb = add(seasonal, new THREE.OctahedronGeometry(0.08, 0), glow(color, 0.82),
        Math.cos(angle) * 1.36, 0.75 + (index % 2) * 0.22, Math.sin(angle) * 1.36);
      orb.userData.phase = angle;
      orbiters.push(orb);
      optional.push(orb);
    }
    seasonal.userData.updateVisual = (time) => {
      orbiters.forEach((orb, index) => {
        const angle = orb.userData.phase + time * 0.18;
        orb.position.x = Math.cos(angle) * 1.36;
        orb.position.z = Math.sin(angle) * 1.36;
        orb.position.y = 0.72 + (index % 2) * 0.22 + Math.sin(time * 1.7 + index) * 0.08;
      });
    };
    root.add(seasonal);
  }

  if (capabilities.landmarkMasterworks) {
    const landmark = new THREE.Group();
    landmark.name = "legacy-landmark-masterwork";
    add(landmark, new THREE.CylinderGeometry(0.42, 0.55, 0.16, 10), solid(0x34363c), 0, 0.12, 0);
    add(landmark, new THREE.CylinderGeometry(0.13, 0.2, 1.4, 7), solid(color), 0, 0.86, 0);
    const crown = add(landmark, new THREE.OctahedronGeometry(0.23, 0), glow(color, 0.9), 0, 1.68, 0);
    const ring = add(landmark, new THREE.TorusGeometry(0.42, 0.045, 5, 14), glow(color, 0.66), 0, 1.3, 0);
    ring.rotation.x = Math.PI / 2;
    landmark.userData.updateVisual = (time) => {
      crown.rotation.y = time * 0.38;
      crown.position.y = 1.68 + Math.sin(time * 1.4) * 0.06;
      ring.rotation.z = -time * 0.18;
    };
    root.add(landmark);
  }

  root.userData.setQuality = (profile) => {
    optional.forEach((item, index) => { item.visible = profile !== "tiny" || index % 2 === 0; });
  };
  root.userData.updateVisual = (time) => {
    for (const child of root.children) child.userData.updateVisual?.(time);
  };
  root.userData.actorCount = meshCount(root);
  return root;
}

/**
 * Persistent Legacy-funded style presentation. This layer can only add bounded
 * visuals. Theme selection and Style Superpower charge remain free/core; ride,
 * service and attraction functionality remains owned by Park Research/Upgrades.
 */
export class WorldRenderer extends GildedStyleWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.legacyStyleRoot = new THREE.Group();
    this.legacyStyleRoot.name = "bounded-render-only-legacy-style-upgrades";
    this.legacyDistrictRoots = new Map();
    this.globe.root.add(this.legacyStyleRoot);
  }

  syncWorld() {
    super.syncWorld();
    if (!this.state || !this.legacyStyleRoot) return;
    this.syncLegacyEntityAccents();
    this.syncLegacyDistrictVisuals();
  }

  syncLegacyEntityAccents() {
    const capabilities = legacyStyleCapabilities(this.state);
    const eligible = (this.state.world?.entities ?? [])
      .filter((entity) => districtThemeForEntity(this.state, entity).themeId !== "neutral")
      .slice(0, LEGACY_ENTITY_ACCENT_BUDGET);
    const live = new Set(eligible.map((entity) => entity.id));

    for (const entity of eligible) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      let root = model.userData.legacyStyleAccentRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "legacy-style-entity-accent-root";
        model.add(root);
        model.userData.legacyStyleAccentRoot = root;
      }
      const signature = capabilities.signatureDressing ? `${identity.themeId}:${identity.districtId}` : "off";
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (capabilities.signatureDressing) root.add(createEntityAccent(identity.themeId, entity.id));
      root.userData.signature = signature;
      root.visible = capabilities.signatureDressing;
    }

    for (const [entityId, model] of this.entityModels) {
      if (live.has(entityId)) continue;
      const root = model.userData.legacyStyleAccentRoot;
      if (root) root.visible = false;
    }
  }

  syncLegacyDistrictVisuals() {
    const capabilities = legacyStyleCapabilities(this.state);
    const activeAny = capabilities.prestigeFrontages || capabilities.districtFinales
      || capabilities.seasonalPageantry || capabilities.landmarkMasterworks;
    const live = new Set();

    for (const power of (this.stylePowerPlan ?? []).slice(0, LEGACY_DISTRICT_BUDGET)) {
      if (!activeAny || power.themeId === "neutral") continue;
      live.add(power.districtId);
      const signature = `${power.themeId}:${power.stage}:${power.score}:${Number(capabilities.prestigeFrontages)}:${Number(capabilities.districtFinales)}:${Number(capabilities.seasonalPageantry)}:${Number(capabilities.landmarkMasterworks)}`;
      let root = this.legacyDistrictRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) {
        this.legacyStyleRoot.remove(root);
        disposeTree(root);
      }
      root = createDistrictLegacyVisual(power, capabilities);
      root.userData.signature = signature;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.48 });
      root.userData.setQuality?.(this.qualityProfile);
      this.legacyStyleRoot.add(root);
      this.legacyDistrictRoots.set(power.districtId, root);
    }

    for (const [districtId, root] of this.legacyDistrictRoots) {
      if (live.has(districtId)) continue;
      this.legacyStyleRoot.remove(root);
      disposeTree(root);
      this.legacyDistrictRoots.delete(districtId);
    }
  }

  setQuality(profile) {
    super.setQuality(profile);
    for (const root of this.legacyDistrictRoots?.values?.() ?? []) root.userData.setQuality?.(this.qualityProfile);
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.legacyDistrictRoots.values()) root.userData.updateVisual?.(time);
    for (const model of this.entityModels.values()) {
      for (const accent of model.userData.legacyStyleAccentRoot?.children ?? []) accent.userData.updateVisual?.(time);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    const capabilities = this.state ? legacyStyleCapabilities(this.state) : {};
    let entityAccents = 0;
    let actorCount = 0;
    for (const model of this.entityModels.values()) {
      if (model.userData.legacyStyleAccentRoot?.visible) entityAccents += 1;
    }
    for (const root of this.legacyDistrictRoots.values()) actorCount += root.userData.actorCount ?? 0;
    return Object.freeze({
      ...base,
      legacyStyle: Object.freeze({
        presentationOnly: true,
        districtBudget: LEGACY_DISTRICT_BUDGET,
        entityAccentBudget: LEGACY_ENTITY_ACCENT_BUDGET,
        entityAccents,
        styledDistricts: this.legacyDistrictRoots.size,
        actorCount,
        capabilities
      })
    });
  }
}
