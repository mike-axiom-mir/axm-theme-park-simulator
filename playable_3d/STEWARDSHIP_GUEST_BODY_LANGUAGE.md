# Steward Receipt — Guest Life + Park Vision

## Status

`SOURCE_STACKED_AWAITING_FULL_CHECK_AND_BUNDLE_REBUILD`

This steward pass deliberately stacks several presentation/game-readability
improvements on the existing v0.4.6 playable source before the later local
integration/repair run. It does not change simulation authority, save schema,
economy, pathfinding, visitor decisions, RNG, event authority, or world ownership.

## What changed

### Contextual guest body language

`src/presentation/guestBodyLanguage.js` derives frozen, deterministic visual
postures from evidence already owned by simulation:

- long queue -> impatient shifting/head movement;
- low energy -> tired/slouched breathing posture;
- low happiness -> subdued posture;
- high happiness while idle/walking -> small delighted bounce/raised-arm motion;
- resting and service states keep their existing committed activity animation.

The thresholds reuse existing v0.4.6 visitor evidence rather than introducing a
second hidden needs model.

Explicit guest selection projects the same descriptor into a short explanation
such as `Tired · low energy · 50%`. The text and body animation therefore share
one derivation instead of drifting independently.

### Weather-responsive guests

The same presentation module now derives a separate weather gesture from the
existing committed weather state:

- meaningful rain -> guests cover/hunch against precipitation;
- warm conditions while idle/queueing -> a bounded fanning gesture;
- riding, seated-resting, service-use, and departed guests do not receive these
  ambient weather gestures.

Weather gestures do not alter needs, route choice, movement speed, happiness,
spending, attendance, or any other simulation outcome.

### Park Vision management overlay

The expressive renderer now exposes a management-only Park Vision cycle:

`Off -> Crowd flow -> Queue pressure -> Guest needs -> Operations -> Off`

The top bar receives a source-generated Vision button and `V` cycles the same
modes from the keyboard.

The views reuse existing state:

- **Crowd flow** follows real visible guest positions;
- **Queue pressure** reads real queue capacity, queue length, access cell, and
  estimated wait;
- **Guest needs** reuses the existing Guest Pulse / guest-signal derivation;
- **Operations** reads actual element condition and spatial litter piles.

All modes are bounded by a hard 40-marker ceiling. Markers are translucent
world-space presentation rings and never become game entities or save data.

### Guest follow camera

A selected guest can be followed from management view with `F`. The management
camera target tracks that guest's already-rendered local position until `F` is
pressed again. Selecting an entity or crew member releases guest follow.

Guest follow has no simulation authority and is exposed in visual health only as
presentation state.

## Files involved

The stacked pass remains concentrated in five files:

- `src/main.js` — switches to the expressive renderer and injects/cycles Park
  Vision UI;
- `src/presentation/guestBodyLanguage.js` — pure posture/weather descriptors and
  human-readable projections;
- `src/render/expressiveWorldRenderer.js` — additive guest expression, weather,
  Park Vision, and guest-follow presentation;
- `tests/guest-body-language.test.js` — focused evidence/budget/boundary tests;
- this stewardship receipt.

No protected foundation, donor, simulation, save, pathfinding, catalog, economy,
or existing base-renderer source file is modified by this branch.

## Authority boundary

The new layer may:

- read committed visitor/entity/weather/litter state;
- move presentation meshes;
- render bounded overlay markers;
- move the management camera;
- store transient descriptors on render-model `userData`;
- emit player-facing explanatory messages.

It may **not**:

- call `advanceOneMinute` or `applyAction`;
- change visitor needs, happiness, targets, routes, queues, budgets, or attendance;
- change entity condition, revenue, price, open state, or queue authority;
- alter weather, clock, economy, RNG, event log, saves, or world ownership;
- promote visual interpretation into simulation truth.

No save migration or version bump is required for these source-only presentation
changes.

## Verification completed in this steward seat

- initial body-language descriptor checks: 4/4 passed;
- descriptor + human-readable projection isolated execution: passed;
- source-level branch diff repeatedly inspected while stacking features;
- hard Park Vision marker ceiling is represented in focused tests;
- tests cover deterministic/non-mutating Park Vision projection from queue, need,
  condition, and litter evidence;
- tests cover positive posture precedence and weather-gesture non-mutation;
- a discovered arm-rotation carryover bug was repaired by explicitly resetting
  additive arm `z` offsets before applying the next expression.

## Verification still required

The connected GitHub seat does not expose a runnable repository checkout, so the
full repository gate is **not** claimed as passed here. An auxiliary execution
seat also cannot reach GitHub over external DNS, so it was not used to fabricate
a checkout-based PASS.

Repository-level required checks from `AGENTS.md` remain:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

The root `npm run check` combines intake verification, headless tests, playable
tests, and playable rebuild; donor verification remains separate.

The committed `dist/` therefore remains the previously verified v0.4.6 bundle.
Do not claim the stacked source work is present in `PLAY_GAME.html` until the
normal build gate regenerates and reviews `dist/game.js`.

## Later local visual / repair route

When the stacked branch eventually goes local, inspect at least:

1. impatient, tired, subdued, delighted, seated-rest, and service transitions;
2. rain-cover and hot-weather fanning gestures, including transition back to
   normal arms/posture;
3. selected-guest explanation matching the actual visible cue;
4. all four Park Vision views at low and high guest counts;
5. the 40-marker ceiling under crowd pressure;
6. Vision readability at Crisp, Retro, and Tiny quality;
7. guest follow across queues, services, path corners, departure, and guest
   removal;
8. normal camera control immediately after releasing follow;
9. no visual marker becoming selectable/authoritative by accident;
10. save/reload and deterministic full-day/three-day smokes remaining unchanged.

## Promotion rule

Keep this work review/draft until the later local integration pass runs the full
repository checks, rebuilds the offline bundle, performs the WebGL visual route,
and repairs anything those gates reveal. No CANON or release claim is implied by
this steward branch.
