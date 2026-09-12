# Stewardship — Fantasy District Style

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass adds **Fantasy** as a first-class district identity on top of the existing district fit + Style Superpower architecture.

Fantasy is intentionally distinct from Storybook and Cartoon:

- Storybook remains fairytale / lantern / family-story framing;
- Cartoon remains chunky, comic, toy-like and exaggerated;
- Fantasy uses enchanted ruins, crystals, runes, moonlit growth, wisps and magical scenic landmarks.

## District identity

The style cycle is now:

1. Neutral
2. Garden
3. Adventure
4. Storybook
5. Cartoon
6. Fantasy
7. Future
8. Waterfront

Fantasy preferred fit vocabulary:

- fantasy;
- scenic;
- storybook;
- garden;
- indoor;
- adventure;
- water.

`fantasy` is a derived evidence tag, not a second catalog. Existing content earns it when its existing style evidence already reads as magical/place-driven, for example:

- Storybook + scenic;
- Storybook + indoor;
- Storybook + garden/adventure/water;
- Garden + Adventure + Scenic.

Representative current anchors include Lantern Labyrinth, Lantern Canal Cruise and Cascade Garden.

Bumble Buggies does not suddenly become Fantasy just because Fantasy exists.

## Baseline Fantasy presentation

A Fantasy district receives bounded presentation even before its superpower is charged:

- broken stone-ring framing;
- hovering rune ring;
- moss/root fragments;
- four low-poly monoliths;
- floating crystal nodes;
- orbiting rune shards.

The baseline reacts visually to dusk/night and rain but changes no simulation values.

## Matching attraction dressing

Signature / Strong / Compatible elements inside Fantasy districts receive small local dressing:

- stone dais;
- small rune ring;
- crystal cluster;
- orbiting wisps;
- restrained violet / aether / gold palette.

Added meshes keep the original entity id for normal picking/selectability.

Neutral and Style Contrast elements remain undressed so deliberate mismatches preserve their identity.

## Fantasy Style Superpower — Aetherveil

Fantasy joins the existing presentation-only Style Superpower planner.

**Aetherveil** uses the same charge rules as every style:

- Signature = 3;
- Strong = 2;
- Compatible = 1;
- Neutral / Contrast = 0.

Stages remain:

- Dormant;
- Awakening;
- Charged;
- Unleashed.

Two Signature anchors such as Lantern Labyrinth + Lantern Canal Cruise can therefore unleash Aetherveil.

Aetherveil presentation includes:

- dark stone dais;
- three counter-rotating arcane rings;
- six orbiting crystal spires;
- eight drifting wisps;
- five floating rune fragments;
- dusk/night/rain presentation amplification.

The animation is time-based and frame-stable. A review caught and repaired an additive crystal-bobbing drift before checkpointing the pass.

## Performance boundaries

Fantasy remains bounded:

- maximum 4 district identity roots because the park has four districts;
- existing Style Superpower visual budget remains 4 districts;
- existing anchor budget remains 6 anchors per district;
- fixed low-poly actor counts;
- Tiny quality hides part of optional rune/wisp/ring actors;
- no particle emitter or unbounded spawn loop.

Diagnostics expose `bounded-render-only-fantasy-style` and Fantasy actor counts through visual health.

## Architecture

Updated presentation chain:

```text
preserved simulation
  -> research/growth runtime
    -> installed-upgrade runtime
      -> expressive / staff / special-content layers
        -> park identity
          -> theme-fit / Waterfront identity
            -> Style Superpowers
              -> Cartoon identity + Toonburst
                -> Fantasy identity + Aetherveil
                  -> district normalization/state-hash guard
                    -> stable contentStudioWorldRenderer seam
```

New renderer:

`playable_3d/src/render/fantasyStyleWorldRenderer.js`

`stateSafeParkIdentityWorldRenderer.js` now extends that final additive layer.

## Authority boundary

Fantasy currently changes **presentation only**.

It does not change:

- build legality;
- attraction stats;
- cash;
- prices;
- revenue;
- park rating;
- visitor motives/happiness;
- queue/cycle behavior;
- pathfinding;
- staff behavior;
- research;
- upgrades;
- save schema.

District style choice persists through the existing district state in normal saves. No save-version bump is required.

## Focused proof

Added/updated:

- `playable_3d/tests/fantasy-style.test.js`
- `playable_3d/tests/cartoon-style.test.js`
- `playable_3d/tests/style-superpowers.test.js`

Coverage includes:

- Fantasy exists between Cartoon and Future in the style cycle;
- Fantasy tags derive from existing catalog evidence;
- normal playful Cartoon content is not blindly tagged Fantasy;
- Fantasy style selection changes no cash/rating/visitor values;
- Fantasy persists through current save serialization;
- two Signature anchors unleash Aetherveil;
- Fantasy renderer remains additive and bounded;
- Cartoon remains underneath Fantasy rather than being replaced;
- final state guard routes through Fantasy;
- preserved simulation stays unaware of Aetherveil/render-only Fantasy objects.

## Verification truth boundary

This connected GitHub seat can inspect and mutate source but is not the trusted local Node/WebGL/build environment.

Status remains:

**SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

`dist/game.js` remains intentionally untouched.

Later local intake should inspect especially:

- crystal/rune scale against very small and large attraction models;
- whether Fantasy is visually distinct enough from Storybook at a glance;
- dusk/night glow readability in Retro quality;
- rain amplification without visual clutter;
- Aetherveil at Awakening vs Charged vs Unleashed;
- Tiny/Retro/Crisp actor budgets;
- raycast/selectability through added dressing meshes;
- four simultaneous styled districts in a large park;
- mobile performance and top-bar crowding.
