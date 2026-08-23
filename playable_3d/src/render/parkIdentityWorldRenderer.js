import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as SpecialContentWorldRenderer } from "./specialContentWorldRenderer.js";
import { GRID_SIZE, catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { DISTRICT_THEMES, applyDistrictAction, districtThemeForEntity } from "../core/districts.js";
import { stateHash } from "../core/random.js";

const MODULE_COLORS = Object.freeze({
  "quick-load-gate": 0xf0c766,
  "condition-sensors": 0x65bed1,
  "comfort-package": 0xf3b4c8,
  "scene-sequencer": 0xb8a7ea,
  "panorama-audio": 0x75d5ad,
  "twin-counter": 0xf0a85f,
  "smart-meter": 0x65bed1,
  "hospitality-counter": 0xf4df91,
  "storefront-story": 0xe987a8,
  "collector-display": 0xb8a7ea,
  "comfort-corner": 0x75d5ad,
  "accessibility-station": 0x65bed1
});

const DISTRICT_COLORS = Object.freeze({
  garden: 0x75d5ad,
  adventure: 0xf0a85f,
  storybook: 0xe987a8,
  future: 0x65bed1
});

const PARK_OFFSETS = Object.freeze({
  "wayfinding-boards": [-4, 2],
  "staff-radio": [4, 2],
  "energy-loop": [-7, 5],
  "rain-shelters": [0, 5],
  "welcome-square": [0, 2],
  "night-signature": [7, 5],
  "recycling-network": [4, 6]
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function standardMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.08, ...options });
}

function signalMaterial(color, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
}

function mesh(group, geometry, material, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  group.add(item);
  return item;
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

function markEntityPickTarget(root, entityId) {
  root.traverse((item) => { item.userData.entityId = entityId; });
}

function createEntityModuleVisual(upgradeId, slotIndex, entity) {
  const root = new THREE.Group();
  root.name = `installed-upgrade-${upgradeId}`;
  const color = MODULE_COLORS[upgradeId] ?? 0xf0c766;
  const primary = standardMaterial(color);
  const dark = standardMaterial(0x40505a, { roughness: 0.9 });
  const signal = signalMaterial(color);
  const slotX = slotIndex === 0 ? -0.42 : 0.42;
  root.position.set(slotX, 0.22, -0.34);

  let animated = null;
  if (upgradeId === "quick-load-gate") {
    mesh(root, new THREE.BoxGeometry(0.11, 0.72, 0.11), dark, -0.26, 0.36, 0);
    mesh(root, new THREE.BoxGeometry(0.11, 0.72, 0.11), dark, 0.26, 0.36, 0);
    const gate = mesh(root, new THREE.BoxGeometry(0.55, 0.08, 0.08), primary, 0, 0.45, 0);
    animated = (time) => { gate.rotation.z = -0.2 + Math.sin(time * 1.8 + slotIndex) * 0.18; };
  } else if (upgradeId === "condition-sensors") {
    mesh(root, new THREE.CylinderGeometry(0.055, 0.07, 0.62, 6), dark, 0, 0.31, 0);
    const node = mesh(root, new THREE.OctahedronGeometry(0.13, 0), signal, 0, 0.68, 0);
    animated = (time) => { node.scale.setScalar(0.82 + Math.sin(time * 4.2) * 0.12); };
  } else if (upgradeId === "comfort-package") {
    mesh(root, new THREE.BoxGeometry(0.7, 0.14, 0.28), primary, 0, 0.2, 0);
    mesh(root, new THREE.BoxGeometry(0.68, 0.32, 0.1), primary, 0, 0.39, 0.11);
  } else if (upgradeId === "scene-sequencer") {
    const lamps = [-0.22, 0, 0.22].map((x) => mesh(root, new THREE.BoxGeometry(0.13, 0.13, 0.13), signal, x, 0.48, 0));
    mesh(root, new THREE.BoxGeometry(0.72, 0.08, 0.12), dark, 0, 0.33, 0);
    animated = (time) => lamps.forEach((lamp, index) => { lamp.visible = Math.floor(time * 3 + index) % 3 !== 0; });
  } else if (upgradeId === "panorama-audio") {
    const left = mesh(root, new THREE.ConeGeometry(0.17, 0.34, 7), primary, -0.2, 0.42, 0);
    const right = mesh(root, new THREE.ConeGeometry(0.17, 0.34, 7), primary, 0.2, 0.42, 0);
    left.rotation.z = Math.PI / 2;
    right.rotation.z = -Math.PI / 2;
    animated = (time) => { root.rotation.y = Math.sin(time * 0.75) * 0.08; };
  } else if (upgradeId === "twin-counter") {
    mesh(root, new THREE.BoxGeometry(0.82, 0.18, 0.32), dark, 0, 0.18, 0);
    mesh(root, new THREE.BoxGeometry(0.34, 0.1, 0.18), primary, -0.21, 0.33, -0.04);
    mesh(root, new THREE.BoxGeometry(0.34, 0.1, 0.18), primary, 0.21, 0.33, -0.04);
  } else if (upgradeId === "smart-meter") {
    mesh(root, new THREE.BoxGeometry(0.36, 0.5, 0.16), dark, 0, 0.3, 0);
    const dial = mesh(root, new THREE.TorusGeometry(0.095, 0.025, 5, 12), signal, 0, 0.38, -0.09);
    dial.rotation.x = Math.PI / 2;
    animated = (time) => { dial.rotation.z = time * 1.4; };
  } else if (upgradeId === "hospitality-counter") {
    mesh(root, new THREE.CylinderGeometry(0.07, 0.08, 0.74, 6), dark, 0, 0.37, 0);
    const lantern = mesh(root, new THREE.OctahedronGeometry(0.16, 0), signal, 0, 0.82, 0);
    animated = (time) => { lantern.position.y = 0.82 + Math.sin(time * 2.2) * 0.04; };
  } else if (upgradeId === "storefront-story") {
    mesh(root, new THREE.BoxGeometry(0.74, 0.62, 0.08), dark, 0, 0.42, 0);
    const panel = mesh(root, new THREE.BoxGeometry(0.56, 0.4, 0.04), primary, 0, 0.42, -0.07);
    animated = (time) => { panel.rotation.y = Math.sin(time * 0.8) * 0.04; };
  } else if (upgradeId === "collector-display") {
    mesh(root, new THREE.CylinderGeometry(0.2, 0.28, 0.42, 7), dark, 0, 0.21, 0);
    const gem = mesh(root, new THREE.OctahedronGeometry(0.22, 0), signal, 0, 0.58, 0);
    animated = (time) => { gem.rotation.y = time * 0.7; gem.position.y = 0.58 + Math.sin(time * 1.8) * 0.04; };
  } else if (upgradeId === "comfort-corner") {
    mesh(root, new THREE.BoxGeometry(0.76, 0.12, 0.3), primary, 0, 0.2, 0);
    mesh(root, new THREE.CylinderGeometry(0.12, 0.14, 0.32, 6), dark, -0.3, 0.2, 0.18);
    const leaf = mesh(root, new THREE.ConeGeometry(0.16, 0.36, 5), signal, -0.3, 0.52, 0.18);
    animated = (time) => { leaf.rotation.z = Math.sin(time * 1.3) * 0.08; };
  } else if (upgradeId === "accessibility-station") {
    mesh(root, new THREE.CylinderGeometry(0.05, 0.06, 0.74, 6), dark, 0, 0.37, 0);
    const ring = mesh(root, new THREE.TorusGeometry(0.17, 0.045, 6, 12), signal, 0, 0.72, 0);
    ring.rotation.x = Math.PI / 2;
    animated = (time) => { ring.rotation.z = Math.sin(time * 1.2) * 0.12; };
  }

  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.scale.setScalar(Math.min(1.35, 0.8 + Math.max(width, depth) * 0.07));
  root.userData.upgradeId = upgradeId;
  root.userData.updateVisual = animated ?? (() => {});
  markEntityPickTarget(root, entity.id);
  return root;
}

function createDistrictAccent(themeId, entity) {
  const root = new THREE.Group();
  root.name = `district-accent-${themeId}`;
  const color = DISTRICT_COLORS[themeId];
  if (!color) return root;
  const primary = standardMaterial(color);
  const signal = signalMaterial(color, 0.9);
  const dark = standardMaterial(0x4b4b46, { roughness: 0.92 });
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.position.set(Math.min(2.2, width * 0.46), 0.12, Math.min(1.6, depth * 0.32));
  mesh(root, new THREE.CylinderGeometry(0.045, 0.055, 1.25, 6), dark, 0, 0.62, 0);

  if (themeId === "garden") {
    const leaves = [-0.12, 0, 0.12].map((x, index) => {
      const leaf = mesh(root, new THREE.ConeGeometry(0.13, 0.36, 5), primary, x, 1.28 + index * 0.035, 0);
      leaf.rotation.z = x * 1.4;
      return leaf;
    });
    root.userData.updateVisual = (time) => leaves.forEach((leaf, index) => { leaf.rotation.z += Math.sin(time * 1.2 + index) * 0.002; });
  } else if (themeId === "adventure") {
    const pennant = mesh(root, new THREE.ConeGeometry(0.24, 0.46, 3), primary, 0.18, 1.25, 0);
    pennant.rotation.z = -Math.PI / 2;
    root.userData.updateVisual = (time) => { pennant.rotation.y = Math.sin(time * 2) * 0.08; };
  } else if (themeId === "storybook") {
    const lantern = mesh(root, new THREE.OctahedronGeometry(0.2, 0), signal, 0, 1.3, 0);
    mesh(root, new THREE.TorusGeometry(0.24, 0.035, 5, 10), primary, 0, 1.3, 0).rotation.x = Math.PI / 2;
    root.userData.updateVisual = (time) => { lantern.position.y = 1.3 + Math.sin(time * 2.1) * 0.05; lantern.rotation.y = time * 0.35; };
  } else if (themeId === "future") {
    const ring = mesh(root, new THREE.TorusGeometry(0.22, 0.04, 6, 14), signal, 0, 1.28, 0);
    ring.rotation.x = Math.PI / 2;
    const node = mesh(root, new THREE.SphereGeometry(0.08, 7, 5), primary, 0, 1.28, 0);
    root.userData.updateVisual = (time) => { ring.rotation.z = time * 0.8; node.scale.setScalar(0.9 + Math.sin(time * 3.2) * 0.12); };
  }
  markEntityPickTarget(root, entity.id);
  return root;
}

function createParkUpgradeVisual(upgradeId) {
  const root = new THREE.Group();
  root.name = `park-infrastructure-${upgradeId}`;
  const dark = standardMaterial(0x46535a, { roughness: 0.9 });
  const warm = standardMaterial(0xf0c766);
  const cool = standardMaterial(0x65bed1);
  const green = standardMaterial(0x75d5ad);
  const signal = signalMaterial(upgradeId === "night-signature" ? 0xb8a7ea : 0xf4df91, 0.92);

  if (upgradeId === "wayfinding-boards") {
    mesh(root, new THREE.CylinderGeometry(0.07, 0.08, 1.5, 6), dark, 0, 0.75, 0);
    mesh(root, new THREE.BoxGeometry(0.9, 0.42, 0.12), cool, 0, 1.28, 0);
    const pointer = mesh(root, new THREE.ConeGeometry(0.18, 0.42, 3), warm, 0.58, 1.28, 0);
    pointer.rotation.z = -Math.PI / 2;
  } else if (upgradeId === "staff-radio") {
    mesh(root, new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6), dark, 0, 0.9, 0);
    const ring = mesh(root, new THREE.TorusGeometry(0.28, 0.035, 5, 12), cool, 0, 1.62, 0);
    ring.rotation.x = Math.PI / 2;
    root.userData.updateVisual = (time) => { ring.scale.setScalar(0.9 + Math.sin(time * 2.8) * 0.1); };
  } else if (upgradeId === "energy-loop") {
    mesh(root, new THREE.BoxGeometry(0.7, 0.48, 0.6), dark, 0, 0.24, 0);
    const loop = mesh(root, new THREE.TorusGeometry(0.38, 0.065, 6, 14), cool, 0, 0.82, 0);
    loop.rotation.x = Math.PI / 2;
    root.userData.updateVisual = (time) => { loop.rotation.z = time * 0.6; };
  } else if (upgradeId === "rain-shelters") {
    mesh(root, new THREE.CylinderGeometry(0.06, 0.07, 1.28, 6), dark, -0.42, 0.64, 0);
    mesh(root, new THREE.CylinderGeometry(0.06, 0.07, 1.28, 6), dark, 0.42, 0.64, 0);
    const canopy = mesh(root, new THREE.ConeGeometry(0.84, 0.38, 6), cool, 0, 1.34, 0);
    canopy.rotation.y = Math.PI / 6;
  } else if (upgradeId === "welcome-square") {
    mesh(root, new THREE.CylinderGeometry(0.08, 0.1, 1.45, 6), dark, -0.5, 0.72, 0);
    mesh(root, new THREE.CylinderGeometry(0.08, 0.1, 1.45, 6), dark, 0.5, 0.72, 0);
    mesh(root, new THREE.BoxGeometry(1.14, 0.18, 0.2), warm, 0, 1.46, 0);
    const gem = mesh(root, new THREE.OctahedronGeometry(0.14, 0), signal, 0, 1.75, 0);
    root.userData.updateVisual = (time) => { gem.rotation.y = time * 0.45; };
  } else if (upgradeId === "night-signature") {
    mesh(root, new THREE.CylinderGeometry(0.07, 0.1, 1.9, 6), dark, 0, 0.95, 0);
    const star = mesh(root, new THREE.OctahedronGeometry(0.28, 0), signal, 0, 2.05, 0);
    root.userData.updateVisual = (time) => { star.rotation.y = time * 0.7; star.scale.setScalar(0.92 + Math.sin(time * 3) * 0.08); };
  } else if (upgradeId === "recycling-network") {
    mesh(root, new THREE.BoxGeometry(0.38, 0.68, 0.42), green, -0.23, 0.34, 0);
    mesh(root, new THREE.BoxGeometry(0.38, 0.68, 0.42), cool, 0.23, 0.34, 0);
    const loop = mesh(root, new THREE.TorusGeometry(0.2, 0.045, 5, 12), signal, 0, 0.92, 0);
    loop.rotation.x = Math.PI / 2;
    root.userData.updateVisual = (time) => { loop.rotation.z = time * 0.5; };
  }
  root.userData.upgradeId = upgradeId;
  root.userData.updateVisual ??= (() => {});
  return root;
}

/**
 * Final presentation layer for source stewardship. Installed upgrades remain
 * authoritative in core/upgrades.js. District choices remain style-only and are
 * committed through core/districts.js from this bounded presentation seam.
 */
export class WorldRenderer extends SpecialContentWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.parkUpgradeVisualRoot = new THREE.Group();
    this.parkUpgradeVisualRoot.name = "installed-park-infrastructure-visuals";
    this.globe.root.add(this.parkUpgradeVisualRoot);
    this.parkUpgradeVisualSignature = "";

    addEventListener("keydown", (event) => {
      if (event.code !== "KeyY" || this.mode !== "manage") return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      this.cycleSelectedDistrictTheme();
    });
  }

  cycleSelectedDistrictTheme() {
    if (!this.selectedEntityId || !this.state) {
      this.callbacks.onWorldMessage?.("Select a park element first · Y changes the style of its district.");
      return false;
    }
    const result = applyDistrictAction(this.state, { type: "cycleDistrictTheme", entityId: this.selectedEntityId });
    if (!result.ok) {
      this.callbacks.onWorldMessage?.(result.reason ?? "That district style could not be changed.");
      return false;
    }
    this.state.stateHash = stateHash(this.state);
    this.syncWorld();
    this.callbacks.onWorldMessage?.(result.message);
    return true;
  }

  selectEntity(entityId) {
    super.selectEntity(entityId);
    if (!entityId || !this.state) return;
    const entity = this.state.world.entities.find((item) => item.id === entityId);
    if (!entity) return;
    const identity = districtThemeForEntity(this.state, entity);
    this.callbacks.onWorldMessage?.(`${identity.districtLabel} · ${identity.themeLabel} style · Y cycles district style`);
  }

  syncWorld() {
    super.syncWorld();
    if (!this.state || !this.parkUpgradeVisualRoot) return;
    this.syncEntityUpgradeVisuals();
    this.syncDistrictAccents();
    this.syncParkUpgradeVisuals();
  }

  syncEntityUpgradeVisuals() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      let root = model.userData.installedUpgradeVisualRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "installed-entity-upgrade-visuals";
        model.add(root);
        model.userData.installedUpgradeVisualRoot = root;
      }
      const installed = [...(entity.installedUpgrades ?? [])].sort();
      const signature = installed.join("|");
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      installed.forEach((upgradeId, index) => root.add(createEntityModuleVisual(upgradeId, index, entity)));
      root.userData.signature = signature;
      root.visible = installed.length > 0;
    }
  }

  syncDistrictAccents() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      const signature = `${identity.districtId}:${identity.themeId}`;
      let root = model.userData.districtAccentVisualRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "district-style-accent";
        model.add(root);
        model.userData.districtAccentVisualRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (identity.themeId !== "neutral") root.add(createDistrictAccent(identity.themeId, entity));
      root.userData.signature = signature;
      root.userData.districtId = identity.districtId;
      root.userData.themeId = identity.themeId;
      root.visible = identity.themeId !== "neutral";
    }
  }

  syncParkUpgradeVisuals() {
    const installed = [...(this.state.upgrades?.park ?? [])].sort();
    const signature = installed.join("|");
    if (signature === this.parkUpgradeVisualSignature) return;
    clearChildren(this.parkUpgradeVisualRoot);
    const [entranceX, entranceZ] = this.state.world.entrance;
    const inwardZ = entranceZ >= (GRID_SIZE - 1) / 2 ? -1 : 1;
    for (const upgradeId of installed) {
      const [dx, depth] = PARK_OFFSETS[upgradeId] ?? [0, 4];
      const x = clamp(Math.round(entranceX + dx), 0, GRID_SIZE - 1);
      const z = clamp(Math.round(entranceZ + depth * inwardZ), 0, GRID_SIZE - 1);
      const visual = createParkUpgradeVisual(upgradeId);
      this.globe.placeObject(visual, x, z, { altitude: 0.2 });
      this.parkUpgradeVisualRoot.add(visual);
    }
    this.parkUpgradeVisualSignature = signature;
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const model of this.entityModels.values()) {
      const upgrades = model.userData.installedUpgradeVisualRoot;
      for (const visual of upgrades?.children ?? []) visual.userData.updateVisual?.(time);
      const district = model.userData.districtAccentVisualRoot;
      for (const visual of district?.children ?? []) visual.userData.updateVisual?.(time);
    }
    for (const visual of this.parkUpgradeVisualRoot?.children ?? []) visual.userData.updateVisual?.(time);
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    let entityHardware = 0;
    let districtStyledElements = 0;
    for (const entity of this.state?.world?.entities ?? []) {
      entityHardware += entity.installedUpgrades?.length ?? 0;
      if (districtThemeForEntity(this.state, entity).themeId !== "neutral") districtStyledElements += 1;
    }
    return Object.freeze({
      ...base,
      upgradeHardware: Object.freeze({
        entityModules: entityHardware,
        parkInfrastructure: this.state?.upgrades?.park?.length ?? 0
      }),
      districts: Object.freeze({
        themes: Object.freeze({ ...(this.state?.districts?.themes ?? {}) }),
        styledElements: districtStyledElements,
        availableThemes: Object.freeze(Object.values(DISTRICT_THEMES).map((theme) => theme.id))
      })
    });
  }
}
