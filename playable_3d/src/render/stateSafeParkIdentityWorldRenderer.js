import { WorldRenderer as CartoonStyleWorldRenderer } from "./cartoonStyleWorldRenderer.js";
import { normalizeDistrictState } from "../core/districts.js";
import { stateHash } from "../core/random.js";

/**
 * State-intake guard for the final presentation stack. New games do not need the
 * preserved simulation to know about style-only district state, while loaded
 * saves are already normalized by save.js. Re-hashing here prevents a renderer
 * default from ever leaving stateHash stale.
 */
export class WorldRenderer extends CartoonStyleWorldRenderer {
  constructor(canvas, callbacks = {}) {
    super(canvas, callbacks);
    const documentRef = globalThis.document;
    this.districtStyleButton = documentRef?.getElementById?.("district-style-button") ?? null;
    if (!this.districtStyleButton && documentRef?.createElement) {
      const button = documentRef.createElement("button");
      button.id = "district-style-button";
      button.type = "button";
      button.textContent = "District Style";
      button.title = "Select a park element, then cycle the style of its district (Y)";
      button.disabled = true;
      button.addEventListener("click", () => this.cycleSelectedDistrictTheme());
      documentRef.querySelector?.(".top-actions")?.prepend(button);
      this.districtStyleButton = button;
    }
    this.syncDistrictStyleButton();
  }

  syncDistrictStyleButton() {
    if (this.districtStyleButton) this.districtStyleButton.disabled = !this.selectedEntityId;
  }

  setState(state) {
    normalizeDistrictState(state);
    state.stateHash = stateHash(state);
    super.setState(state);
    this.syncDistrictStyleButton();
  }

  selectEntity(entityId) {
    super.selectEntity(entityId);
    this.syncDistrictStyleButton();
  }

  selectVisitor(visitorId) {
    super.selectVisitor(visitorId);
    this.syncDistrictStyleButton();
  }

  selectStaff(staffId) {
    super.selectStaff(staffId);
    this.syncDistrictStyleButton();
  }

  setBuildTool(...args) {
    const result = super.setBuildTool(...args);
    this.syncDistrictStyleButton();
    return result;
  }

  setRemovePathTool(...args) {
    const result = super.setRemovePathTool(...args);
    this.syncDistrictStyleButton();
    return result;
  }

  cycleSelectedDistrictTheme() {
    if (globalThis.document?.querySelector?.("dialog[open]")) return false;
    return super.cycleSelectedDistrictTheme();
  }
}
