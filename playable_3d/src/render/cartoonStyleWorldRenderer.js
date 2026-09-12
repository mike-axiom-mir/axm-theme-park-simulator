import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as StyleSuperpowerWorldRenderer } from "./styleSuperpowerWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { districtThemeForEntity } from "../core/districts.js";
import { themeFitForEntity } from "../core/themeFit.js";

const CARTOON_COLORS = Object.freeze([0xffd84f, 0xff6f91, 0x67c7ff, 0x7ee08a]);
const CARTOON_DARK = 0x342f3a;
const CARTOON_ROOT_LIMIT = 4;

function flatMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: options.roughness ?? 0.7,
    metalness: options.metalness ?? 0.02,
    transparent: (options.opacity ?? 1) < 1,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

function signalMaterial(color, opacity = 0.92) {
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
    : status === "strong" ? 0.96
      : status === "compatible" ? 0.82 : 0.72;
}

function daytimeBoost(state) {
  const minute = ((Number(state?.clock?.minute) || 0) % 1440 + 1440) % 1440;
  return minute >= 540 && minute < 1080 ? 1.14 : 1;
}

function createCartoonEntityDressing(fit, entity) {
  const root = new THREE.Group();
  root.name = `cartoon-entity-dressing-${fit.status}`;
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  const scale = fitScale(fit.status) * Math.min(1.22, 0.82 + Math.max(width, depth) * 0.055);
  root.position.set(-Math.min(2.2, width * 0.46), 0.14, Math.min(1.7, depth * 0.32));
  root.scale.setScalar(scale);

  const dark = flatMaterial(CARTOON_DARK, { roughness: 0.88 });
  const yellow = flatMaterial(CARTOON_COLORS[0], { emissive: CARTOON_COLORS[0], emissiveIntensity: 0.05 });
  const pink = signalMaterial(CARTOON_COLORS[1], fit.status === "compatible" ? 0.72 : 0.94);
  const blue = flatMaterial(CARTOON_COLORS[2]);
  const green = flatMaterial(CARTOON_COLORS[3]);

  const shadow = addMesh(root, new THREE.TorusGeometry(0.48, 0.11, 6, 12), dark, 0, 0.18, 0);
  shadow.rotation.x = Math.PI / 2;
  const halo = addMesh(root, new THREE.TorusGeometry(0.42, 0.07, 5, 12), yellow, 0, 0.22, 0);
  halo.rotation.x = Math.PI / 2;
  const pop = addMesh(root, new THREE.OctahedronGeometry(0.2, 0), pink, 0.05, 0.72, 0);
  const left = addMesh(root, new THREE.SphereGeometry(0.12, 6, 5), blue, -0.42, 0.5, 0.08);
  const right = addMesh(root, new THREE.SphereGeometry(0.1, 6, 5), green, 0.42, 0.45, -0.06);
  const slash = addMesh(root, new THREE.BoxGeometry(0.68, 0.07, 0.12), pink, 0.34, 0.86, 0);
  slash.rotation.z = -0.48;

  root.userData.updateVisual = (time) => {
    const wobble = Math.sin(time * 3.1 + entity.id.length) * 0.085;
    halo.rotation.z = time * 0.32;
    pop.rotation.y = time * 0.8;
    pop.scale.set(1 + wobble, 1 - wobble * 0.55, 1 + wobble);
    left.position.y = 0.5 + Math.max(0, Math.sin(time * 4.1)) * 0.13;
    right.position.y = 0.45 + Math.max(0, Math.sin(time * 4.1 + 1.8)) * 0.11;
    slash.rotation.y = Math.sin(time * 2.4) * 0.14;
  };
  markEntityPickTarget(root, entity.id);
  return root;
}

function createCartoonDistrictFrame(power) {
  const root = new THREE.Group();
  root.name = `cartoon-district-frame-${power.districtId}`;
  const dark = flatMaterial(CARTOON_DARK, { roughness: 0.92 });
  const yellow = flatMaterial(CARTOON_COLORS[0]);
  const pink = signalMaterial(CARTOON_COLORS[1], 0.82);
  const blue = flatMaterial(CARTOON_COLORS[2]);
  const green = flatMaterial(CARTOON_COLORS[3]);

  const outer = addMesh(root, new THREE.TorusGeometry(1.52, 0.095, 6, 16), dark, 0, 0.12, 0);
  outer.rotation.x = Math.PI / 2;
  const inner = addMesh(root, new THREE.TorusGeometry(1.3, 0.07, 5, 14), yellow, 0, 0.17, 0);
  inner.rotation.x = Math.PI / 2;

  const bobbles = [];
  const bobbleMaterials = [pink, blue, green, yellow];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(angle) * 1.05;
    const z = Math.sin(angle) * 1.05;
    const post = addMesh(root, new THREE.CylinderGeometry(0.055, 0.075, 0.72, 5), dark, x, 0.48, z);
    const cap = addMesh(root, new THREE.SphereGeometry(0.16, 6, 5), bobbleMaterials[index], x, 0.9, z);
    post.userData.phase = index * 0.7;
    cap.userData.phase = index * 0.7;
    bobbles.push({ post, cap });
  }

  const slashes = [];
  for (let index = 0; index < 4; index += 1) {
    const angle = index / 4 * Math.PI * 2;
    const slash = addMesh(root, new THREE.BoxGeometry(0.62, 0.06, 0.1), pink,
      Math.cos(angle) * 1.64, 0.38, Math.sin(angle) * 1.64);
    slash.rotation.y = -angle;
    slash.rotation.z = index % 2 ? 0.3 : -0.3;
    slashes.push(slash);
  }

  root.userData.setQuality = (profile) => slashes.forEach((slash, index) => {
    slash.visible = profile !== "tiny" || index % 2 === 0;
  });
  root.userData.updateVisual = (time) => {
    inner.rotation.z = time * 0.14;
    bobbles.forEach(({ post, cap }, index) => {
      const bounce = Math.sin(time * 2.25 + index * 1.3) * 0.07;
      post.rotation.z = bounce * 0.25;
      cap.position.y = 0.9 + Math.max(0, Math.sin(time * 2.8 + index * 1.4)) * 0.12;
      cap.scale.set(1 + bounce, 1 - bounce * 0.55, 1 + bounce);
    });
    slashes.forEach((slash, index) => {
      slash.scale.x = 0.86 + Math.sin(time * 3 + index) * 0.14;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

function createToonburst(power) {
  const root = new THREE.Group();
  root.name = "cartoon-toonburst";
  const dark = flatMaterial(CARTOON_DARK, { roughness: 0.9 });
  const yellow = signalMaterial(CARTOON_COLORS[0], 0.94);
  const pink = signalMaterial(CARTOON_COLORS[1], 0.94);
  const blue = signalMaterial(CARTOON_COLORS[2], 0.9);
  const green = signalMaterial(CARTOON_COLORS[3], 0.9);
  const palette = [yellow, pink, blue, green];

  const shadow = addMesh(root, new THREE.CylinderGeometry(0.86, 0.94, 0.08, 10), dark, 0, 0.08, 0);
  const popDisc = addMesh(root, new THREE.CylinderGeometry(0.72, 0.78, 0.1, 10), yellow, 0, 0.16, 0);
  const spikes = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const spike = addMesh(root, new THREE.BoxGeometry(0.58 + (index % 2) * 0.18, 0.07, 0.12), palette[index % palette.length],
      Math.cos(angle) * 1.03, 0.25 + (index % 2) * 0.08, Math.sin(angle) * 1.03);
    spike.rotation.y = -angle;
    spike.rotation.z = index % 2 ? 0.28 : -0.28;
    spikes.push(spike);
  }

  const bubbles = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const bubble = addMesh(root, new THREE.SphereGeometry(0.12 + (index % 3) * 0.025, 6, 5), palette[index % palette.length],
      Math.cos(angle) * 1.34, 0.62 + (index % 2) * 0.22, Math.sin(angle) * 1.34);
    bubble.userData.phase = angle;
    bubbles.push(bubble);
  }

  const crown = addMesh(root, new THREE.OctahedronGeometry(0.3, 0), pink, 0, 1.08, 0);
  const motionLines = Array.from({ length: 4 }, (_, index) => {
    const line = addMesh(root, new THREE.BoxGeometry(0.76, 0.055, 0.08), blue,
      (index - 1.5) * 0.38, 1.3 + (index % 2) * 0.14, -0.12 + index * 0.08);
    line.rotation.z = -0.35 + index * 0.22;
    return line;
  });

  root.userData.setQuality = (profile) => {
    bubbles.forEach((bubble, index) => { bubble.visible = profile !== "tiny" || index % 2 === 0; });
    motionLines.forEach((line, index) => { line.visible = profile !== "tiny" || index < 2; });
  };
  root.userData.updateVisual = (time, state) => {
    const boost = daytimeBoost(state);
    const squash = Math.sin(time * 3.3 + power.score) * 0.085 * boost;
    popDisc.scale.set(1 + squash, 1 - squash * 0.45, 1 + squash);
    shadow.scale.set(1 - squash * 0.2, 1, 1 - squash * 0.2);
    crown.position.y = 1.08 + Math.max(0, Math.sin(time * 4.4)) * 0.22 * boost;
    crown.rotation.y = time * 0.9;
    crown.scale.set(1 + squash, 1 - squash * 0.5, 1 + squash);
    spikes.forEach((spike, index) => {
      spike.scale.x = 0.84 + Math.max(0, Math.sin(time * 4 + index * 0.72)) * 0.3 * boost;
    });
    bubbles.forEach((bubble, index) => {
      const angle = bubble.userData.phase + Math.sin(time * 0.9 + index) * 0.12;
      const radius = 1.28 + Math.sin(time * 1.7 + index) * 0.12;
      bubble.position.x = Math.cos(angle) * radius;
      bubble.position.z = Math.sin(angle) * radius;
      bubble.position.y = 0.62 + (index % 2) * 0.18 + Math.max(0, Math.sin(time * 3.1 + index * 0.8)) * 0.3 * boost;
      const pulse = 0.88 + Math.sin(time * 3.5 + index) * 0.12;
      bubble.scale.setScalar(pulse);
    });
    motionLines.forEach((line, index) => {
      line.position.x = (index - 1.5) * 0.38 + Math.sin(time * 2.4 + index) * 0.08;
      line.scale.x = 0.82 + Math.sin(time * 4.2 + index) * 0.18;
    });
  };
  root.userData.actorCount = actorCount(root);
  return root;
}

/**
 * Additive Cartoon identity layer. It keeps the existing style-fit/superpower
 * planner authoritative and only adds Cartoon-specific presentation. No economy,
 * rating, guest, pathing, research or upgrade state is changed here.
 */
export class WorldRenderer extends StyleSuperpowerWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.cartoonDistrictRoot = new THREE.Group();
    this.cartoonDistrictRoot.name = "bounded-render-only-cartoon-style";
    this.cartoonDistrictRoots = new Map();
    this.globe.root.add(this.cartoonDistrictRoot);
  }

  syncStyleSuperpowers() {
    super.syncStyleSuperpowers();
    if (!this.stylePowerPlan) return;
    for (const power of this.stylePowerPlan) {
      if (power.themeId !== "cartoon" || !power.active) continue;
      const root = this.stylePowerRoots.get(power.districtId);
      if (!root) continue;
      const signature = `${power.id}:${power.stage}:${power.score}:${power.anchors.map((item) => item.entityId).join("|")}`;
      if (root.userData.cartoonSignature === signature) continue;

      const previous = root.userData.cartoonVisual;
      if (previous) {
        root.remove(previous);
        disposeTree(previous);
      }
      const baseUpdate = root.userData.baseCartoonWrapped ? root.userData.baseUpdate : root.userData.updateVisual;
      const baseQuality = root.userData.baseCartoonWrapped ? root.userData.baseQuality : root.userData.setQuality;
      const visual = createToonburst(power);
      root.add(visual);
      root.userData.cartoonVisual = visual;
      root.userData.cartoonSignature = signature;
      root.userData.baseCartoonWrapped = true;
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
    if (!this.state || !this.cartoonDistrictRoot) return;
    this.syncCartoonDistrictFrames();
    this.syncCartoonEntityDressings();
  }

  syncCartoonDistrictFrames() {
    const live = new Set();
    for (const power of (this.stylePowerPlan ?? []).slice(0, CARTOON_ROOT_LIMIT)) {
      if (power.themeId !== "cartoon") continue;
      live.add(power.districtId);
      const signature = `${power.districtId}:${power.themeId}:${power.stage}:${power.score}:${power.center.x.toFixed(2)}:${power.center.z.toFixed(2)}`;
      let root = this.cartoonDistrictRoots.get(power.districtId);
      if (root?.userData.signature === signature) continue;
      if (root) {
        this.cartoonDistrictRoot.remove(root);
        disposeTree(root);
      }
      root = createCartoonDistrictFrame(power);
      root.userData.signature = signature;
      this.globe.placeObject(root, power.center.x, power.center.z, { altitude: 0.34 });
      root.userData.setQuality?.(this.qualityProfile);
      this.cartoonDistrictRoot.add(root);
      this.cartoonDistrictRoots.set(power.districtId, root);
    }
    for (const [districtId, root] of this.cartoonDistrictRoots) {
      if (live.has(districtId)) continue;
      this.cartoonDistrictRoot.remove(root);
      disposeTree(root);
      this.cartoonDistrictRoots.delete(districtId);
    }
  }

  syncCartoonEntityDressings() {
    for (const entity of this.state.world.entities) {
      const model = this.entityModels.get(entity.id);
      if (!model) continue;
      const identity = districtThemeForEntity(this.state, entity);
      const fit = themeFitForEntity(this.state, entity);
      const shouldDress = identity.themeId === "cartoon"
        && !["contrast", "neutral"].includes(fit.status);
      const signature = shouldDress
        ? `${identity.districtId}:${fit.status}:${fit.matchedTags.join("|")}:${entity.catalogId}`
        : "off";

      let root = model.userData.cartoonStyleDressingRoot;
      if (!root) {
        root = new THREE.Group();
        root.name = "cartoon-style-dressing-root";
        model.add(root);
        model.userData.cartoonStyleDressingRoot = root;
      }
      if (root.userData.signature === signature) continue;
      clearChildren(root);
      if (shouldDress) root.add(createCartoonEntityDressing(fit, entity));
      root.userData.signature = signature;
      root.visible = shouldDress;
    }
  }

  setQuality(profile) {
    super.setQuality(profile);
    for (const root of this.cartoonDistrictRoots?.values?.() ?? []) root.userData.setQuality?.(this.qualityProfile);
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    for (const root of this.cartoonDistrictRoots.values()) root.userData.updateVisual?.(time, this.state);
    for (const model of this.entityModels.values()) {
      const root = model.userData.cartoonStyleDressingRoot;
      for (const dressing of root?.children ?? []) dressing.userData.updateVisual?.(time, this.state);
    }
  }

  getVisualHealth() {
    const base = super.getVisualHealth();
    let dressedElements = 0;
    let actorCountTotal = 0;
    for (const root of this.cartoonDistrictRoots.values()) actorCountTotal += root.userData.actorCount ?? 0;
    for (const model of this.entityModels.values()) {
      if (model.userData.cartoonStyleDressingRoot?.visible) dressedElements += 1;
    }
    for (const root of this.stylePowerRoots.values()) {
      if (root.userData.power?.themeId === "cartoon") actorCountTotal += root.userData.actorCount ?? 0;
    }
    return Object.freeze({
      ...base,
      cartoonStyle: Object.freeze({
        presentationOnly: true,
        districtBudget: CARTOON_ROOT_LIMIT,
        styledDistricts: this.cartoonDistrictRoots.size,
        dressedElements,
        actorCount: actorCountTotal,
        powerId: "toonburst"
      })
    });
  }
}
