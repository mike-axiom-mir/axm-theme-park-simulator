/**
 * Stable final-style seam.
 *
 * New presentation-only district styles should extend the current final style
 * renderer and this file should be the only routing seam that needs to move.
 * The state-integrity guard can therefore remain stable while the style stack
 * grows underneath it.
 */
export { WorldRenderer } from "./gildedStyleWorldRenderer.js";
