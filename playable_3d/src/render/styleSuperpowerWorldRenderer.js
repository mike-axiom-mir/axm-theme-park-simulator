import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as WaterfrontIdentityWorldRenderer } from "./waterfrontIdentityWorldRenderer.js";
import {
  STYLE_SUPERPOWER_VISUAL_BUDGET, describeStyleSuperpower, styleSuperpowerPlan
} from "../core/styleSuperpowers.js";

const COLORS = Object.freeze({
  garden: 0x75d5ad,
  adventure: 0xf0a85f,
  storybook: 0xe987a8,
  future: 0x65bed1,
  waterfront: 0x5fb7c9
});

function standardMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.76,
    metalness: options.metalness ?? 0.04,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function signalMaterial(color, opacity = 0.86) {
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

function disposeTree(root) {
  root.traverse((item) => {
    item.geometry?.dispose?.();
    if (Array.isArray(item.material)) item.material.forEach((value) => value?.dispose?.());
    else item.material?.dispose?.();
  });
}

function actorCount(root) {
  let count = 0;
  root.traverse((item) => { if (item.isMesh) count += 1; });
  return count;
}

function stageScale(power) {
  return power.stage === "unleashed" ? 1.16
    : power.stage === "charged" ? 0.96
      : power.stage === "awakening" ? 0.76 : 0;
}

function momentBoost(power, state) {
  const minute = ((Number(state?.clock?.minute) || 0) % 1440 + 1440) % 1440;
  const night = minute >= 1080 || minute < 360;
  const raining = state?.weather?.type === "rain" || Number(state?.weather?.precipitation) > 0.05;
  const bright = state?.weather?.type === "bright";
  let boost = 1;
  if (power.themeId === "garden" && raining) boost += 0.22;
  if (power.themeId === "adventure" && bright) boost += 0.1;
  if (power.themeId === "storybook" && night) boost += 0.3;
  if (power.themeId === "future" && night) boost += 0.34;
  if (power.themeId === "waterfront") {
    if (raining) boost += 0.2;
    if (night) boost += 0.14;
  }
  return Math.min(1.42, boost);
}

function createBloomwake(power, color, signal) {
  const root = new THREE.Group();
  const ring = addMesh(root, new THREE.TorusGeometry(1.45, 0.055, 6, 20), signal, 0, 0.12, 0);
  ring.rotation.x = Math.PI / 2;
  const stems = [];
  const blooms = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index / 6 * Math.PI * 2;
    const radius = 0.88 + (index % 2) * 0.32;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const stem = addMesh(root, new THREE.CylinderGeometry(0.025, 0.04, 0.72, 5), color, x, 0.42, z);
    const bloom = addMesh(root, new THREE.OctahedronGeometry(0.13 + (index % 2) * 0.035, 0), signal, x, 0.84, z);
    stems.push(stem);
    blooms.push(bloom);
  }
  const pollen = Array.from({ length: 6 }, (_, index) => {
    const particle = addMesh(root, new THREE.SphereGeometry(0.045, 5, 4), signal, 0, 0.9, 0);
    particle.userData.phase = index / 6 * Math.PI * 2;
    return particle;
  });
  root.userData.setQuality = (profile) => pollen.forEach((particle, index) => {
    particle.visible = profile !== "tiny" || index < 3;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = momentBoost(power, state);
    ring.rotation.z = time * 0.12;
    stems.forEach((stem, index) => { stem.rotation.z = Math.sin(time * 1.15 + index) * 0.055 * boost; });
    blooms.forEach((bloom, index) => {
      const pulse = 0.9 + Math.sin(time * 2.2 + index * 0.8) * 0.1 * boost;
      bloom.scale.setScalar(pulse);
      bloom.rotation.y = time * (0.25 + index * 0.018);
    });
    pollen.forEach((particle) => {
      const angle = particle.userData.phase + time * 0.35;
      particle.position.set(Math.cos(angle) * 1.25, 0.78 + Math.sin(time * 1.5 + angle) * 0.25, Math.sin(angle) * 1.25);
    });
  };
  return root;
}

function createTrailblaze(power, color, signal) {
  const root = new THREE.Group();
  const timber = standardMaterial(0x6a4c37, { roughness: 0.96 });
  const flags = [];
  const sparks = [];
  for (let index = 0; index < 3; index += 1) {
    const x = (index - 1) * 1.15;
    const z = index === 1 ? -0.34 : 0.2;
    addMesh(root, new THREE.CylinderGeometry(0.055, 0.075, 1.45, 6), timber, x, 0.72, z);
    const flag = addMesh(root, new THREE.ConeGeometry(0.24, 0.55, 3), color, x + 0.2, 1.25, z);
    flag.rotation.z = -Math.PI / 2;
    flags.push(flag);
    const spark = addMesh(root, new THREE.OctahedronGeometry(0.105, 0), signal, x, 1.48, z);
    sparks.push(spark);
  }
  const trail = addMesh(root, new THREE.BoxGeometry(2.8, 0.045, 0.12), signal, 0, 0.13, 0.12);
  root.userData.updateVisual = (time, state) => {
    const boost = momentBoost(power, state);
    trail.scale.x = 0.92 + Math.sin(time * 0.9) * 0.08 * boost;
    flags.forEach((flag, index) => { flag.rotation.y = Math.sin(time * 2 + index) * 0.12 * boost; });
    sparks.forEach((spark, index) => {
      spark.position.y = 1.48 + Math.sin(time * 3.4 + index * 1.2) * 0.07 * boost;
      spark.scale.setScalar(0.88 + Math.sin(time * 4 + index) * 0.12 * boost);
    });
  };
  return root;
}

function createLanternChorus(power, color, signal) {
  const root = new THREE.Group();
  const lanterns = [];
  for (let index = 0; index < 7; index += 1) {
    const angle = index / 7 * Math.PI * 2;
    const radius = 1.05 + (index % 2) * 0.38;
    const lantern = addMesh(
      root, new THREE.OctahedronGeometry(0.15 + (index % 3) * 0.025, 0), signal,
      Math.cos(angle) * radius, 0.78 + (index % 2) * 0.22, Math.sin(angle) * radius
    );
    lantern.userData.phase = angle;
    lanterns.push(lantern);
  }
  const crown = addMesh(root, new THREE.TorusGeometry(0.5, 0.055, 6, 16), color, 0, 1.12, 0);
  crown.rotation.x = Math.PI / 2;
  root.userData.setQuality = (profile) => lanterns.forEach((lantern, index) => {
    lantern.visible = profile !== "tiny" || index % 2 === 0;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = momentBoost(power, state);
    crown.rotation.z = time * 0.2;
    lanterns.forEach((lantern, index) => {
      const angle = lantern.userData.phase + time * 0.12 * boost;
      const radius = 1.05 + (index % 2) * 0.38;
      lantern.position.x = Math.cos(angle) * radius;
      lantern.position.z = Math.sin(angle) * radius;
      lantern.position.y = 0.82 + (index % 2) * 0.18 + Math.sin(time * 1.8 + index) * 0.12 * boost;
      lantern.scale.setScalar(0.88 + Math.sin(time * 2.5 + index) * 0.12 * boost);
    });
  };
  return root;
}

function createPulseGrid(power, color, signal) {
  const root = new THREE.Group();
  const rings = [];
  for (let index = 0; index < 3; index += 1) {
    const ring = addMesh(root, new THREE.TorusGeometry(0.52 + index * 0.34, 0.045, 6, 18), signal, 0, 0.72 + index * 0.18, 0);
    ring.rotation.x = Math.PI / 2;
    ring.rotation.z = index * 0.55;
    rings.push(ring);
  }
  const nodes = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = index / 5 * Math.PI * 2;
    const node = addMesh(root, new THREE.OctahedronGeometry(0.11, 0), color, Math.cos(angle) * 1.2, 0.5, Math.sin(angle) * 1.2);
    node.userData.phase = angle;
    nodes.push(node);
  }
  root.userData.setQuality = (profile) => rings.forEach((ring, index) => { ring.visible = profile !== "tiny" || index < 2; });
  root.userData.updateVisual = (time, state) => {
    const boost = momentBoost(power, state);
    rings.forEach((ring, index) => {
      ring.rotation.z = time * (0.28 + index * 0.11) * (index % 2 ? -1 : 1) * boost;
      ring.scale.setScalar(0.94 + Math.sin(time * 1.7 + index) * 0.06 * boost);
    });
    nodes.forEach((node, index) => {
      const angle = node.userData.phase + time * 0.22 * boost;
      node.position.x = Math.cos(angle) * 1.2;
      node.position.z = Math.sin(angle) * 1.2;
      node.position.y = 0.48 + Math.sin(time * 2.8 + index) * 0.12 * boost;
    });
  };
  return root;
}

function createTidecall(power, color, signal) {
  const root = new THREE.Group();
  const water = standardMaterial(0x4d9eb6, {
    opacity: 0.58, roughness: 0.32, metalness: 0.08, emissive: 0x173c45, emissiveIntensity: 0.12
  });
  const pool = addMesh(root, new THREE.CylinderGeometry(1.32, 1.42, 0.07, 18), water, 0, 0.08, 0);
  const ripples = [];
  for (let index = 0; index < 3; index += 1) {
    const ripple = addMesh(root, new THREE.TorusGeometry(0.48 + index * 0.36, 0.035, 5, 18), signal, 0, 0.15 + index * 0.02, 0);
    ripple.rotation.x = Math.PI / 2;
    ripples.push(ripple);
  }
  const mist = Array.from({ length: 6 }, (_, index) => {
    const angle = index / 6 * Math.PI * 2;
    const particle = addMesh(root, new THREE.SphereGeometry(0.08, 5, 4), signal, Math.cos(angle), 0.45, Math.sin(angle));
    particle.userData.phase = angle;
    return particle;
  });
  const beacon = addMesh(root, new THREE.OctahedronGeometry(0.14, 0), color, 0, 1.05, 0);
  root.userData.setQuality = (profile) => mist.forEach((particle, index) => {
    particle.visible = profile !== "tiny" || index < 3;
  });
  root.userData.updateVisual = (time, state) => {
    const boost = momentBoost(power, state);
    pool.rotation.y = time * 0.025;
    ripples.forEach((ripple, index) => {
      const pulse = 0.82 + ((time * (0.18 + index * 0.025) + index * 0.22) % 1) * 0.42 * boost;
      ripple.scale.setScalar(pulse);
    });
    mist.forEach((particle, index) => {
      const angle = particle.userData.phase + time * 0.16;
      particle.position.x = Math.cos(angle) * (0.82 + index * 0.04);
      particle.position.z = Math.sin(angle) * (0.82 + index * 0.04);
      particle.position.y = 0.34 + ((time * 0.12 + index / mist.length) % 1) * 0.82 * boost;
      particle.scale.setScalar(0.72 + Math.sin(time * 1.5 + index) * 0.16);
    });
    beacon.position.y = 1.05 + Math.sin(time * 2.3) * 0.08 * boost;
    beacon.rotation.y = time * 0.45;
  };
  return root;
}

function createPowerVisual(power) {
  const root = new THREE.Group();
  root.name = `district-style-power-${power.districtId}-${power.id}`;
  const colorValue = COLORS[power.themeId] ?? 0xffffff;
  const color = standardMaterial(colorValue, { emissive: colorValue, emissiveIntensity: 0.08 });
  const signal = signalMaterial(colorValue, power.stage === "awakening" ? 0.62 : 0.88);

  let visual = null;
  if (power.visualMode === "bloom") visual = createBloomwake(power, color, signal);
  else if (power.visualMode === "trail") visual = createTrailblaze(power, color, signal);
  else if (power.visualMode === "lanterns") visual = createLanternChorus(power, color, signal);
  else if (power.visualMode === "grid") visual = createPulseGrid(power, color, signal);
  else if (power.visualMode === "tide") visual = createTidecall(power, color, signal);

  if (visual) root.add(visual);
  root.scale.setScalar(stageScale(power));
  root.userData.power = power;
  root.userData.actorCount = actorCount(root);
  root.userData.setQuality = (profile) => visual?.userData.setQuality?.(profile);
  root.userData.updateVisual = (time, state) => {
    const boost = momentBoost(power, state);
    const baseScale = stageScale(power);
    const breathing = 1 + Math.sin(time * 0.72 + power.score) * 0.025 * boost;
    root.scale.setScalar(baseScale * breathing);
    visual?.userData.updateVisual?.(time, state);
  };
  return root;
}

function powerSignature(power) {
  return [
    power.districtId, power.themeId, power.id, power.stage, power.score,
    power.anchors.map((anchor) => `${anchor.entityId}:${anchor.fitStatus}`).join("|")
  ].join(":");
}

/**
 * Final spectacle-only district layer. Superpowers are earned by existing theme-fit
 * evidence and are intentionally unable to modify authoritative simulation state.
 */
export class WorldRenderer extends WaterfrontIdentityWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.stylePowerPlan = Object.freeze([]);
    this.stylePowerRoots = new Map();
    this.stylePowerRoot = new THREE.Group();
    this.stylePowerRoot.name = "bounded-render-only-style-superpowers";
    this.globe.root.add(this.stylePowerRoot);

    const documentRef = globalThis.document;
    this.stylePowerButton = documentRef?.getElementById?.("style-power-status") ?? null;
    if (!this.stylePowerButton && documentRef?.createElement) {
      const button = documentRef.createElement("button");
      button.id = "style-power-status";
      button.type = "button";
      button.textContent = "Power · Build a district";
      button.title = "Matching attractions charge a presentation-only district superpower.";
      button.setAttribute("aria-live", "polite");
      button.addEventListener("click", () => {
        const context = this.contextStylePower();
        this.callbacks.onWorldMessage?.(context
          ? `${describeStyleSuperpower(context)} · ${context.summary} ${context.moment} ${context.nextHint}`
          : "Choose a district style and add fitting attractions or scenery to wake its visual superpower.");
      });
      documentRef.querySelector?.(".top-actions")?.prepend(button);
      this.stylePowerButton = button;
    }
    this.syncStylePowerButton();
  }

  contextStylePower() {
    const districtId = this.currentThemeFit?.districtId ?? null;
    if (districtId) return this.stylePowerPlan.find((power) => power.districtId === districtId) ?? null;
    return [...this.stylePowerPlan]
      .sort((left, right) => Number(right.active) - Number(left.active) || right.score - left.score)
      .find((power) => power.themeId !== "neutral")
      ?? this.stylePowerPlan[0]
      ?? null;
  }

  syncStylePowerButton() {
    if (!this.stylePowerButton) return;
    const context = this.contextStylePower();
    if (!context) {
      this.stylePowerButton.textContent = "Power · Build a district";
      this.stylePowerButton.classList.remove("primary", "active");
      return;
    }
    this.stylePowerButton.textContent = `Power · ${context.label} · ${context.stageLabel}`;
    this.stylePowerButton.classList.toggle("primary", context.stage === "unleashed");
    this.stylePowerButton.classList.toggle("active", context.active);
    this.stylePowerButton.title = `${context.districtLabel} · ${context.themeLabel} · charge ${context.score}. ${context.nextHint}`;
  }

  syncWorld() {
    super.syncWorld();
    if (!this.state || !this.stylePowerRoot) return;
    this.syncStyleSuperpowers();
    this.syncStylePowerButton();
  }

  syncStyleSuperpowers() {
    this.stylePowerPlan = styleSuperpowerPlan(this.state);
    const live = new Set();
    for (const power of this.stylePowerPlan.slice(0, STYLE_SUPERPOWER_VISUAL_BUDGET)) {
      if (!power.active || power.visualMode === "none") continue;
      live.add(power.districtId);
      const signature = powerSignature(power);
      let root = this.stylePowerRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) {
        this.stylePowerRoot.remove(root);
        disposeTree(root);
      }
      root = createPowerVisual(power);
      root.userData.signature = signature;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.42 });
      root.userData.setQuality?.(this.qualityProfile);
      this.stylePowerRoot.add(root);
      this.stylePowerRoots.set(power.districtId, root);
    }

    for (const [districtId, root] of this.stylePowerRoots) {
      if (live.has(districtId)) continue;
      this.stylePowerRoot.remove(root);
      disposeTree(root);
      this.stylePowerRoots.delete(districtId);
    }
  }

  selectEntity(entityId) {
    super.selectEntity(entityId);
    this.syncStylePowerButton();
  }

  selectVisitor(visitorId) {
    super.selectVisitor(visitorId);
    this.syncStylePowerButton();
  }

  selectStaff(staffId) {
    super.selectStaff(staffId);
    this.syncStylePowerButton();
  }

  updateGhost(...args) {
    const result = super.updateGhost(...args);
    this.syncStylePowerButton();
    return result;
  }

  cycleSelectedDistrictTheme() {
    const changed = super.cycleSelectedDistrictTheme();
    if (changed) {
      this.syncStyleSuperpowers();
      this.syncStylePowerButton();
    }
    return changed;
  }

  setQuality(profile) {
    super.setQuality(profile);
    for (const root of this.stylePowerRoots.values()) root.userData.setQuality?.(this.qualityProfile);
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.stylePowerRoots.values()) root.userData.updateVisual?.(time, this.state);
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    const stages = { passive: 0, dormant: 0, awakening: 0, charged: 0, unleashed: 0 };
    let actorCountTotal = 0;
    for (const power of this.stylePowerPlan) stages[power.stage] += 1;
    for (const root of this.stylePowerRoots.values()) actorCountTotal += root.userData.actorCount ?? 0;
    return Object.freeze({
      ...base,
      styleSuperpowers: Object.freeze({
        presentationOnly: true,
        districtBudget: STYLE_SUPERPOWER_VISUAL_BUDGET,
        renderedDistricts: this.stylePowerRoots.size,
        actorCount: actorCountTotal,
        stages: Object.freeze(stages),
        context: this.contextStylePower()
          ? Object.freeze({
            districtId: this.contextStylePower().districtId,
            themeId: this.contextStylePower().themeId,
            id: this.contextStylePower().id,
            stage: this.contextStylePower().stage,
            score: this.contextStylePower().score
          })
          : null
      })
    });
  }
}
