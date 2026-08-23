# Steward Receipt — Research & Functional Growth

## Status

`SOURCE_STACKED_AWAITING_LOCAL_TEST_BUILD_BALANCE_AND_VISUAL_REPAIR`

This pass adds a real research/growth layer on top of the existing v0.4.6 simulation without replacing the preserved baseline minute tick.

The design goal is intentionally **casual but deep**:

- normal park operation produces research evidence automatically;
- evidence gradually becomes a small shared Insight currency;
- no scientist micromanagement or research-click grind is required;
- research projects never complete automatically;
- the player explicitly chooses which projects to complete;
- research unlocks functional growth capabilities rather than instantly buffing every object;
- the player then chooses which individual attraction/store/service or park-wide capability receives money;
- visual/style evolution can remain a separate layer later.

## Architecture

### `core/research.js`

Owns research state normalization, six evidence channels, Insight conversion, explicit project completion, entity functional growth, park-wide functional growth, costs/caps and player-facing views.

### `core/researchRuntime.js`

This is an additive deterministic wrapper around the preserved simulation:

1. snapshot the small live-state pieces needed to measure a growth effect;
2. call the existing `advanceOneMinute(state)` unchanged;
3. inspect events/state changes that actually happened;
4. collect research evidence;
5. apply bounded researched growth effects;
6. refresh the hash at the existing ten-tick cadence.

The preserved `simulation.js` therefore remains directly available as a baseline for local A/B repair testing.

## Evidence channels

Research learns from:

- **Ridecraft** — completed ride cycles, ride care and evolution;
- **Guest services** — actual active service/rest use;
- **Commerce** — real paid service/store sales and active store service use;
- **Operations** — cleaner/mechanic work and completed operating days;
- **Guest insight** — real arriving guests and discovery interactions;
- **Park learning** — arrivals, completed days, builds and progression evidence.

Eight evidence units become one Insight by default. **Learning Culture** raises future evidence-to-Insight progress by 25%.

Old event history is not silently converted into retroactive research. First normalization starts observation after the current event-log tip.

## Research projects

### Ridecraft

- **Platform Rhythm** → unlocks ride/attraction Throughput growth.
- **Gentle Machinery** → unlocks Reliability growth.
- **Experience Craft** → unlocks Experience growth.

### Servicecraft

- **Service Flow** → unlocks active service/store Throughput growth.
- **Waste & Energy Sense** → unlocks Efficiency growth.
- **Little Details** → unlocks Quality growth.

### Park life

- **Retail Storycraft** → unlocks passive-store Appeal growth.
- **Care Network** → unlocks Care growth for practical support facilities, including quiet-rest infrastructure.

### Parkcraft

- **Clear Wayfinding** → unlocks park Hospitality growth.
- **Operations Desk** → unlocks park Operations growth.
- **Living Park Identity** → unlocks park Identity growth.

### Research

- **Learning Culture** → +25% future evidence-to-Insight progress.

## Functional entity growth

Individual park elements currently have a maximum of four total growth steps. Each specific track has a maximum level of two. This deliberately creates specialization instead of an inevitable fully-maxed park.

### Rides / Attractions

**Throughput**

- L1 periodically removes one extra active cycle minute on a 4-tick cadence;
- L2 does so on a 2-tick cadence;
- never forces `cycleRemaining` below one after the base tick, so the preserved simulation still owns actual completion.

**Reliability**

- L1 protects 30% of observed ride wear;
- L2 protects 50%;
- only wear the real ride cycle produced can be protected.

**Experience**

- L1 gives the actual riders who completed the cycle +1 happiness;
- L2 gives +2.

### Active services / active food stores

**Throughput** uses the same bounded cycle-acceleration model.

**Efficiency**

- L1 rebates 10% of that entity's observed operating spend;
- L2 rebates 20%;
- rebates are based on real `operatingSpend` delta.

**Quality**

- L1 gives actual guests completing service +1 happiness;
- L2 gives +2.

### Passive stores

**Appeal** does not fabricate purchases. It contributes a small bounded park-draw/rating effect representing a stronger retail streetscape and park identity.

### Passive support facilities

**Care** lets practical support infrastructure—including Quiet Cove-style rest support—contribute a small bounded park-wide care/identity effect without inventing health incidents or chores.

## Park-wide growth

The park itself has six total functional growth steps across three tracks, with a maximum of three per track.

### Hospitality

Each level gives newly arriving guests +3 patience minutes and +8 visit-duration minutes. This only happens when a real `visitor.entered` event occurs.

### Operations

Each level rebates 4% of the real `Hourly operations and staff` charge.

### Identity

Each level contributes a small bounded draw/rating bonus after the normal five-tick metric recomputation. Developed passive stores and care facilities can add small bounded contributions to the same modifier.

## Player-facing Research Lab

`ui/researchLabUI.js` exposes:

- current Insight and progress to the next point;
- all six evidence channels;
- projects grouped by branch;
- prerequisites and evidence requirements;
- explicit unlock descriptions;
- park-wide growth and costs;
- every currently built element with functional growth tracks;
- per-track levels, unlock state, cost and caps.

The park clock pauses while the Research Lab is open, matching the Coaster Studio interaction model.

## Save compatibility

The existing save version remains unchanged because research state is additive and normalized through the existing migration path. `save.js` now invokes `normalizeResearchState(state)` during migration.

New research/entity/park growth persists through normal saves and exports. Older saves receive explicit zero/default research fields. Historical events are not retroactively awarded.

## Focused tests

`tests/research-growth.test.js` covers defaults, deterministic evidence/Insight generation, no automatic project completion, project gates, paid bounded ride growth, real throughput/reliability effects, Hospitality, Operations rebates, passive-store Appeal without fake sales, quiet-support Care growth, save persistence, legacy defaults and the additive runtime boundary.

No full-suite PASS is claimed from this GitHub-only steward seat.

## Local intake / repair gate

Run:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

Then playtest research pacing, each functional growth track, same-seed baseline-vs-wrapper behavior, save migration, Research Lab touch/layout, and the six-step park specialization cap.

## Promotion rule

Do not claim the ready-to-play `dist/game.js` contains Research & Growth until local has run the test/build/browser gates, tuned pacing, repaired any runtime or visual issues, and committed regenerated `dist/`.
