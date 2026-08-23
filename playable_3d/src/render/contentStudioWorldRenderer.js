import { WorldRenderer as StaffAwareWorldRenderer } from "./staffAwareWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { createGalleonModel } from "./extraAttractions.js";

const SPECIAL_ATTRACTION_FACTORIES = Object.freeze({
  galleon: createGalleonModel
});

/**
 * Additive content seam for rides that have dedicated models outside the
 * preserved v0.4.6 models.js file. Simulation/catalog authority remains in the
 * existing core; this layer only swaps the renderer model for known ids.
 */
export class WorldRenderer extends StaffAwareWorldRenderer {
  syncWorld() {
    super.syncWorld();
    if (!this.state) return;

    let replaced = false;
    for (const entity of this.state.world.entities) {
      const factory = SPECIAL_ATTRACTION_FACTORIES[entity.catalogId];
      if (!factory) continue;
      const current = this.entityModels.get(entity.id);
      if (current?.userData?.specialAttractionId === entity.catalogId) continue;

      if (current) this.globe.root.remove(current);
      const model = factory(entity);
      const definition = catalogDefinition(entity.catalogId);
      const [width, depth] = rotatedFootprint(definition, entity.rotation);
      this.globe.placeObject(model, entity.x, entity.z, {
        width, depth, altitude: 0.18, rotation: entity.rotation
      });
      this.globe.root.add(model);
      this.entityModels.set(entity.id, model);
      replaced = true;
    }

    if (replaced && this.selectedEntityId) this.selectEntity(this.selectedEntityId);
  }
}
