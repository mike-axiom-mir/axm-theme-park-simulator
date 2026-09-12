# Steward Receipt — World-Inspired Park Content

## Status

`SOURCE_STACKED_AWAITING_LOCAL_TEST_BUILD_BALANCE_AND_VISUAL_REPAIR`

This pass used current official theme-park directories and service guides as category research, then translated recurring world-park patterns into original casual AXM content.

Research notes and source links:

`WORLD_CONTENT_RESEARCH_2026-08-23.md`

## Scope added

A new content module contributes **33 original buildable items** without replacing the preserved v0.4.6 catalog lineage.

### 17 rides / attractions

- Twirly Tea Garden
- Bumble Buggies
- Cloud Hop
- Star Flyers
- Sunbeam Lookout
- Comet Drop
- Timber Tumble
- Rumble Rapids
- Lantern Labyrinth
- Little Loop Railway
- Sky Ribbon
- Garden Drift Boats
- Cloud Cinema 4D
- Sky Sailor
- Tiny Town Drivers
- Acorn Adventure Play
- Bubble Submarine

These complement the pre-existing Carousel, Wheel, Spinner, Splash ride, Haunted attraction, Coaster and the newly stacked Moonwake Galleon.

### 8 service/support additions

- Free Refill Fountain
- Quiet Cove
- Care Cabin
- Family Nest
- Stash Station
- Hello Hub
- Wagon Wheels
- Charge Grove

### 8 stores / food-retail additions

- Memory Market
- Toy Tinker
- Park Threads
- Snapshot Shop
- Name-It Workshop
- Sugar Cloud
- Swirl Cart
- Popcorn Planet

## Build-menu structure

The build dock now has explicit lanes for:

- Paths
- Rides
- Attractions
- Services
- Stores
- Scenery

Content is distributed across normal campaign progression rather than hidden behind sandbox.

## Real behavior now

### Rides and attractions

All new `kind: ride` entries use the existing authoritative park loop:

- normal construction cost;
- physical footprint and access;
- queue capacity/wait handling;
- cycle timing;
- ride ticket spending;
- operating cost;
- condition loss;
- maintenance and evolution compatibility;
- family/thrill/explorer demand scoring.

### Existing-needs services

These already have direct guest behavior because they map to needs already present in v0.4.6:

- Free Refill Fountain -> thirst
- Quiet Cove -> rest
- Sugar Cloud -> hunger
- Swirl Cart -> hunger
- Popcorn Planet -> hunger

### Support and non-food retail

Care/family/locker/info/stroller/charging and souvenir/toy/apparel/photo/custom retail are currently honest passive facilities. They are buildable, visible and contribute place-making/atmosphere through scenery influence, but they do not fake individual transactions before the visitor model has a shopping/convenience motive.

This is deliberate. A later behavior pass may add a small optional motive without making the simulator a chore.

## Model architecture

`src/render/worldContentModels.js` implements shared model families instead of thirty-three unrelated render engines.

Current visual families cover:

- spinning cups;
- bumper arena;
- gentle/drop/observation towers;
- swing chairs;
- flume/rapids/boats/submarine water families;
- train/monorail/driving transport;
- dark-ride/cinema/simulator indoor buildings;
- play structures;
- service/store facility streetscape.

Every registered world-content id is routed through the additive content renderer seam and tagged with its own `specialAttractionId` so it does not remain an invisible unknown-object fallback.

Ride families expose ride-camera anchors.

## Source-level tests added

`tests/world-content.test.js` checks:

- broad pack size;
- Attractions and Stores build categories;
- every world-content id is present in the live catalog;
- every item has exactly one campaign unlock home;
- ride-contract metadata completeness;
- current hunger/thirst/rest integration;
- passive retail/support truth boundary;
- representative normal build/economy authority;
- every world-content id creates a visible dedicated model;
- render updates do not mutate authoritative entity evidence;
- every new ride model has a ride-camera anchor.

No full PASS is claimed from this connected GitHub-only seat.

## Local intake checklist

Run the repository's existing gates first:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

Then do a broad browser/WebGL content pass.

### Build dock

1. Open all six build categories.
2. Verify category tabs remain usable on phone/tiny width.
3. Confirm every new card has label/icon/cost/unlock state.
4. Verify campaign unlock transitions do not omit or duplicate entries.

### Ride-family visual gate

Build at least one from every family and inspect idle/waiting/active/closed states:

1. Twirly Tea Garden
2. Bumble Buggies
3. Cloud Hop
4. Star Flyers
5. Sunbeam Lookout
6. Comet Drop
7. Timber Tumble
8. Rumble Rapids
9. Lantern Labyrinth
10. Little Loop Railway
11. Sky Ribbon
12. Garden Drift Boats
13. Cloud Cinema 4D
14. Sky Sailor
15. Tiny Town Drivers
16. Acorn Adventure Play
17. Bubble Submarine

Check scale, clipping, curved-globe placement, riders, shadows and ride camera.

### Facilities / stores

Build every support/store type and inspect:

- façade scale;
- path access readability;
- animation noise;
- night readability;
- whether small 1x1 carts remain selectable;
- whether passive facilities create excessive attraction-atmosphere bonuses.

### Gameplay tuning

Do not balance by spreadsheet alone. Play several operating days and observe:

- whether too many low-cost attractions flatten progression;
- whether operating costs create meaningful choices without making casual play stressful;
- ride variety effect on demand/rating;
- queue pressure with high-capacity family rides;
- weather value of indoor attractions and refill;
- whether level 1 now feels like a fun small park instead of an empty tutorial.

## Recommended next behavior layer after local validation

If the content reads well, add one bounded optional visitor motive for retail/convenience:

- no compulsory shopping;
- no per-item inventory simulation;
- no age-pressure chores;
- occasional post-ride souvenir/photo/toy interest;
- small happiness/memory effect;
- real spending only when a guest actually visits;
- support facilities selected only when there is a sensible context.

That would make the new stores economically alive without turning the game into retail administration.

## Promotion rule

Do not claim the ready-to-play `dist/game.js` contains this pack until local has run the required test/build gates, rebuilt the bundle, completed broad WebGL review, repaired any geometry/performance/balance problems, and committed regenerated `dist/` output.
