import { WorldRenderer as ExpressiveWorldRenderer } from "./expressiveWorldRenderer.js";
import { getStaffInsight } from "../core/staff.js";

/**
 * Thin playable control layer over the expressive renderer. Staff development
 * remains authoritative in core/staff.js; this class only requests actions and
 * explains the selected crew member's current development state.
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
}
