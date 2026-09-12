/**
 * Stable final-style seam.
 *
 * New presentation-only district styles and persistent Legacy style upgrades
 * should extend underneath this seam. The state-integrity guard therefore stays
 * stable while the presentation stack grows.
 */
export { WorldRenderer } from "./legacyStyleUpgradeWorldRenderer.js";
