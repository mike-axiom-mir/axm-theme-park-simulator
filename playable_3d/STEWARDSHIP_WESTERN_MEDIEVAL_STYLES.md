# Stewardship — Western + Medieval District Styles

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass adds two first-class district identities to the existing style-fit + Style Superpower stack:

- **Western** — timber storefronts, rail details, wagon-wheel motion, dusty trails, lanterns and water-tower/frontier presentation;
- **Medieval** — stone keeps, timber market details, towers, banners, courtyards and torchlight.

They remain separate from Adventure, Storybook and Fantasy. A single attraction may legitimately fit more than one style when its existing evidence supports several readings, but the resulting presentation language and superpower are different.

## Current district style cycle

1. Neutral
2. Garden
3. Adventure
4. Storybook
5. Cartoon
6. Fantasy
7. Western
8. Medieval
9. Future
10. Waterfront

No save-version bump is required. Existing district normalization accepts the new theme ids and older saves still default missing/unknown district themes safely.

## Western fit

Western uses existing catalog evidence rather than a parallel content catalog.

`western` is derived when:

- the visual family is `train`; or
- a river-themed element already combines Adventure + Scenic with Family or Thrill evidence.

This makes existing content such as:

- Little Loop Railway;
- Timber Tumble;
- other suitable river/rail content

natural Western anchors.

Food and retail remain preferred supporting categories but do not automatically become Western signature anchors merely because they sell something.

## Western presentation

Baseline Western districts receive bounded presentation even before the power is active:

- timber trail rings;
- rotating wagon-wheel details;
- compact water-tower silhouette;
- lantern/beacon pulse;
- one bounded tumbleweed actor;
- dust-toned inner ring.

Matching attractions receive small local dressing:

- timber base;
- wagon wheel;
- post + swinging sign;
- lantern pulse.

Added meshes keep the original entity id for normal picking/selectability.

### Western superpower — Frontier Rush

Same shared charge model:

- Signature = 3;
- Strong = 2;
- Compatible = 1;
- Neutral / Contrast = 0.

Stages stay Dormant / Awakening / Charged / Unleashed.

Two signature anchors such as Little Loop Railway + Timber Tumble can unleash **Frontier Rush**.

Frontier Rush includes:

- central wagon-wheel movement;
- six lantern nodes;
- bounded dust motes;
- timber/brass/red sign language;
- warm late-afternoon and bright-weather presentation boost.

Weather/time effects remain visual only.

## Medieval fit

`medieval` is derived from combined existing Storybook evidence with either:

- Indoor; or
- Adventure.

This intentionally allows content such as Lantern Labyrinth or Lantern Canal Cruise to become Medieval anchors without declaring every family ride Medieval.

The overlap with Fantasy is deliberate: a story attraction can be framed as enchanted Fantasy or grounded Medieval depending on the player's district choice. The rendering language is different.

## Medieval presentation

Baseline Medieval districts receive:

- stone courtyard rings;
- four compact tower silhouettes;
- alternating banners;
- timber banner masts;
- torch nodes.

Matching attractions receive:

- stone dais;
- small arch framing;
- timber mast;
- banner;
- torch pulse.

### Medieval superpower — Bannerwake

Bannerwake uses the same shared charge/stage system.

Two signature anchors such as Lantern Labyrinth + Lantern Canal Cruise can unleash **Bannerwake**.

Presentation includes:

- central keep silhouette;
- rotating crown/courtyard ring;
- six banner masts;
- six torch nodes;
- eight bounded rising light motes;
- stronger evening/night/cloudy torch presentation.

No weapons, combat or siege simulation is introduced by this style pass. The goal is a theme-park Medieval district rather than a warfare system.

## Stable final-style seam

This pass adds:

`playable_3d/src/render/finalStyleWorldRenderer.js`

The state-integrity guard now imports this stable seam instead of a specific style renderer. New presentation-only styles can extend the current final renderer and only move this small routing seam, avoiding repeated rewrites of the hash/normalization guard.

Current presentation chain at this head:

```text
preserved simulation
  -> research/growth runtime
    -> installed-upgrade runtime
      -> expressive / staff / special-content presentation
        -> park identity + theme fit
          -> Style Superpowers
            -> Cartoon
              -> Fantasy
                -> Western
                  -> Medieval
                    -> finalStyleWorldRenderer seam
                      -> district normalization/state-hash guard
                        -> stable contentStudioWorldRenderer import
```

Earlier stewardship receipts remain historical checkpoint records; this receipt describes the current final presentation position for this head.

## Authority boundary

Western and Medieval currently change **presentation only**.

They do not change:

- build legality;
- cash;
- prices;
- revenue;
- park rating;
- guest motives/happiness;
- queue/cycle behavior;
- pathfinding;
- staff behavior;
- research;
- upgrades;
- save schema.

## Bounded rendering

Both styles use:

- maximum 4 district identity roots because the park has four districts;
- existing Style Superpower anchor budget of 6 per district;
- fixed low-poly actor counts;
- no unbounded particle emitters or spawn loops;
- Tiny quality reduction for optional Frontier Rush dust actors and Bannerwake motes through the superpower visuals.

Diagnostics expose:

- `bounded-render-only-western-style`;
- `bounded-render-only-medieval-style`;
- per-style actor counts through visual health.

## Focused proof

Added/updated:

- `playable_3d/tests/western-medieval-styles.test.js`
- `playable_3d/tests/style-superpowers.test.js`
- `playable_3d/tests/cartoon-style.test.js`
- `playable_3d/tests/fantasy-style.test.js`

Coverage includes:

- exact Western/Medieval position in the style cycle;
- derived Western rail/river evidence;
- derived Medieval story/indoor/adventure evidence;
- rejection of unrelated Bumble Buggies as a Western/Medieval signature tag;
- presentation-only style mutation;
- save round-trip;
- Frontier Rush Unleashed from two signature anchors;
- Bannerwake Unleashed from two signature anchors;
- bounded renderer roots;
- Western extends Fantasy and Medieval extends Western;
- final-style seam routes to Medieval;
- state-integrity guard depends on the stable final seam;
- preserved simulation remains unaware of the new style renderers/superpowers.

## Verification truth boundary

This connected GitHub seat can inspect and mutate source, but it is not the trusted local build/WebGL environment and there are no PR workflow runs on this branch.

Therefore the truthful status remains:

**SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

`dist/game.js` remains intentionally untouched.

Later local intake should specifically inspect:

- Western dust/timber readability against the PS1/16-bit-ish palette;
- tumbleweed path/orientation on the Living Globe;
- water-tower scale near small attractions;
- Medieval tower/banner overlap with large ride models;
- torch brightness at night and in rain/clouds;
- local dressing selectability;
- four simultaneous styled districts;
- Frontier Rush and Bannerwake at Awakening / Charged / Unleashed;
- Tiny / Retro / Crisp actor budgets;
- mobile top-bar readability with the existing Fit / Power / District Style controls.
