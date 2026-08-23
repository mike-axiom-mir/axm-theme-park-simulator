# BUILD CHAT — A — Rides and Attractions

## Restore

`/returncore /soulcheck /game-agent /theme-park-sim /realistic-determinism /mergegate`

Build **A — Rides and Attractions** on top of:

`AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0`

## Intake first

Run `python scripts/verify_package.py`.

Read:

- `FOUNDATION_ROOTS.md`
- `ARCHITECTURE.md`
- `contracts/FOUNDATION_CONTRACT.json`
- `manifests/rides_and_attractions.json`
- relevant docs and examples.

Treat canonical root files as read-only unless returning a separate explicit
change request.

## Branch ownership

- ride definitions and construction;
- cycle, dispatch, capacity, throughput, downtime;
- condition, reliability, comfort, intensity, accessibility;
- maintenance and refurbishment evidence;
- first-experience and repeat-experience properties;
- later physics adapter boundary.

## Must consume, not silently redefine

World clock, schedule, weather, park identity, visitor/crew requests,
atmosphere evidence, financial evidence, shared explanation/evidence contracts.

## Required design behavior

A ride exposes causal experience and operational evidence. It never owns
universal popularity. Age may affect parts, condition, heritage, and knowledge,
but never demand by itself.

## Forbidden shortcuts

- age-only demand decay;
- one global popularity bar;
- scenery value from object count;
- automatic forced replacement;
- unseeded state-changing randomness;
- unexplained important outcomes;
- direct mutation of another branch's private state;
- loss of confidence or evidence status;
- beginner behavior different from advanced simulation;
- adventure state separate from management state.

## Required return packet

1. Versioned module manifest.
2. Domain entities and JSON contracts.
3. Declared emitted/consumed events.
4. Deterministic reference implementation or explicit scaffold.
5. Replay tests and forbidden-shortcut tests.
6. Explanation packets and beginner summaries from the same state.
7. Cross-branch integration example.
8. Save/migration effect, if any.
9. Unresolved questions and missing capabilities.
10. Honest Action Report: implemented / simulated / placeholder.
11. Merge-ready ZIP.

## Merge question

How does this branch help players maintain, evolve, or deliberately replace park
elements without artificial demolition chores?


## v0.3.0 runtime-integration return requirements

In addition to the domain work above, return:

- state namespace declarations with one owner per namespace;
- deterministic `SystemSpec` entries with phase, cadence, reads, and writes;
- action proposal rules and emitted events;
- no authoritative system marked skippable;
- derived metrics with algorithm version, state version, evidence, confidence,
  assumptions, and input lineage;
- a machine-readable Branch Return Packet;
- an assembly report run against all current manifests;
- deterministic replay tests and stale/cross-owner mutation tests;
- exact separation of implemented, reference, and placeholder capabilities.

Do not claim first-map readiness. Only an evidence-backed acceptance report with
all required checks passing may do that.
