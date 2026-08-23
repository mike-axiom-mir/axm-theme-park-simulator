import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as ParkIdentityWorldRenderer } from "./parkIdentityWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { districtThemeForEntity } from "../core/districts.js";
import {
  describeThemeFit, themeFitForEntity, themeFitForPlacement, themeTagLabel
} from "../core/themeFit.js";

const FIT_SCALE = Object.freeze({
  signature: 1.16,
  strong: 1.04,
  compatible: 0.88,
  neutral: 0.78,
  contrast: 0.68
});

const THEME_COLORS = Object.freeze({
  garden: 0x75d5ad,
  adventure: 0xf0a85f,
  storybook: 0xe987a8,
  future: 0x65bed1,
  waterfront: 0x5fb7c9
});

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.8,
    metalness: options.metalness ?? 0.04,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function signalMaterial(color, opacity = 0.9) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 0.72
  });
}

function addMesh(root, geometry, meshMaterial, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, meshMaterial);
  item.position.set(x, y, z);
  item.castShadow = meshMaterial.opacity >= 0.72;
  item.receiveShadow = true;
  root.add(item);
  return item;
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

function createGardenDressing(root, color, signal) {
  const soil = material(0x654f3e, { roughness: 0.95 });
  addMesh(root, new THREE.BoxGeometry(1.05, 0.25, 0.46), soil, 0, 0.15, 0);
  const leaves = [];
  for (const [x, z, height] of [[-0.32, 0, 0.62], [0, 0.04, 0.78], [0.32, -0.02, 0.58]]) {
    const leaf = addMesh(root, new THREE.ConeGeometry(0.2, height, 5), color, x, 0.32 + height / 2, z);
    leaves.push(leaf);
  }
  const bloom = addMesh(root, new THREE.OctahedronGeometry(0.11, 0), signal, 0, 0.98, 0);
  root.userData.updateVisual = (time) => {
    leaves.forEach((leaf, index) => { leaf.rotation.z = Math.sin(time * 1.1 + index) * 0.04; });
    bloom.rotation.y = time * 0.4;
  };
}

function createAdventureDressing(root, color, signal) {
  const timber = material(0x6c4e38, { roughness: 0.95 });
  addMesh(root, new THREE.BoxGeometry(0.85, 0.44, 0.62), timber, 0, 0.22, 0);
  addMesh(root, new THREE.CylinderGeometry(0.05, 0.065, 1.2, 6), timber, -0.48, 0.6, 0);
  const pennant = addMesh(root, new THREE.ConeGeometry(0.23, 0.48, 3), color, -0.28, 1.05, 0);
  pennant.rotation.z = -Math.PI / 2;
  const marker = addMesh(root, new THREE.OctahedronGeometry(0.1, 0), signal, 0.35, 0.6, 0);
  root.userData.updateVisual = (time) => {
    pennant.rotation.y = Math.sin(time * 1.8) * 0.08;
    marker.position.y = 0.6 + Math.sin(time * 2.1) * 0.04;
  };
}

function createStorybookDressing(root, color, signal) {
  const dark = material(0x544a55, { roughness: 0.9 });
  addMesh(root, new THREE.CylinderGeometry(0.045, 0.055, 1.2, 6), dark, -0.38, 0.6, 0);
  addMesh(root, new THREE.CylinderGeometry(0.045, 0.055, 1.2, 6), dark, 0.38, 0.6, 0);
  addMesh(root, new THREE.BoxGeometry(0.84, 0.1, 0.12), color, 0, 1.14, 0);
  const lantern = addMesh(root, new THREE.OctahedronGeometry(0.18, 0), signal, 0, 0.82, 0);
  const gem = addMesh(root, new THREE.OctahedronGeometry(0.1, 0), signal, 0.3, 0.35, 0.12);
  root.userData.updateVisual = (time) => {
    lantern.position.y = 0.82 + Math.sin(time * 2.2) * 0.045;
    lantern.rotation.y = time * 0.4;
    gem.scale.setScalar(0.9 + Math.sin(time * 3 + 1) * 0.1);
  };
}

function createFutureDressing(root, color, signal) {
  const dark = material(0x40515a, { roughness: 0.72, metalness: 0.18 });
  addMesh(root, new THREE.BoxGeometry(0.76, 0.28, 0.5), dark, 0, 0.14, 0);
  const ring = addMesh(root, new THREE.TorusGeometry(0.32, 0.055, 6, 14), signal, 0, 0.72, 0);
  ring.rotation.x = Math.PI / 2;
  const left = addMesh(root, new THREE.SphereGeometry(0.09, 7, 5), color, -0.35, 0.42, 0);
  const right = addMesh(root, new THREE.SphereGeometry(0.09, 7, 5), color, 0.35, 0.42, 0);
  root.userData.updateVisual = (time) => {
    ring.rotation.z = time * 0.72;
    left.scale.setScalar(0.9 + Math.sin(time * 2.8) * 0.12);
    right.scale.setScalar(0.9 + Math.sin(time * 2.8 + Math.PI) * 0.12);
  };
}

function createWaterfrontDressing(root, color, signal, fit) {
  const timber = material(0x79583f, { roughness: 0.94 });
  const water = material(0x4e9fb6, {
    opacity: 0.66, roughness: 0.34, metalness: 0.08, emissive: 0x173c45, emissiveIntensity: 0.14
  });
  addMesh(root, new THREE.BoxGeometry(1.45, 0.08, 0.82), water, 0, 0.08, 0);
  addMesh(root, new THREE.BoxGeometry(1.1, 0.14, 0.48), timber, 0.1, 0.2, 0);
  addMesh(root, new THREE.CylinderGeometry(0.045, 0.06, 0.92, 6), timber, -0.46, 0.53, -0.18);
  addMesh(root, new THREE.CylinderGeometry(0.045, 0.06, 0.92, 6), timber, 0.62, 0.53, -0.18);

  const buoy = addMesh(root, new THREE.TorusGeometry(0.18, 0.065, 6, 12), color, -0.46, 0.48, 0.02);
  buoy.rotation.x = Math.PI / 2;
  const lamp = addMesh(root, new THREE.OctahedronGeometry(0.13, 0), signal, 0.62, 1.02, -0.18);
  const reeds = [];
  if (fit.tags.includes("garden") || fit.tags.includes("scenic")) {
    for (const [x, z, height] of [[-0.68, 0.25, 0.56], [-0.55, 0.31, 0.72], [-0.38, 0.27, 0.48]]) {
      const reed = addMesh(root, new THREE.CylinderGeometry(0.025, 0.035, height, 5), color, x, 0.2 + height / 2, z);
      reeds.push(reed);
    }
  }
  root.userData.updateVisual = (time) => {
    buoy.rotation.z = Math.sin(time * 0.9) * 0.08;
    lamp.scale.setScalar(0.88 + Math.sin(time * 2.7) * 0.12);
    reeds.forEach((reed, index) => {
      reed.rotation.z = Math.sin(time * 1.2 + index) * 0.07;
    });
  };
}

function createFitDressing(fit, entity) {
  const root = new THREE.Group();
  root.name = `theme-fit-dressing-${fit.themeId}-${fit.status}`;
  const colorValue = THEME_COLORS[fit.themeId];
  if (!colorValue || fit.themeId === "neutral" || fit.status === "contrast") return root;

  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  root.position.set(
    -Math.min(2.35, width * 0.48),
    0.12,
    Math.min(1.75, depth * 0.34)
  );
  root.scale.setScalar(
    FIT_SCALE[fit.status] * Math.min(1.3, 0.82 + Math.max(width, depth) * 0.055)
  );

  const color = material(colorValue);
  const signal = signalMaterial(colorValue, fit.status === "compatible" ? 0.68 : 0.9);
  if (fit.themeId === "garden") createGardenDressing(root, color, signal);
  else if (fit.themeId === "adventure") createAdventureDressing(root, color, signal);
  else if (fit.themeId === "storybook") createStorybookDressing(root, color, signal);
  else if (fit.themeId === "future") createFutureDressing(root, color, signal);
  else if (fit.themeId === "waterfront") createWaterfrontDressing(root, color, signal, fit);

  root.userData.themeFit = fit;
  root.userData.updateVisual ??= () => {};
  markEntityPickTarget(root, entity.id);
  return root;
}

/**
 * Presentation-only layer that makes theme/content coherence readable. It adds
 * stronger local dressing only when catalog evidence fits the selected district,
 * plus a compact hover/selection status control. It never changes build legality,
 * price, rating, guest motives, pathing, research or operating effects.
 */
export class WorldRenderer extends ParkIdentityWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.currentThemeFit = null;
    this.currentThemeFitSignature = "";
    const documentRef = globalThis.document;
    this.themeFitButton = documentRef?.getElementById?.("theme-fit-status") ?? null;
    if (!this.themeFitButton && documentRef?.createElement) {
      const button = documentRef.createElement("button");
      button.id = "theme-fit-status";
      button.type = "button";
      button.textContent = "Fit · Hover or select";
      button.title = "Theme fit is advisory only; it never blocks building or changes simulation values.";
      button.setAttribute("aria-live", "polite");
      button.addEventListener("click", () => {
        if (this.currentThemeFit) {
          this.callbacks.onWorldMessage?.(
            `${describeThemeFit(this.currentThemeFit)} · ${this.currentThemeFit.suggestion}`
          );
        } else {
          this.callbacks.onWorldMessage?.(
            "Hover a build position or select a park element to inspect its district fit."
          );
        }
      });
      documentRef.querySelector?.(".top-actions")?.prepend(button);
      this.themeFitButton = button;
    }
    this.reportThemeFit(null);
  }

  reportThemeFit(fit) {
    this.currentThemeFit = fit;
    const signature = fit
      ? `${fit.districtId}:${fit.themeId}:${fit.contentId}:${fit.status}:${fit.matchedTags.join("|")}`
      : "none";
    if (signature === this.currentThemeFitSignature) return;
    this.currentThemeFitSignature = signature;
    if (!this.themeFitButton) return;

    this.themeFitButton.classList.toggle(
      "primary", Boolean(fit && ["signature", "strong"].includes(fit.status))
    );
    this.themeFitButton.classList.toggle("active", Boolean(fit));
    this.themeFitButton.textContent = fit
      ? `Fit · ${fit.themeLabel} · ${fit.label}`
      : "Fit · Hover or select";
    const matches = fit?.matchedTags?.length
      ? ` Matches: ${fit.matchedTags.slice(0, 3).map(themeTagLabel).join(", ")}.`
      : "";
    this.themeFitButton.title = fit
      ? `${fit.districtLabel}. ${fit.summary}${matches} Click for the full explanation.`
      : "Theme fit is advisory only; hover a build position or select a park element.";
  }

  selectedEntityThemeFit() {
    if (!this.selectedEntityId || !this.state) return null;
    const entity = this.state.world.entities.find((item) => item.id === this.selectedEntityId);
    return entity ? themeFitForEntity(this.state, entity) : null;
  }

  selectEntity(entityId) {
    super.selectEntity(entityId);
    this.reportThemeFit(this.selectedEntityThemeFit());
  }

  selectVisitor(visitorId) {
    super.selectVisitor(visitorId);
    this.reportThemeFit(null);
  }

  selectStaff(staffId) {
    super.selectStaff(staffId);
    this.reportThemeFit(null);
  }

  setRemovePathTool(...args) {
    const result = super.setRemovePathTool(...args);
    this.reportThemeFit(null);
    return result;
  }

  clearBuildTool(...args) {
    const result = super.clearBuildTool(...args);
    this.reportThemeFit(this.selectedEntityThemeFit());
    return result;
  }

  updateGhost() {
    super.updateGhost();
    if (!this.state) return;
    if (this.buildTool && this.hoverCell) {
      this.reportThemeFit(themeFitForPlacement(
        this.state, this.buildTool, this.hoverCell.x, this.hoverCell.z, this.buildRotation
      ));
      return;
    }
    if (!this.removePathTool) this.reportThemeFit(this.selectedEntityThemeFit());
  }

  cycleSelectedDistrictTheme() {
    const changed = super.cycleSelectedDistrictTheme();
    if (changed) this.reportThemeFit(this.selectedEntityThemeFit());
    return changed;
  }

  syncWorld() {
    super.syncWorld();
    if (!this.state) return;
    this.syncThemeFitDressings();
  }

  syncThemeFitDressings() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const fit = themeFitForEntity(this.state, entity);
      const identity = districtThemeForEntity(this.state, entity);
      const signature = [
        identity.districtId, identity.themeId, fit.status,
        fit.matchedTags.join("|"), entity.catalogId
      ].join(":");

      let root = model.userData.themeFitDressingRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "theme-fit-dressing-root";
        model.add(root);
        model.userData.themeFitDressingRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      const shouldDress = identity.themeId !== "neutral"
        && fit.status !== "contrast"
        && fit.status !== "neutral";
      if (shouldDress) root.add(createFitDressing(fit, entity));
      root.userData.signature = signature;
      root.userData.fitStatus = fit.status;
      root.userData.themeId = fit.themeId;
      root.visible = shouldDress;
    }
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const model of this.entityModels.values()) {
      const root = model.userData.themeFitDressingRoot;
      for (const dressing of root?.children ?? []) dressing.userData.updateVisual?.(time);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    const counts = { signature: 0, strong: 0, compatible: 0, neutral: 0, contrast: 0 };
    let dressedElements = 0;
    for (const entity of this.state?.world?.entities ?? []) {
      const fit = themeFitForEntity(this.state, entity);
      counts[fit.status] += 1;
      if (this.entityModels.get(entity.id)?.userData?.themeFitDressingRoot?.visible) dressedElements += 1;
    }
    return Object.freeze({
      ...base,
      themeFit: Object.freeze({
        advisoryOnly: true,
        current: this.currentThemeFit
          ? Object.freeze({
            districtId: this.currentThemeFit.districtId,
            themeId: this.currentThemeFit.themeId,
            contentId: this.currentThemeFit.contentId,
            status: this.currentThemeFit.status
          })
          : null,
        counts: Object.freeze(counts),
        dressedElements
      })
    });
  }
}
