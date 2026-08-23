import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as BaseWorldRenderer } from "./worldRenderer.js";
import { guestSignalFor } from "../presentation/guestSignals.js";
import {
  deriveGuestBodyLanguage, describeGuestBodyLanguage
} from "../presentation/guestBodyLanguage.js";

export const PARK_VISION_MARKER_LIMIT = 40;
export const PARK_VISION_MODES = Object.freeze(["off", "guests", "queues", "needs", "operations"]);

const PARK_VISION_LABELS = Object.freeze({
  off: "Off",
  guests: "Crowd flow",
  queues: "Queue pressure",
  needs: "Guest needs",
  operations: "Operations"
});

const VISION_COLORS = Object.freeze({
  guest: 0x65bed1,
  queue: 0xf0c766,
  comfort: 0x75d5ad,
  drink: 0x65bed1,
  snack: 0xf0a85f,
  rest: 0xb8a7ea,
  wait: 0xe86d77,
  condition: 0xe86d77,
  litter: 0xf0c766
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function stableRank(value) {
  let hash = 2166136261;
  for (const char of String(value ?? "vision")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function freezeMarker(marker) {
  return Object.freeze({ ...marker, severity: clamp(finite(marker.severity)) });
}

export function parkVisionStatus(mode = "off", markerCount = 0) {
  const safeMode = PARK_VISION_MODES.includes(mode) ? mode : "off";
  return Object.freeze({
    mode: safeMode,
    label: PARK_VISION_LABELS[safeMode],
    active: safeMode !== "off",
    markerCount: Math.max(0, Math.floor(finite(markerCount)))
  });
}

export function nextParkVisionMode(mode = "off") {
  const index = Math.max(0, PARK_VISION_MODES.indexOf(mode));
  return PARK_VISION_MODES[(index + 1) % PARK_VISION_MODES.length];
}

/** Deterministic, bounded projection of committed park state for management viewing only. */
export function deriveParkVisionPlan(state, mode = "off") {
  const safeMode = PARK_VISION_MODES.includes(mode) ? mode : "off";
  const markers = [];
  const visitors = state?.visitors ?? [];
  const entities = state?.world?.entities ?? [];

  if (safeMode === "guests") {
    for (const visitor of visitors) {
      const stateWeight = visitor.state === "queueing" ? 0.82
        : visitor.state === "walking" ? 0.62
          : visitor.state === "leaving" ? 0.34 : 0.48;
      markers.push(freezeMarker({
        id: `guest:${visitor.id}`,
        target: "visitor",
        targetId: visitor.id,
        kind: "guest",
        severity: stateWeight,
        rank: stableRank(visitor.id)
      }));
    }
    markers.sort((left, right) => left.rank - right.rank || left.id.localeCompare(right.id));
  } else if (safeMode === "queues") {
    for (const entity of entities) {
      const capacity = Math.max(0, Math.floor(finite(entity.queueCapacity)));
      if (!capacity) continue;
      const queueLength = Math.max(0, entity.queue?.length ?? 0);
      const wait = Math.max(0, finite(entity.queueWaitMinutes));
      if (!queueLength && wait <= 0) continue;
      markers.push(freezeMarker({
        id: `queue:${entity.id}`,
        target: "cell",
        cell: entity.accessCell ?? [entity.x, entity.z],
        kind: "queue",
        severity: Math.max(wait / 48, queueLength / Math.max(1, capacity)),
        rank: stableRank(entity.id)
      }));
    }
    markers.sort((left, right) => right.severity - left.severity || left.id.localeCompare(right.id));
  } else if (safeMode === "needs") {
    for (const visitor of visitors) {
      const signal = guestSignalFor(visitor);
      if (!signal) continue;
      markers.push(freezeMarker({
        id: `need:${visitor.id}`,
        target: "visitor",
        targetId: visitor.id,
        kind: signal.type,
        severity: signal.urgency,
        rank: stableRank(visitor.id)
      }));
    }
    markers.sort((left, right) => right.severity - left.severity || left.id.localeCompare(right.id));
  } else if (safeMode === "operations") {
    for (const entity of entities) {
      const condition = clamp(finite(entity.condition, 100), 0, 100);
      if (condition >= 92) continue;
      markers.push(freezeMarker({
        id: `condition:${entity.id}`,
        target: "cell",
        cell: entity.accessCell ?? [entity.x, entity.z],
        kind: "condition",
        severity: (100 - condition) / 45,
        rank: stableRank(entity.id)
      }));
    }
    for (const pile of state?.world?.litter ?? []) {
      markers.push(freezeMarker({
        id: `litter:${pile.id}`,
        target: "cell",
        cell: pile.cell,
        kind: "litter",
        severity: finite(pile.amount, 1) / 4,
        rank: stableRank(pile.id)
      }));
    }
    markers.sort((left, right) => right.severity - left.severity || left.id.localeCompare(right.id));
  }

  const bounded = Object.freeze(markers.slice(0, PARK_VISION_MARKER_LIMIT));
  return Object.freeze({
    ...parkVisionStatus(safeMode, bounded.length),
    markers: bounded
  });
}

function visitorPhase(visitorId) {
  const text = String(visitorId ?? "guest");
  let value = 0;
  for (let index = 0; index < text.length; index += 1) value = (value * 31 + text.charCodeAt(index)) >>> 0;
  return (value % 997) / 997 * Math.PI * 2;
}

function applyGuestBodyLanguage(model, visitor, time) {
  const parts = model?.userData?.personParts ?? {};
  const [armLeft, armRight] = model?.userData?.arms ?? [];
  if (!parts.torso || !parts.head) return;

  parts.torso.rotation.x = 0;
  parts.torso.rotation.z = 0;
  parts.head.rotation.x = 0;
  parts.head.rotation.z = 0;

  const descriptor = deriveGuestBodyLanguage(visitor);
  const amount = descriptor.intensity;
  const phase = visitorPhase(visitor.id);

  if (descriptor.pose === "impatient") {
    const shift = Math.sin(time * 4.4 + phase);
    parts.torso.rotation.z = shift * 0.035 * amount;
    parts.head.rotation.z = -shift * 0.12 * amount;
    if (armLeft && armRight) {
      armLeft.rotation.x = -0.12 - shift * 0.18 * amount;
      armRight.rotation.x = -0.12 + shift * 0.18 * amount;
    }
  } else if (descriptor.pose === "tired") {
    const breath = Math.sin(time * 1.7 + phase);
    parts.torso.rotation.x = 0.12 + 0.12 * amount;
    parts.head.rotation.x = 0.12 + 0.16 * amount;
    parts.head.position.y -= 0.04 + 0.06 * amount + breath * 0.012;
    if (armLeft && armRight) {
      armLeft.rotation.x = 0.13 + breath * 0.025;
      armRight.rotation.x = 0.13 - breath * 0.025;
    }
  } else if (descriptor.pose === "disappointed") {
    parts.torso.rotation.x = 0.05 + 0.06 * amount;
    parts.head.rotation.x = 0.12 + 0.12 * amount;
    parts.head.rotation.z = Math.sin(time * 1.15 + phase) * 0.025 * amount;
    if (armLeft && armRight) {
      armLeft.rotation.x = 0.08;
      armRight.rotation.x = 0.08;
    }
  }

  model.userData.guestBodyLanguage = descriptor;
}

/**
 * Presentation-only extension. Authoritative visitor state remains owned by the
 * base renderer's state reference and simulation; this class only alters meshes,
 * bounded management overlays, and explanatory UI output.
 */
export class WorldRenderer extends BaseWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    this.parkVisionMode = "off";
    this.parkVisionMarkerCount = 0;
    this.parkVisionRoot = new THREE.Group();
    this.parkVisionRoot.name = "park-vision-render-only-overlay";
    this.globe.root.add(this.parkVisionRoot);
    const geometry = new THREE.RingGeometry(0.52, 1, 16);
    this.parkVisionMarkers = Array.from({ length: PARK_VISION_MARKER_LIMIT }, (_, index) => {
      const marker = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: VISION_COLORS.guest,
        transparent: true,
        opacity: 0.52,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide
      }));
      marker.name = `park-vision-marker-${index}`;
      marker.renderOrder = 35;
      marker.visible = false;
      this.parkVisionRoot.add(marker);
      return marker;
    });
  }

  setParkVision(mode = "off") {
    this.parkVisionMode = PARK_VISION_MODES.includes(mode) ? mode : "off";
    if (this.parkVisionMode === "off") {
      this.parkVisionMarkerCount = 0;
      for (const marker of this.parkVisionMarkers) marker.visible = false;
    }
    return this.getParkVisionStatus();
  }

  cycleParkVision() {
    return this.setParkVision(nextParkVisionMode(this.parkVisionMode));
  }

  getParkVisionStatus() {
    return parkVisionStatus(this.parkVisionMode, this.parkVisionMarkerCount);
  }

  getVisualHealth() {
    return Object.freeze({
      ...super.getVisualHealth(),
      parkVision: this.getParkVisionStatus()
    });
  }

  selectVisitor(visitorId) {
    super.selectVisitor(visitorId);
    if (!visitorId || !this.state) return;
    const visitor = this.state.visitors.find((item) => item.id === visitorId);
    if (!visitor) return;
    const cue = describeGuestBodyLanguage(visitor);
    const strength = cue.pose === "neutral" ? "" : ` · ${cue.strength}%`;
    this.callbacks.onWorldMessage?.(`Body language: ${cue.label} · ${cue.reason}${strength}`);
  }

  syncVisitors(time) {
    super.syncVisitors(time);
    if (!this.state) return;
    for (const visitor of this.state.visitors.slice(0, 90)) {
      const model = this.visitorModels.get(visitor.id);
      if (!model?.visible) continue;
      applyGuestBodyLanguage(model, visitor, time);
    }
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    this.syncParkVision(time);
  }

  syncParkVision(time) {
    if (!this.state || this.mode !== "manage" || this.parkVisionMode === "off") {
      this.parkVisionMarkerCount = 0;
      for (const marker of this.parkVisionMarkers) marker.visible = false;
      return;
    }
    const plan = deriveParkVisionPlan(this.state, this.parkVisionMode);
    this.parkVisionMarkerCount = plan.markerCount;
    for (let index = 0; index < this.parkVisionMarkers.length; index += 1) {
      const mesh = this.parkVisionMarkers[index];
      const descriptor = plan.markers[index];
      if (!descriptor) {
        mesh.visible = false;
        continue;
      }
      let frame = null;
      if (descriptor.target === "visitor") {
        const local = this.visitorModels.get(descriptor.targetId)?.userData?.localPosition;
        if (local) frame = this.globe.frameAtLocal(local.x, local.z, 0.34);
      } else if (descriptor.target === "cell" && descriptor.cell) {
        frame = this.globe.frameAtGrid(descriptor.cell[0], descriptor.cell[1], 1, 1, 0.34);
      }
      if (!frame) {
        mesh.visible = false;
        continue;
      }
      const pulse = 1 + Math.sin(time * (2.2 + descriptor.severity * 1.8) + descriptor.rank % 17) * 0.08;
      const scale = (0.78 + descriptor.severity * 1.1) * pulse;
      mesh.position.copy(frame.position);
      mesh.quaternion.copy(frame.quaternion);
      mesh.rotateX(-Math.PI / 2);
      mesh.scale.setScalar(scale);
      mesh.material.color.setHex(VISION_COLORS[descriptor.kind] ?? VISION_COLORS.guest);
      mesh.material.opacity = 0.3 + descriptor.severity * 0.38;
      mesh.visible = true;
    }
  }
}
