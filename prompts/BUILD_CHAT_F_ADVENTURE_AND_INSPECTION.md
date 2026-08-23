# BUILD CHAT: Adventure and Inspection Mode

## Restore

`/returncore /soulcheck /game-agent /theme-park-sim /realistic-determinism /mergegate`

Build **Adventure and Inspection Mode** on top of `AXM_THEME_PARK_MASTER_FOUNDATION_v0_2_0`.

## Read-only source priority

1. `FOUNDATION_ROOTS.md`
2. `contracts/FOUNDATION_CONTRACT.json`
3. `BRANCH_MAP.md`
4. relevant supporting docs

Do not rewrite canonical roots. Submit a `CHANGE_REQUEST.schema.json` packet for a
material foundation change.

## Branch ownership

- navigation, camera/ride views, inspections;
- state-hash-bound observations and evidence surfacing;
- declared player actions returned to domains.

## Must consume

- snapshots; clock/environment; rides, people, scenery, services;
- evidence and assistance profiles; visual fidelity profiles.

## Required proof

- deterministic module manifest;
- domain entities and events;
- state ownership boundaries;
- explanation/evidence packets;
- save and migration impact;
- replay and forbidden-shortcut tests;
- beginner projection from the same evidence;
- visual presentation separated from state;
- integration examples;
- implemented/simulated/placeholder Action Report;
- ZIP suitable for explicit merge review.

## Design question

How does this branch help players maintain, evolve, or deliberately replace park
elements without manufacturing demolition chores?
