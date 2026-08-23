import { WorldRenderer as ParkIdentityWorldRenderer } from "./parkIdentityWorldRenderer.js";
import { normalizeDistrictState } from "../core/districts.js";
import { stateHash } from "../core/random.js";

/**
 * State-intake guard for the final presentation stack. New games do not need the
 * preserved simulation to know about style-only district state, while loaded
 * saves are already normalized by save.js. Re-hashing here prevents a renderer
 * default from ever leaving stateHash stale.
 */
export class WorldRenderer extends ParkIdentityWorldRenderer {
  setState(state) {
    normalizeDistrictState(state);
    state.stateHash = stateHash(state);
    super.setState(state);
  }

  cycleSelectedDistrictTheme() {
    if (globalThis.document?.querySelector?.("dialog[open]")) return false;
    return super.cycleSelectedDistrictTheme();
  }
}
