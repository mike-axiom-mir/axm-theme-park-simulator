# Steward Receipt — Research-Gated Upgrade Systems

## Status

`SOURCE_STACKED_AWAITING_LOCAL_TEST_BUILD_BALANCE_AND_VISUAL_REPAIR`

This pass adds the third mechanical development layer requested after Research & Functional Growth.

The separation is intentional:

1. **Research** discovers a capability from real park evidence.
2. **Growth** develops an underlying capability on an individual park element or the park itself.
3. **Upgrades** install a concrete module/system after the relevant research exists.
4. **Style/evolution** can remain a separate visual-identity layer.

Research therefore does not instantly install machinery, and buying an upgrade does not pretend that research happened.

## Architecture

### `core/upgrades.js`

Owns:

- `axm.themepark.upgrades/v1` additive state;
- upgrade catalogs;
- compatibility/family routing;
- research gates;
- costs;
- entity and park upgrade slots;
- install/remove actions;
- 25% parts recovery when removing an installed module;
- passive upgrade modifier summaries;
- save/default normalization.

### `core/upgradeRuntime.js`

The final playable runtime is layered as:

```text
preserved simulation
  -> research/growth runtime
    -> installed-upgrade runtime
```

`upgradeRuntime.js` calls `advanceOneMinuteWithResearch(state)` first, then observes the resulting committed state/events and applies installed modules.

This preserves three useful A/B points for local repair:

- baseline simulation without research or upgrades;
- research/growth without installed upgrades;
- final playable research + upgrades.

The preserved `simulation.js` and `researchRuntime.js` remain upgrade-independent.

## Slot philosophy

### Specific park elements

Each compatible attraction/store/service/support facility currently has:

- **2 installed upgrade slots**.

This means an attraction can specialise instead of accumulating every available module.

### Whole park

The park has:

- **4 infrastructure upgrade slots**.

There are more than four possible park-wide upgrades, so park strategy remains a choice.

### Swapping

Installed upgrades may be removed.

Removal recovers **25%** of the module's current install value as parts recovery.

This is enough to let players change direction without making free swapping optimal.

## Specific ride / attraction modules

### Quick-Load Gate

Research gate: **Platform Rhythm** (`ride-throughput`)

Compatible with rides/attractions.

Effect:

- every sixth active minute gets one extra dispatch-progress step;
- never pushes an active cycle below one minute after the base/research tick;
- base simulation still owns the actual completion event.

### Condition Sensors

Research gate: **Gentle Machinery** (`ride-reliability`)

Compatible with rides/attractions.

Effect:

- protects 15% of the wear still observed after the normal simulation/research-growth tick;
- cannot restore condition above its pre-tick value.

### Comfort Package

Research gate: **Experience Craft** (`ride-experience`)

Compatible with rides/attractions.

Effect on actual riders from a completed ride cycle:

- +1 happiness;
- tiny +0.02 energy recovery.

No reward occurs without a real completed ride.

## Attraction-family-specific modules

### Scene Sequencer

Research gate: **Experience Craft**

Only offered to indoor/story attraction families such as dark rides, cinema/simulator-style attractions and the submarine-style family.

Effect:

- actual riders completing the upgraded indoor attraction gain +2 happiness.

### Panorama Audio

Research gate: **Experience Craft**

Only offered to scenic attraction families such as park transport, observation and gentle scenic boat-style families.

Effect:

- Explorer/Local guests completing the attraction gain +2 happiness.

This is deliberately more specific than a generic ride stat increase.

## Active service / food-store modules

### Twin Counter

Research gate: **Service Flow** (`service-throughput`)

Effect:

- every sixth active service minute receives one additional progress step;
- the preserved service loop still owns actual completion.

### Smart Energy Meter

Research gate: **Waste & Energy Sense** (`service-efficiency`)

Effect:

- rebates 8% of that entity's observed operating spend.

The module uses real `operatingSpend` deltas, not a fabricated estimate.

### Hospitality Counter

Research gate: **Little Details** (`service-quality`)

Effect:

- real guests completing the service gain +1 happiness.

## Passive-store modules

These continue the truth boundary established in the world-content pass: passive souvenir/toy/apparel/photo/custom stores still do **not** fabricate shopping transactions.

### Storefront Story

Research gate: **Retail Storycraft** (`retail-appeal`)

Effect:

- small bounded park draw contribution;
- small bounded rating contribution.

### Collector Display

Research gate: **Living Park Identity** (`park-identity`)

Effect:

- a stronger rating/identity contribution than the generic storefront module;
- still no invented sale event.

A store only has two module slots, so the player may choose whether a retail building becomes more deeply specialised later.

## Support-facility modules

### Comfort Corner

Research gate: **Care Network** (`care-network`)

Compatible with passive practical-support facilities.

Each installed module contributes a tiny new-arrival:

- patience bonus;
- visit-duration bonus.

### Accessibility Station

Research gate: **Clear Wayfinding** (`park-wayfinding`)

Compatible with passive practical-support facilities.

Each installed module contributes a small new-arrival patience bonus.

These effects represent better practical park support without inventing health incidents or accessibility chores.

## Whole-park infrastructure upgrades

### Live Wayfinding Boards

Research gate: **Clear Wayfinding**

Cost: €950

Effects:

- +4 patience to new arrivals;
- +4 visit-duration minutes;
- small bounded park-draw bonus.

### Crew Radio Network

Research gate: **Operations Desk**

Cost: €1,250

Effect:

- every second tick can remove one additional remaining staff cooldown minute.

The underlying staff route/job system remains unchanged.

### Energy Loop

Research gate: **Operations Desk**

Cost: €1,650

Effect:

- rebates 6% of the real `Hourly operations and staff` charge.

### Rain Shelter Network

Research gate: **Clear Wayfinding**

Cost: €1,200

Effect:

- recovers a bounded amount of reachable demand while the committed weather state is rain.

### Welcome Square

Research gate: **Living Park Identity**

Cost: €1,500

Effects:

- +1 happiness to real new arrivals;
- small bounded park draw/rating contribution.

### Night Signature

Research gate: **Living Park Identity**

Cost: €1,850

Effect:

- small additional draw/rating contribution after 18:00.

### Recycling Network

Research gate: **Operations Desk**

Cost: €1,350

Effect:

- captures 25% of positive litter growth observed during the minute tick;
- uses the existing spatial `washLitter` removal path rather than deleting only a headline number.

## Stacking model

The current source intentionally allows Research Growth and installed Upgrades to stack because they describe different investment types.

Examples:

- Throughput Growth + Quick-Load Gate;
- Reliability Growth + Condition Sensors;
- Service Efficiency Growth + Smart Energy Meter;
- Park Operations Growth + Energy Loop.

This is a key **local balance gate**. Stacking should feel like specialisation, not exponential power.

The existing hard caps help contain it:

- entity Growth total cap: 4;
- entity Growth track cap: 2;
- entity Upgrade slots: 2;
- park Growth total cap: 6;
- park Growth track cap: 3;
- park Upgrade slots: 4.

## Player-facing Upgrade Bay

`ui/upgradeBayUI.js` adds a separate **Upgrade Bay** modal.

It shows:

- current cash;
- park infrastructure slots;
- all park-wide modules;
- their research requirements;
- install cost;
- installed state;
- every built compatible park element;
- its upgrade families;
- its two specific module slots;
- compatible specific modules;
- research locks;
- remove/parts-recovery controls.

Coaster Studio, Research Lab and Upgrade Bay are mutually exclusive in the game shell and all pause simulation-time advancement while open.

## Save compatibility

The existing save version remains unchanged.

`save.js` now invokes `normalizeUpgradeState(state)` after research normalization.

Older saves therefore receive:

- `upgrades.schema = axm.themepark.upgrades/v1`;
- zero park upgrades;
- zero lifetime installs;
- empty `installedUpgrades` arrays on entities.

New installed modules persist through normal save/export/import.

## Focused tests

`tests/upgrades.test.js` covers:

- explicit legacy/default normalisation;
- research gates;
- two-slot specific-module cap;
- attraction-family-specific compatibility;
- Quick-Load Gate changing a real active cycle;
- Condition Sensors protecting observed wear;
- park upgrade research/slot gates;
- Energy Loop against an actual hourly operating charge;
- partial-salvage swapping;
- save persistence and legacy defaulting;
- final runtime layering;
- preserved simulation and research runtime remaining upgrade-independent.

No full-suite PASS is claimed from this GitHub-only seat.

## Local intake / balance gate

Run the existing repository checks first:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

Then deliberately test upgrade stacking.

### Specific attractions

1. compare baseline ride, Growth-only, Upgrade-only and Growth+Upgrade;
2. measure actual cycles/hour with Throughput + Quick-Load Gate;
3. measure condition loss with Reliability + Condition Sensors;
4. confirm comfort/scene/panorama bonuses only reach the actual completed riders;
5. verify two slots remain enough choice but not irritating;
6. test indoor/scenic modules never appear on incompatible rides.

### Services / stores

1. compare Service Throughput Growth vs Twin Counter vs both;
2. compare Efficiency Growth + Smart Energy Meter stacked rebate;
3. inspect Quality + Hospitality Counter happiness stacking;
4. install Storefront Story and Collector Display and confirm no store sale is fabricated;
5. inspect Care growth + Comfort/Accessibility modules on support facilities.

### Whole park

1. compare Operations Growth + Energy Loop hourly cost;
2. inspect Crew Radio with trained/zoned staff;
3. test Recycling Network with heavy food-service litter generation;
4. test Rain Shelter Network across bright/cloudy/rain transitions;
5. test Night Signature around 17:59 / 18:00;
6. combine Hospitality Growth + Wayfinding + care modules and inspect new-arrival limits;
7. confirm the four park-upgrade slots create meaningful alternative park builds.

### UI / save

1. Research the relevant project, then open Upgrade Bay and verify the module unlocks;
2. install/remove modules and confirm cash/parts recovery;
3. save/reload with mixed park/entity modules;
4. load a pre-upgrade save and inspect clean defaults;
5. inspect Upgrade Bay on Crisp / Retro / Tiny and touch targets;
6. confirm park controls do not leak through any open tool dialog.

## Promotion rule

Do not claim the ready-to-play `dist/game.js` contains the upgrade system until local has run the full test/build/browser gates, balanced stacking, repaired runtime/UI issues, and committed regenerated `dist/`.
