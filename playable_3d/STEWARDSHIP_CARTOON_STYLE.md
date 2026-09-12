# Stewardship — Cartoon District Style

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass adds **Cartoon** as a first-class district identity on top of the existing district fit + Style Superpower architecture.

It is intentionally not a renamed Storybook skin. Storybook remains fairytale/lantern/indoor-story oriented; Cartoon is about chunky toy silhouettes, bright comic accents, exaggerated squash/stretch motion, friendly arcade energy and visibly playful animation.

## District identity

The district style cycle is now:

1. Neutral
2. Garden
3. Adventure
4. Storybook
5. Cartoon
6. Future
7. Waterfront

Cartoon uses existing content evidence rather than inventing a second catalog or mandatory Cartoon-only buildables.

Preferred fit vocabulary:

- family;
- thrill;
- future;
- storybook;
- food;
- retail;
- scenic.

Family is its signature anchor. Existing playful content such as Bumble Buggies, Cloud Hop and Twirly Tea Garden therefore fits Cartoon naturally through the same explainable theme-fit evaluator already used by every other district.

No attraction becomes illegal in Cartoon. Style Contrast remains allowed.

## Baseline Cartoon presentation

A Cartoon district receives a small bounded visual identity even before its superpower is charged:

- thick dark + bright low-poly ground rings;
- chunky bobble posts;
- bouncing colored caps;
- animated comic motion slashes;
- deliberately simple yellow / pink / cyan / green toy palette.

This keeps a newly selected Cartoon district visibly different before the player has built enough matching content to wake the larger spectacle.

## Matching-attraction dressing

Signature / Strong / Compatible elements inside Cartoon districts receive small local dressing rather than a giant icon:

- dark outline-like ring;
- bright inner halo;
- bouncing colored dots;
- rotating pop gem;
- compact comic slash;
- squash/stretch motion.

The dressing is attached to the existing entity model and every child is marked with the original entity id so added meshes should remain selectable through the normal world picking path.

Contrast and Neutral-fit elements are left alone so deliberate mismatches keep their own identity.

## Cartoon Style Superpower — Toonburst

Cartoon joins the existing presentation-only Style Superpower planner.

**Toonburst** uses the same charge rules as every other style:

- Signature = 3;
- Strong = 2;
- Compatible = 1;
- Neutral / Contrast = 0.

Stages remain:

- Dormant;
- Awakening;
- Charged;
- Unleashed.

Two signature playful anchors such as Bumble Buggies + Cloud Hop can therefore unleash Toonburst.

Toonburst presentation includes:

- chunky central pop disc;
- comic burst spikes;
- orbiting/bouncing color bubbles;
- crown gem;
- animated motion lines;
- deliberate squash/stretch rhythm.

Daytime (09:00-18:00 park clock) gives Toonburst a small presentation-speed/intensity lift only. It does not alter simulation values.

## Performance boundaries

Cartoon remains bounded:

- at most 4 district identity roots because the park has four districts;
- fixed low-poly actor counts;
- existing Style Superpower anchor budget remains 6 per district;
- Tiny quality hides half of optional comic slashes/bubbles/motion lines;
- no particle emitter or unbounded spawn loop.

Diagnostics expose `bounded-render-only-cartoon-style` and Cartoon actor counts through visual health.

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
              -> Cartoon identity + Toonburst presentation
                -> district normalization/state-hash guard
                  -> stable contentStudioWorldRenderer seam
```

The new renderer is:

`playable_3d/src/render/cartoonStyleWorldRenderer.js`

`stateSafeParkIdentityWorldRenderer.js` now extends that final additive layer.

## Authority boundary

Cartoon currently changes **presentation only**.

It does not change:

- build legality;
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

District style selection continues to persist through the existing district state inside normal saves. No save-version bump is required.

## Focused proof

Added/updated:

- `playable_3d/tests/cartoon-style.test.js`
- `playable_3d/tests/style-superpowers.test.js`

Coverage includes:

- Cartoon exists between Storybook and Future in the cycle;
- current playful rides become Signature fits through existing theme evidence;
- Cartoon style changes no cash/rating/visitor values;
- Cartoon persists through current save serialization;
- two Signature anchors unleash Toonburst;
- renderer remains additive and bounded;
- final state guard routes through Cartoon;
- preserved simulation remains unaware of Toonburst/render-only Cartoon objects.

## Verification truth boundary

This connected GitHub seat can review and mutate source, but it is not the trusted local build/WebGL environment.

Status therefore remains:

**SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

`dist/game.js` remains untouched.

Later local intake should inspect especially:

- readability of the bright Cartoon palette next to existing PS1/16-bit-ish visuals;
- whether dark rings read as intentional comic outlines rather than clutter;
- local dressing placement on very small/large models;
- raycast/selectability through added dressing meshes;
- squash/stretch speed on phone screens;
- Toonburst at Awakening vs Charged vs Unleashed;
- Tiny/Retro/Crisp actor budgets;
- top-bar crowding with Fit + Power + District Style controls;
- four simultaneous styled districts in a large park.
