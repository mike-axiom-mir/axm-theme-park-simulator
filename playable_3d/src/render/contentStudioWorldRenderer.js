import { WorldRenderer as StaffAwareWorldRenderer } from "./staffAwareWorldRenderer.js";
import { catalogDefinition, rotatedFootprint } from "../core/catalog.js";
import { WORLD_CONTENT_IDS } from "../core/worldContentCatalog.js";
import { createGalleonModel } from "./extraAttractions.js";
import { createWorldContentModel } from "./worldContentModels.js";

const SPECIAL_ATTRACTION_FACTORIES = Object.freeze({
  galleon: createGalleonModel,
  ...Object.fromEntries(WORLD_CONTENT_IDS.map((id) => [id, createWorldContentModel]))
});

/**
 * Additive content seam for rides, attractions, facilities and stores that have
 * dedicated models outside the preserved v0.4.6 models.js file. Simulation and
 * catalog authority remain in core; this layer only swaps render models for
 * explicitly registered ids.
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
