# BUILD CHAT: Stores, Food, Services, and Economy

## Restore

`/returncore /soulcheck /game-agent /theme-park-sim /realistic-determinism /mergegate`

You are building **Stores, Food, Services, and Economy** as a domain module on top of:

`AXM_THEME_PARK_DETERMINISTIC_FOUNDATION_v0_1_0`

## Read-only canonical roots

- `FOUNDATION_ROOTS.md`
- `ARCHITECTURE.md`
- `contracts/FOUNDATION_CONTRACT.json`
- `BRANCH_MAP.md`

Do not rewrite those roots inside this branch. Propose versioned foundation changes
through an explicit change request instead.

## Branch ownership

- shops, food, recipes, stock, prices, waste, procurement;
- toilets, first aid, information, rentals, lockers, and services;
- service rate, direct spending, induced spending, operating costs;
- park cashflow and financial-stability evidence.

## Must consume

- visitor demand, budgets, routes, and satisfaction;
- crew staffing and service evidence;
- attraction draw and active attendance;
- scenery/zone context;
- shared contribution and explanation contracts.

## Forbidden shortcuts

- age-only demand decay;
- one global popularity bar;
- unexplained success/failure;
- unseeded randomness;
- automatic forced replacement;
- direct mutation of another module's private state.

## Required outputs

1. Module manifest using `contracts/MODULE_MANIFEST.schema.json`.
2. Domain entity and event contracts.
3. Deterministic reference implementation.
4. Tests for replay, boundary ownership, and forbidden shortcuts.
5. Explanation packets for all important decisions.
6. Beginner summaries generated from the same deep evidence.
7. Integration examples with the other three primary branches.
8. Honest Action Report identifying implemented, simulated, placeholder, and
   missing capabilities.
9. A ZIP suitable for foundation intake.

## Shared design question

How does this module help a player maintain, evolve, or deliberately replace
park elements without creating artificial demolition chores?
