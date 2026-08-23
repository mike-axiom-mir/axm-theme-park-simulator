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

Owns:

- research state normalization;
- six evidence channels;
- Insight conversion;
- explicit project completion;
- entity functional-growth state;
- park-wide functional-growth state;
- research/growth costs and caps;
- project and growth views used by UI;
- bounded park modifiers.

### `core/researchRuntime.js`

This is an additive deterministic wrapper around the preserved simulation:

1. snapshot the small pieces of live state needed to measure a growth effect;
2. call the existing `advanceOneMinute(state)` unchanged;
3. inspect events/state changes that actually happened;
4. collect research evidence;
5. apply bounded researched growth effects;
6. refresh the hash at the existing ten-tick hash cadence.

The preserved `simulation.js` therefore remains directly available as a baseline for local A/B repair testing.

## Evidence channels

Research learns from six kinds of evidence:

- **Ridecraft** — completed ride cycles, ride care and evolution;
- **Guest services** — actual active service/rest use;
- **Commerce** — real paid service/store sales and store service use;
- **Operations** — cleaner/mechanic work and completed operating days;
- **Guest insight** — real arriving guests and discovery interactions;
- **Park learning** — arrivals, completed days, park growth, builds and progression evidence.

Eight evidence units become one Insight by default.

Completing **Learning Culture** increases future evidence-to-Insight progress by 25%.

Old event history is not silently converted into retroactive research. When the research state is first normalized, it starts observing after the current event-log tip.

## Research projects

### Ridecraft

#### Platform Rhythm
Unlocks **Throughput** growth for rides and attractions.

#### Gentle Machinery
Requires Platform Rhythm. Unlocks **Reliability** growth.

#### Experience Craft
Requires Platform Rhythm. Unlocks **Experience** growth.

### Servicecraft

#### Service Flow
Unlocks **Throughput** growth for active services and active food/store counters.

#### Waste & Energy Sense
Requires Service Flow. Unlocks **Efficiency** growth.

#### Little Details
Requires Service Flow. Unlocks **Quality** growth.

### Park life

#### Retail Storycraft
Unlocks **Appeal** growth for passive shops that do not yet have a fabricated shopping transaction model.

#### Care Network
Unlocks **Care** growth for passive support facilities.

### Parkcraft

#### Clear Wayfinding
Unlocks park-wide **Hospitality** growth.

#### Operations Desk
Unlocks park-wide **Operations** growth.

#### Living Park Identity
Requires Clear Wayfinding. Unlocks park-wide **Identity** growth.

### Research

#### Learning Culture
Improves future evidence-to-Insight conversion by 25%.

## Functional entity growth

Individual park elements currently have a maximum of four total growth steps. Each specific track has a maximum level of two.

This deliberately creates specialization rather than an inevitable fully-maxed park.

### Rides / Attractions

**Throughput**

- L1: periodically removes one extra active cycle minute on a 4-tick cadence;
- L2: does so on a 2-tick cadence;
- never forces `cycleRemaining` below one after the base tick, so the preserved base simulation still owns actual ride completion.

**Reliability**

- L1 protects 30% of observed ride wear;
- L2 protects 50% of observed ride wear;
- it only restores wear that the preserved ride cycle actually produced.

**Experience**

- L1 gives the actual riders who just completed the ride +1 happiness;
- L2 gives +2;
- no guest gets a reward unless the committed ride cycle actually completes.

### Active services / active food stores

**Throughput**

Uses the same bounded active-cycle acceleration approach as rides.

**Efficiency**

- L1 rebates 10% of that entity's observed operating spend;
- L2 rebates 20%;
- the rebate is based on real `operatingSpend` delta rather than a fabricated estimate.

**Quality**

- L1 gives actual guests completing the service +1 happiness;
- L2 gives +2.

### Passive stores

**Appeal**

Passive souvenir/toy/apparel/photo/custom stores still do not fabricate purchases.

Instead, researched Appeal contributes a small bounded park-draw/rating effect, representing a more compelling retail streetscape and park identity without claiming a shopping transaction occurred.

### Passive support facilities

**Care**

Research allows practical support infrastructure to contribute a small bounded park-wide care/identity effect without inventing health incidents or chores.

## Park-wide growth

The whole park has six total functional growth steps across three tracks. Each track has a maximum of three.

### Hospitality

Each level gives newly arriving guests:

- +3 patience minutes;
- +8 visit-duration minutes.

This is applied only when a real `visitor.entered` event occurs.

### Operations

Each level rebates 4% of the real `Hourly operations and staff` charge, bounded by the current three-level track.

### Identity

Each level contributes a small bounded draw/rating bonus after the normal five-tick metric recomputation.

Developed passive stores and care facilities can contribute small additional bounded amounts to the same park-level modifier.

## Player-facing Research Lab

`ui/researchLabUI.js` adds a modal Research & Growth interface.

It exposes:

- current Insight and progress to the next point;
- all six evidence channels;
- research projects grouped by branch;
- explicit prerequisites;
- evidence current/required chips;
- unlock descriptions;
- park-wide growth tracks and costs;
- every currently built park element that has functional growth tracks;
- current per-track levels, unlock state, cost and growth cap.

The park simulation clock is paused while the Research Lab is open, matching the Coaster Studio interaction model.

## Save compatibility

The existing save version remains unchanged because the new state is additive and normalized through the existing migration path.

`save.js` now invokes `normalizeResearchState(state)` during migration.

Therefore:

- new research state persists through normal save/export;
- entity growth persists;
- park growth persists;
- older saves receive explicit zero/default research fields;
- no previous completed research is inferred from historical event logs.

## Focused tests

`tests/research-growth.test.js` covers:

- legacy/default normalization;
- no retroactive old-event reward;
- deterministic evidence and Insight generation;
- no automatic research completion;
- evidence/Insight/project gates;
- paid bounded ride growth;
- real throughput effect;
- real reliability effect;
- Hospitality effect on newly created guests;
- Operations rebate against a real hourly charge;
- passive-store Appeal without fake retail sales;
- research/entity growth save persistence;
- legacy save defaulting;
- additive runtime wiring while `simulation.js` remains research-independent.

No full-suite PASS is claimed from the GitHub-only steward seat.

## Local intake / repair gate

Run the existing repository gates first:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

Then perform a deliberate research playtest.

### Research pacing

1. run a fresh campaign with no intervention and measure time to first 1 / 3 / 6 Insight;
2. verify evidence channels reflect what the park actually did;
3. confirm projects never auto-complete;
4. confirm one-track specialization is useful without becoming mandatory;
5. test whether project evidence requirements feel reachable in casual play;
6. inspect late-game Insight income after Learning Culture.

### Ride / attraction growth

1. compare the same ride at base, Throughput L1 and L2;
2. verify rider completion still occurs through base simulation ownership;
3. compare real condition loss at Reliability 0 / 1 / 2;
4. confirm Experience bonuses only hit riders from completed cycles;
5. stress multiple researched rides simultaneously.

### Services / stores

1. test active food/service Throughput;
2. verify Efficiency rebates only observed operating spend;
3. verify Quality only affects guests who actually complete service;
4. grow a passive shop Appeal and confirm no fabricated sale event appears;
5. grow practical support Care and inspect bounded park modifier behavior.

### Park growth

1. compare same-seed new guest patience/stay at Hospitality 0 / 1 / 2 / 3;
2. compare same hourly cost at Operations 0 / 1 / 2 / 3;
3. compare same park metric recompute at Identity 0 / 1 / 2 / 3;
4. verify the six-step total park cap creates useful choice rather than frustration.

### UI / save

1. open Research Lab and confirm simulation time stops;
2. verify research cards update after play-generated evidence;
3. complete projects and buy growth steps;
4. save/export/reload and inspect all research/growth fields;
5. load an old save and verify zero/default research state;
6. inspect the Lab on Crisp / Retro / Tiny and touch targets.

## Promotion rule

Do not claim the ready-to-play `dist/game.js` contains Research & Growth until local has run the test/build/browser gates, tuned pacing, repaired any runtime or visual issues, and committed regenerated `dist/`.
