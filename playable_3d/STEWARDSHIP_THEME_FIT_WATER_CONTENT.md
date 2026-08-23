# Stewardship — District Fit + Water District Content

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass extends the existing style-only district foundation instead of replacing it. It adds an explainable attraction/content fit layer, a sixth `Waterfront` district identity, stronger fit-aware presentation dressing, and twelve original water-oriented buildables.

## Player-facing outcome

District styling now has a soft content relationship:

- every catalog element receives an explainable theme-tag vocabulary from explicit tags and existing catalog evidence;
- district profiles declare signature and preferred tags;
- fit is reported as Signature fit / Strong fit / Compatible / Flexible fit / Style contrast;
- fit never blocks construction;
- deliberate contrast remains allowed;
- there is no decoration-count grind;
- there are no automatic economy, rating, guest, pathfinding, staff or research effects.

A compact **Fit** top-bar control updates while hovering a build location or selecting a park element. It shows the active district style and current fit result; clicking it explains the matching tags or the deliberate-contrast route.

Strongly fitting elements receive an additional small low-poly dressing cluster. The dressing is presentation-only and depends on already-committed district/content evidence.

## District identities

The existing identities remain:

- Neutral;
- Garden;
- Adventure;
- Storybook;
- Future.

Added:

- **Waterfront** — boardwalk timber, reeds, mist, harbour lights and attractions shaped around water.

The deterministic North / East / South / West district geometry is unchanged. Save schema remains `axm.themepark.districts/v1`; old saves still default to Neutral, and no save-version bump was required.

## Theme-fit vocabulary

Current tags:

- water;
- garden;
- adventure;
- storybook;
- future;
- family;
- thrill;
- scenic;
- indoor;
- food & drink;
- retail;
- guest care;
- flexible.

Explicit content tags take priority. Existing catalog fields such as `theme`, `visualFamily`, guest-fit values, category, need and influence provide explainable fallback evidence.

## Water district content pack

### Attractions and rides

1. Lantern Canal Cruise
2. Tidal Turntable
3. Mist Garden Play
4. Moonlit Lagoon Show

All four use the existing authoritative ride contract for capacity, cycle, pricing, operating spend, condition and normal guest commitment. Each receives a dedicated animated model and ride-camera anchor.

### Service, rest and retail

5. Harbour Fizz Deck — real thirst service through the current service loop.
6. Waterside Gazebo — real rest support through the current rest contract.
7. Poncho Pier — honest passive retail content; no fabricated purchases were added.

### Scenery

8. Lily Pond
9. Cascade Garden
10. Reed Bank
11. Boardwalk Deck
12. Harbour Light

`Boardwalk Deck` is explicitly decorative scenery and does not pretend to replace authoritative path connectivity.

## Visual work

Dedicated low-poly models include:

- moving canal boats with visible committed riders;
- rotating water pods;
- animated splash jets;
- lagoon fountain/light choreography;
- harbour drink props;
- waterside gazebo and deck;
- poncho display and buoy;
- pond lilies and ripples;
- waterfall sheet/droplets;
- swaying reeds;
- timber boardwalk planks;
- rotating harbour-light beam.

The fit-aware presentation layer adds bounded Garden / Adventure / Storybook / Future / Waterfront dressing only when the content actually supports that district identity. Contrasting elements keep their own identity instead of being forcibly skinned.

## Architecture / repair path

```text
preserved simulation
  -> research/growth runtime
    -> installed-upgrade runtime
      -> preserved presentation stack
        -> park identity visuals
          -> waterfront/theme-fit presentation
            -> state normalization/hash guard
              -> stable contentStudioWorldRenderer import
```

New core modules:

- `src/core/themeFit.js`
- `src/core/waterDistrictCatalog.js`

New presentation modules:

- `src/render/waterDistrictModels.js`
- `src/render/waterfrontIdentityWorldRenderer.js`

Modified additive seams:

- `src/core/catalog.js`
- `src/core/districts.js`
- `src/render/specialContentWorldRenderer.js`
- `src/render/stateSafeParkIdentityWorldRenderer.js`

`simulation.js` remains unaware of theme fit and Waterfront presentation. Existing ride/service/scenery authority remains responsible for real gameplay.

## Focused tests

`tests/theme-fit-water-content.test.js` covers:

- Waterfront as a valid style-only district identity;
- twelve water buildables and exactly one campaign progression home each;
- authoritative ride contracts;
- normal money/placement build actions;
- explainable fit and placement-aware district lookup;
- non-mutating dedicated models and ride-camera anchors;
- renderer/catalog layering outside preserved simulation.

## Verification boundary

The source pass intentionally leaves `dist/game.js` untouched.

Completed in this connected seat:

- `node --check` passed for all new and replaced JavaScript modules in this pass;
- an isolated focused harness passed catalog registration for 12 water buildables, 4 authoritative ride definitions, campaign placement, soft-fit evaluation, non-mutating placement lookup, and construction/update of every dedicated model;
- an isolated renderer harness also verified the Waterfront fit dressing root, advisory Fit control, explanation route and visual-health receipt;
- both harnesses used a minimal Three-compatible test stub, so they are evidence of module logic and API use, **not** a real vendor/WebGL render PASS.

A real branch checkout was attempted for the repository test suite, but the execution container could not resolve `github.com`. Therefore no full Node, build, browser or package PASS is claimed here.

Required later local gates remain:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

The real WebGL/play gate should inspect:

- scale and placement of all twelve water models;
- water material readability on Retro / Crisp / Tiny quality;
- ride-camera comfort for all four attractions;
- click/select behavior through fit dressing meshes;
- Fit-control updates during mouse, touch and rotated placement;
- Waterfront cycling and save/load;
- density/performance in a heavily themed water district;
- no accidental gameplay effects from fit status;
- no replacement of real paths by Boardwalk Deck scenery.
