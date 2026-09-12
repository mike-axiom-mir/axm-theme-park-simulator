# Stewardship — District Style Superpowers

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass extends the existing district identity + theme-fit stack with bounded, presentation-only district spectacles called **Style Superpowers**.

The goal is to make a coherent Garden, Adventure, Storybook, Future or Waterfront zone feel materially different in motion without turning theme matching into a mandatory optimization game.

## Core rule

Style charge is derived only from the existing advisory theme-fit evidence:

- Signature fit = 3 charge;
- Strong fit = 2 charge;
- Compatible fit = 1 charge;
- Flexible/Neutral fit = 0;
- Style Contrast = 0.

Stages:

- Passive — Neutral only;
- Dormant — styled district with no fitting anchors yet;
- Awakening — 1-2 charge;
- Charged — 3-5 charge;
- Unleashed — at least 6 charge from at least two fitting anchors.

The planner is read-only. Charge is **not currency** and is not stored in saves; it is derived from the player's current district style plus the attractions/scenery already present.

## Style superpowers

### Neutral — Open Canvas

Neutral intentionally stays passive. Its superpower is restraint: attraction models keep their own identities and no automatic district spectacle is layered on top.

### Garden — Bloomwake

Matching garden/scenic/family/water/care content wakes:

- a low bloom ring;
- swaying stems;
- animated flower nodes;
- bounded orbiting pollen actors.

Rain strengthens the presentation pulse only.

### Adventure — Trailblaze

Matching adventure/thrill/water/family/scenic content wakes:

- timber expedition beacons;
- animated pennants;
- moving signal sparks;
- a restrained trail marker line.

Bright weather slightly strengthens the visual rhythm.

### Storybook — Lantern Chorus

Matching storybook/family/indoor/scenic/garden content wakes:

- orbiting low-poly lanterns;
- a rotating crown ring;
- asynchronous lantern bob/pulse choreography.

Evening/night makes the chorus more luminous in motion.

### Future — Pulse Grid

Matching future/thrill/indoor/scenic/water content wakes:

- synchronized signal rings;
- orbiting pulse nodes;
- counter-rotating geometric motion.

The grid becomes more visually pronounced after dusk.

### Waterfront — Tidecall

Matching water/scenic/family/garden/adventure/food/care content wakes:

- shallow water presentation plane;
- expanding ripple rings;
- bounded rising mist actors;
- a harbour beacon pulse.

Rain and evening conditions strengthen Tidecall's presentation.

## Player feedback

A contextual **Power** top-bar control shows the relevant district power while hovering/building/selecting.

Examples:

- `Power · Bloomwake · Awakening`
- `Power · Tidecall · Unleashed`

Clicking it explains:

- district and style;
- power name and stage;
- current charge;
- strongest matching tags;
- what kind of fitting content can strengthen it next.

This remains guidance, not a forced objective.

## Bounds / performance

Hard presentation bounds:

- maximum 4 rendered district power roots;
- maximum 6 attraction anchors considered for visual centering per district;
- small fixed mesh budgets per power;
- Tiny quality reduces optional pollen/lantern/mist/ring actors.

The effect root is render-only and named `bounded-render-only-style-superpowers` for diagnostics.

## Architecture boundary

Updated final presentation chain:

```text
preserved simulation
  -> research/growth runtime
    -> installed-upgrade runtime
      -> expressive / staff / content render layers
        -> park identity visuals
          -> waterfront + theme-fit dressing
            -> style superpower spectacle
              -> district normalization/state-hash guard
                -> stable contentStudioWorldRenderer import seam
```

`simulation.js` remains unaware of Style Superpowers.

Style Superpowers do **not** currently change:

- build legality;
- attraction stats;
- prices;
- revenue;
- rating;
- guest happiness or motives;
- queues;
- pathfinding;
- staff behavior;
- research;
- upgrades;
- save schema.

That separation is deliberate. A later local balance pass can decide whether any tiny functional identity effect is desirable after the spectacle is actually seen and played.

## Focused proof

Added:

`playable_3d/tests/style-superpowers.test.js`

It covers:

- Neutral/Open Canvas remains passive;
- one signature anchor reaches Charged;
- two signature anchors can reach Unleashed;
- Garden -> Bloomwake;
- Adventure -> Trailblaze;
- Storybook -> Lantern Chorus;
- Future -> Pulse Grid;
- Waterfront -> Tidecall;
- planner remains read-only;
- four-district visual budget remains bounded;
- final renderer routes through the new layer;
- preserved simulation stays independent.

## Verification truth boundary

This connected GitHub seat can inspect and mutate source but does not have the trusted local WebGL/build environment.

Therefore this pass is **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**.

Do not claim browser, WebGL, full Node, production build or package PASS from this receipt.

`dist/game.js` remains intentionally untouched.

Later local intake should specifically inspect:

- effect placement/orientation on the Living Globe;
- whether one signature anchor feels too fast to reach Charged;
- whether Unleashed should remain two strong/signature anchors or require a slightly broader district;
- readability when several districts are active simultaneously;
- Tiny/Retro/Crisp visual budgets;
- rain/night presentation boosts;
- mobile top-bar crowding with Fit + Power + District Style controls;
- frame cost in a large park.
