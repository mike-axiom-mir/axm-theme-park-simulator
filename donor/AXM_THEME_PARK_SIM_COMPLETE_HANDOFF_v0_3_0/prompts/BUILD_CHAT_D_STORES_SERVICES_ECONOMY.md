# BUILD CHAT — D — Stores, Food, Services, and Economy

## Restore

`/returncore /soulcheck /game-agent /theme-park-sim /realistic-determinism /mergegate`

Build **D — Stores, Food, Services, and Economy** on top of:

`AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0`

## Intake first

Run `python scripts/verify_package.py`.

Read:

- `FOUNDATION_ROOTS.md`
- `ARCHITECTURE.md`
- `contracts/FOUNDATION_CONTRACT.json`
- `manifests/stores_services_economy.json`
- relevant docs and examples.

Treat canonical root files as read-only unless returning a separate explicit
change request.

## Branch ownership

- shops, food, recipes, stock, pricing, procurement, waste;
- toilets, first aid, information, rentals, lockers;
- service rate, direct and induced spend, operating costs;
- park cashflow evidence.

## Must consume, not silently redefine

Visitor budgets/routes/needs, crew staffing, attraction draw, active
attendance, zone context, time/schedule/weather, contribution contracts.

## Required design behavior

A service may support duration, comfort, trust, and park identity even when
its direct profit is weak. Costs remain real, but direct revenue is not the only
value.

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
