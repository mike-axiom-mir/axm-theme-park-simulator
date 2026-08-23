# BUILD CHAT: Stores, Food, Services, and Economy

## Restore

`/returncore /soulcheck /game-agent /theme-park-sim /realistic-determinism /mergegate`

Build **Stores, Food, Services, and Economy** on top of `AXM_THEME_PARK_MASTER_FOUNDATION_v0_2_0`.

## Read-only source priority

1. `FOUNDATION_ROOTS.md`
2. `contracts/FOUNDATION_CONTRACT.json`
3. `BRANCH_MAP.md`
4. relevant supporting docs

Do not rewrite canonical roots. Submit a `CHANGE_REQUEST.schema.json` packet for a
material foundation change.

## Branch ownership

- products, food, stock, prices, waste, procurement;
- toilets, first aid, information, rentals, lockers;
- service rate, spend, operating cost, cashflow evidence.

## Must consume

- visitor routes/budgets; crews; attraction draw; active attendance;
- scenery zones; clock/environment; contribution contracts.

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
