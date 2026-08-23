import * as THREE from "../../vendor/three.module.min.js";
import { WorldRenderer as ExpressiveWorldRenderer } from "./expressiveWorldRenderer.js";
import { getStaffInsight } from "../core/staff.js";

const ZONE_COLORS = Object.freeze({
  all: 0xf0c766,
  north: 0x65bed1,
  east: 0x75d5ad,
  south: 0xe987a8,
  west: 0xb8a7ea
});

function ensureDevelopmentVisual(model) {
  if (model.userData.staffDevelopmentVisual) return model.userData.staffDevelopmentVisual;
  const root = new THREE.Group();
  root.name = "staff-development-visual";
  root.position.y = 2.26;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.52, 12),
    new THREE.MeshBasicMaterial({
      color: ZONE_COLORS.all,
      transparent: true,
      opacity: 0.62,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 37;
  root.add(ring);

  const pips = [];
  for (let index = 0; index < 3; index += 1) {
    const pip = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.09, 0),
      new THREE.MeshBasicMaterial({ color: 0xf4df91, transparent: true, opacity: 0.9, depthTest: false })
    );
    pip.position.set((index - 1) * 0.24, 0.22, 0);
    pip.renderOrder = 38;
    root.add(pip);
    pips.push(pip);
  }

  model.add(root);
  model.userData.staffDevelopmentVisual = { root, ring, pips };
  return model.userData.staffDevelopmentVisual;
}

/**
 * Thin playable control layer over the expressive renderer. Staff development
 * remains authoritative in core/staff.js; this class only requests actions and
 * explains/renders the selected crew member's current development state.
 */
export class WorldRenderer extends ExpressiveWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    addEventListener("keydown", (event) => {
      if (this.mode !== "manage") return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      if (!this.selectedStaffId) {
        if (["KeyT", "KeyZ"].includes(event.code)) {
          this.callbacks.onWorldMessage?.("Select a crew member first · T trains · Z changes work zone.");
        }
        return;
      }
      if (event.code === "KeyT") {
        this.callbacks.onStaffDevelopment?.({ type: "trainStaff", staffId: this.selectedStaffId });
      } else if (event.code === "KeyZ") {
        this.callbacks.onStaffDevelopment?.({ type: "cycleStaffZone", staffId: this.selectedStaffId });
      }
    });
  }

  selectStaff(staffId) {
    super.selectStaff(staffId);
    if (!staffId || !this.state) return;
    const insight = getStaffInsight(this.state, staffId);
    if (!insight) return;
    const training = insight.training;
    const nextCost = training.nextTrainingCost === null ? "max training" : `next training €${training.nextTrainingCost}`;
    this.callbacks.onWorldMessage?.(
      `Crew: L${training.level}/3 · ${insight.zoneLabel} · ${nextCost} · T train · Z zone`
    );
  }

  syncStaffAndLitter(time) {
    super.syncStaffAndLitter(time);
    if (!this.state) return;
    for (const agent of this.state.staffAgents ?? []) {
      const model = this.staffModels.get(agent.id);
      if (!model) continue;
      const insight = getStaffInsight(this.state, agent.id);
      if (!insight) continue;
      const visual = ensureDevelopmentVisual(model);
      const working = agent.state === "walking-to-litter" || agent.state === "walking-to-ride" || agent.cooldown > 0;
      visual.ring.material.color.setHex(ZONE_COLORS[agent.zone] ?? ZONE_COLORS.all);
      visual.ring.material.opacity = agent.zone === "all" ? 0.38 : 0.66;
      visual.ring.scale.setScalar(0.94 + Math.sin(time * (working ? 5.2 : 1.8) + agent.trainingLevel) * 0.07);
      visual.pips.forEach((pip, index) => {
        pip.visible = index < insight.training.level;
        pip.position.y = 0.22 + Math.sin(time * 2.6 + index * 1.4) * 0.025;
      });
      visual.root.visible = agent.zone !== "all" || insight.training.level > 0 || agent.id === this.selectedStaffId;
    }
  }
}
