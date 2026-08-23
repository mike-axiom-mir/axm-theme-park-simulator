# Small Living Globe source trace

Mike directed this playable theme-park branch to reuse the small AXM planet on
GitHub, explicitly excluding the large Foundation Planet.

## Selected source

- Repository: `mike-axiom-mir/axm-collaboration-platform`
- Commit inspected: `a4f99fbfc05268173458bf3fb8f3fe616919e376`
- World: `world.grafthold.globe` / AXM Living Globe
- Primary source: `worlds/living-globe/index.html`
- World manifest: `worlds/living-globe/world.manifest.json`
- Source status at that commit: WORKING TEST

The large sibling `worlds/foundation-planet` (Caelus) was inspected only enough to
verify that it was the explicitly excluded Earth-scale world. None of its deep
physical/ecological model was imported.

## Adapted organs

- a walkable spherical surface with local tangent frames;
- seeded faceted planet colour;
- orbiting sun and moon with a real globe terminator;
- seeded local star field;
- local/offline Three.js rendering;
- the ownership boundary that games attach without owning or resetting world
  state.

The theme-park branch uses an additive `LivingGlobeAdapter`. It owns transforms,
light, and presentation only. The deterministic park simulation remains separate.
No GitHub file was changed, and no claim is made that this is the canonical Living
Globe runtime.
