# Stewardship — Gilded Wealth District Style

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass adds the requested final district style: **Gilded Wealth**.

The intent is not restrained luxury. It is deliberately excessive theme-park wealth language: polished gold, marble, velvet, crowns, jewel lights, VIP-style entrances, oversized fountains and visibly unnecessary ornamentation.

This pass follows the corrected themed-land architecture established by the seasonal/technology work:

1. the land is visibly themed immediately;
2. park elements inside the land inherit local themed dressing;
3. matching evidence charges a larger Style Superpower spectacle.

## Final district style cycle

1. Neutral
2. Garden
3. Adventure
4. Storybook
5. Cartoon
6. Fantasy
7. Western
8. Medieval
9. Halloween
10. Christmas
11. New Year
12. Future
13. Robotica
14. AI / Software Future
15. Waterfront
16. Gilded Wealth

Gilded Wealth is appended after Waterfront so prior style-order checkpoints remain stable.

## Deliberate exception: everything gets dressed

Most district styles only add local entity dressing when an element is a Signature / Strong / Compatible fit.

**Gilded Wealth deliberately behaves differently.**

Every entity inside a Gilded district receives a luxury presentation layer, including deliberate Style Contrast or otherwise neutral elements. This matches the requested idea that the land is show-off wealth everywhere rather than a collection of tasteful isolated luxury pieces.

Theme fit still matters, but only for charging the larger district spectacle.

## Attraction dressing

Ride / attraction models receive:

- black-marble entrance base;
- white-marble paired columns;
- polished-gold marquee lintel;
- floating crown / jewel marker;
- animated jewel bulbs;
- stronger scale for Signature / Strong luxury anchors.

The underlying ride model, queue, capacity, pricing, cycles, condition and ride-camera authority remain unchanged.

## Services and guest facilities

Active services and service-category facilities receive their own dedicated treatment rather than merely reusing attraction dressing:

- white-marble counter body;
- oversized polished-gold canopy;
- black sign fascia;
- jewel sign pulse;
- gold VIP-style rope posts;
- ruby rope caps;
- miniature chandelier marker.

This includes ordinary park support. A basic drink/service building is intentionally allowed to look absurdly expensive.

No service speed, capacity, satisfaction, price or operating-cost modifier is introduced by this visual treatment.

## Stores / retail

Store-category elements receive:

- black showcase plinth;
- white display body;
- gold awning;
- gem-lit storefront row;
- crown marker.

The renderer does not invent purchases for passive stores and does not change existing retail authority.

## Scenery / passive elements

Other scenery receives:

- black-marble plinth;
- white-marble upper pedestal;
- gold fountain/statue ring;
- floating jewel ornament.

This ensures the land language reaches even small decorative/support pieces.

## Baseline Gilded district identity

A Gilded district is visibly wealthy even with zero Style Superpower charge.

The bounded district frame includes:

- black-marble outer ring;
- polished-gold inner ring;
- four red-velvet carpet approaches;
- four marble columns;
- gold capitals;
- alternating ruby/aether jewel tops;
- central marble fountain core;
- animated gold fountain ring.

The baseline is presentation-only and exists independently of Grand Radiance.

## Luxury fit evidence

A new derived theme-fit tag is added:

`luxury`

It is deliberately evidence-based rather than attached to every item merely because the player selected Gilded Wealth.

Current derivation includes:

- high-comfort scenic rides;
- scenic food/care service locations;
- retail elements;
- landmark-influence scenery.

Representative current natural anchors include:

- Sunbeam Lookout;
- Moonlit Lagoon Show;
- Harbour Fizz Deck.

The same element can still fit other lands. Gilded Wealth is a framing choice, not exclusive ownership of content.

## Style Superpower — Grand Radiance

Gilded Wealth joins the shared Style Superpower planner.

Shared charge rules remain unchanged:

- Signature = 3;
- Strong = 2;
- Compatible = 1;
- Neutral / Contrast = 0.

Stages remain:

- Dormant;
- Awakening;
- Charged;
- Unleashed.

Two signature luxury anchors such as Sunbeam Lookout + Moonlit Lagoon Show can unleash **Grand Radiance**.

Grand Radiance includes:

- black-marble dais;
- multi-tier marble/gold fountain structure;
- three animated fountain rings;
- rotating crown ring;
- floating crown jewel;
- eight orbiting ruby/aether gem lights;
- ten bounded rising gold sparkle actors;
- four chandelier-drop jewels;
- stronger evening/night luminous presentation.

The effect is intentionally excessive but bounded.

## No hidden wealth economy

Despite the visual theme, Gilded Wealth does **not** currently alter:

- build prices;
- attraction ticket prices;
- service/store prices;
- guest spending behavior;
- guest wealth classes;
- revenue;
- operating cost;
- park rating;
- guest happiness/motives;
- queues/cycles;
- pathfinding;
- staff behavior;
- research;
- upgrades;
- save schema.

There is no hidden `luxury multiplier`, VIP economy or paywall system in this pass.

## Rendering bounds

The Gilded renderer uses:

- maximum 4 baseline district roots because the park has four districts;
- existing Style Superpower anchor budget of 6 per district;
- fixed low-poly actor counts;
- Tiny-quality reductions for optional Grand Radiance sparkles/gems;
- no unbounded particle emitter or spawn loop.

Diagnostics expose:

- `bounded-render-only-gilded-wealth-style`;
- `dressesEveryEntity: true`;
- styled district count;
- dressed element count;
- bounded actor count;
- `grand-radiance` power id.

## Final presentation chain

At this final-style checkpoint:

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
                    -> seasonal + Robotica + AI/Software lands
                      -> Snowglow deterministic motion guard
                        -> Gilded Wealth + Grand Radiance
                          -> finalStyleWorldRenderer seam
                            -> district normalization/state-hash guard
                              -> stable contentStudioWorldRenderer import
```

`finalStyleWorldRenderer.js` now routes to `gildedStyleWorldRenderer.js`.

The state-integrity guard remains stable and continues to depend only on the final-style seam.

## Focused proof

Added:

- `playable_3d/tests/gilded-style.test.js`

Updated:

- `playable_3d/tests/style-superpowers.test.js`
- `playable_3d/tests/seasonal-tech-styles.test.js`
- `playable_3d/tests/western-medieval-styles.test.js`
- `playable_3d/tests/cartoon-style.test.js`
- `playable_3d/tests/fantasy-style.test.js`

Coverage includes:

- Gilded Wealth appended as the sixteenth style;
- `luxury` evidence derivation;
- luxury attraction and service anchors;
- presentation-only style mutation;
- save round-trip;
- Grand Radiance Unleashed from two signature anchors;
- every Gilded entity being dressed regardless of fit status;
- explicit ride/service/store/scenery dressing branches;
- bounded Gilded district roots;
- Gilded extending the seasonal motion-safe renderer;
- final-style seam routing to Gilded;
- preserved simulation remaining unaware of Gilded rendering and Grand Radiance;
- repair of older stale tests that assumed Medieval or the seasonal layer was still the final renderer.

## Verification truth boundary

This connected GitHub seat can inspect and mutate source but is not the trusted local Node/WebGL/build environment. No GitHub workflow runs are configured for this PR head.

Therefore the truthful status is:

**SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

`dist/game.js` remains intentionally untouched.

Later local intake should specifically inspect:

- whether the gold palette is delightfully excessive rather than visually unreadable;
- marble/gold dressing placement on very small and very large attractions;
- service/store distinction at phone resolution;
- local dressing selectability through added meshes;
- Grand Radiance overlap with tall ride geometry;
- evening jewel brightness;
- Tiny / Retro / Crisp actor budgets;
- four simultaneous themed districts;
- full style-cycle UI readability with sixteen land choices;
- whether any specific attraction model needs a custom Gilded dressing offset.
