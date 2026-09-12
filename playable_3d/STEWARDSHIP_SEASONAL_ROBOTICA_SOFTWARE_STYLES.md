# Stewardship — Full Themed Lands: Halloween + Christmas + New Year + Robotica + AI/Software Future

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass corrects an important interpretation in the district-style work:

> A theme-park **theme is a whole land identity**, not one design choice or one color treatment.

The current architecture therefore treats a district theme as three layers:

1. **baseline land identity** — visible immediately when the player selects the theme;
2. **matching-attraction dressing** — fitting rides/services/stores/scenery inherit small local details from the land;
3. **Style Superpower spectacle** — the larger district-wide animation earned by coherent matching content.

The superpower is no longer the thing that makes the land themed. It is the extra spectacle on top of an already themed land.

## Current style cycle

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

These are player-selectable themed lands. Halloween, Christmas and New Year are **not calendar-locked**. A player can build a permanent Halloween land or Christmas land whenever they want. Park-clock time/weather may strengthen presentation, but the real-world date does not silently change the park.

## Halloween

### Land language

- dark crooked framing;
- orange pumpkin forms;
- purple haunted lantern/fog accents;
- green stem/poison-color accents;
- dark ride / indoor story / thrill compatibility;
- matching-attraction pumpkin/rune-like local dressing.

### Existing natural anchors

- Lantern Labyrinth;
- Cloud Cinema 4D;
- other content that already derives dark/indoor story evidence.

### Superpower — Hauntfall

Same shared charge model:

- Signature = 3;
- Strong = 2;
- Compatible = 1;
- Neutral / Contrast = 0.

Hauntfall includes:

- central pumpkin beacon;
- orbiting low-poly bat silhouettes;
- bounded rising fog motes;
- crooked haunted-light rhythm;
- stronger dusk/night/rain presentation.

No fear mechanic, guest penalty or scare simulation is introduced in this pass.

## Christmas

### Land language

- evergreen cones;
- red/green/gold palette;
- warm light rings;
- ornaments;
- candy-stripe post language;
- family/story/rail/market compatibility.

### Existing natural anchors

- Little Loop Railway;
- Twirly Tea Garden;
- other family/story/scenic or fitting rail content.

### Superpower — Snowglow

Snowglow includes:

- central evergreen landmark;
- star/ornament pulse;
- bounded falling snow-light actors;
- stronger evening/night glow.

Snow is presentation only and does not rewrite authoritative weather.

A source review caught a frame-rate-dependent sideways snow nudge in the first renderer pass. The final presentation path now includes `festivalTechMotionGuardWorldRenderer.js`, which re-anchors Snowglow flakes to deterministic time-based X positions after the underlying renderer updates. The underlying source remains separately inspectable for repair/A-B comparison.

## New Year

### Land language

- dark midnight base;
- gold/silver/blue light architecture;
- countdown rings;
- celebration pylons;
- future/scenic/thrill compatibility.

### Existing natural anchors

- Star Flyers;
- Sunbeam Lookout;
- other future + scenic/thrill/light-oriented content.

### Superpower — Countdown Burst

- counter-moving countdown rings;
- radial low-poly firework bars;
- celebration pulses;
- stronger late-evening and park-clock midnight presentation.

The park clock is not accelerated or altered by the effect.

## Robotica

Robotica is deliberately different from generic Future and AI/Software Future.

### Identity

Robotica = **physical machines**:

- mechanical housings;
- servo arms;
- gear rings;
- piston motion;
- industrial amber/cyan signals;
- visible machinery and kinetic attraction language.

### Existing natural anchors

Physical mechanical ride families currently derive Robotica evidence, including:

- Bumble Buggies;
- Cloud Hop;
- other bump/bounce/swing/drop/driver-style mechanical families.

### Superpower — Servo Surge

- central machine core;
- counter-rotating gear rings;
- pumping pistons;
- servo signal nodes;
- slightly busier daytime visual operation.

No robotics control system, autonomous maintenance or mechanical gameplay bonus is introduced here.

## AI / Software Future

This is also deliberately separate from generic Future and Robotica.

### Identity

AI / Software Future = **data and logic worlds**:

- network nodes;
- code-like glyph bars;
- moving data lattices;
- holographic rings;
- logic pulses;
- simulator/information/network attraction language.

This is visual fiction/theme-park presentation. It does not invoke models, add hidden agents, create autonomous authority or imply that the district is actually controlled by AI.

### Existing natural anchors

- Sky Sailor;
- Cloud Cinema 4D;
- simulator, information, monorail, observation, charging and related data/network-like families.

Robotica and Software are intentionally distinguishable in fit evidence: Bumble Buggies becomes Robotica evidence but not Software; Sky Sailor becomes Software evidence but not Robotica.

### Superpower — Codewave

- central data core;
- counter-moving logic rings;
- orbiting network nodes;
- pulsing code-glyph bars;
- stronger night-time luminous presentation.

No hidden AI behavior or simulation authority is added.

## Generic Future remains its own land

The existing **Future** theme remains valuable and is not replaced:

- Future = broad clean sci-fi / kinetic future park;
- Robotica = physical machine future;
- AI / Software Future = data/network/software future.

This lets the player choose three visibly different future-facing lands instead of one overloaded sci-fi bucket.

## Fit philosophy

The same attraction can legitimately fit multiple lands when its existing evidence supports multiple readings. That is normal theme-park behavior: the land's framing changes how a ride is presented.

The fit system remains soft:

- no attraction is forbidden because of theme;
- Style Contrast remains allowed;
- themes do not create mandatory decoration chores;
- matching affects presentation guidance and spectacle charge, not hidden economic multipliers.

## Rendering boundaries

`festivalTechStyleWorldRenderer.js` adds:

- immediate baseline land frames for all five new themes;
- matching attraction dressing;
- their five superpower visuals;
- a hard maximum of four district roots because the park has four districts;
- fixed low-poly actor counts;
- Tiny-quality reductions for optional snow/fog/firework/data actors;
- `bounded-render-only-seasonal-robotica-software-styles` diagnostics.

`festivalTechMotionGuardWorldRenderer.js` provides the final Snowglow motion-integrity repair.

## Current final presentation chain

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
                    -> Halloween / Christmas / New Year / Robotica / AI-Software lands
                      -> Snowglow motion guard
                        -> finalStyleWorldRenderer seam
                          -> district normalization/state-hash guard
                            -> stable contentStudioWorldRenderer import
```

`finalStyleWorldRenderer.js` remains the small moving routing seam. The state-integrity guard continues to depend on that seam rather than knowing which style happens to be last.

## Authority boundary

All five new themes are currently presentation-only.

They do not alter:

- build legality;
- cash;
- prices;
- revenue;
- park rating;
- guest motives/happiness;
- queues/cycle behavior;
- pathfinding;
- staff behavior;
- research;
- upgrades;
- save schema;
- real-world calendar behavior;
- AI/model execution or authority.

District selection continues to persist through the existing district save state without a save-version bump.

## Focused proof

Added/updated:

- `playable_3d/tests/seasonal-tech-styles.test.js`
- `playable_3d/tests/style-superpowers.test.js`

Coverage includes:

- exact land positions in the style cycle;
- real existing attraction evidence for each new theme;
- Robotica vs Software distinction;
- presentation-only mutations;
- current save round-trip;
- Hauntfall Unleashed;
- Snowglow Unleashed;
- Countdown Burst Unleashed;
- Servo Surge Unleashed;
- Codewave Unleashed;
- all current active style powers represented in shared regression;
- bounded renderer roots and Tiny-quality hooks;
- final Snowglow motion guard;
- final-style seam routing;
- preserved simulation remains unaware of the new presentation systems.

## Verification truth boundary

This connected GitHub seat can inspect and mutate source, but it is not the trusted local build/WebGL environment and there are no PR workflow runs on this branch.

Therefore the truthful status remains:

**SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

`dist/game.js` remains intentionally untouched.

Later local intake should specifically inspect:

- visual clarity when seasonal and technology lands sit beside historical/fantasy lands;
- Halloween fog/bat readability on phone screens;
- Christmas snow actor spacing and the motion guard under variable frame rates;
- New Year burst intensity at park-clock midnight;
- Robotica piston/gear placement around small and large attractions;
- Software glyph readability without becoming UI clutter;
- matching-attraction selectability through added meshes;
- all four districts active simultaneously;
- Tiny / Retro / Crisp actor budgets;
- mobile top-bar readability with Fit / Power / District Style controls.
