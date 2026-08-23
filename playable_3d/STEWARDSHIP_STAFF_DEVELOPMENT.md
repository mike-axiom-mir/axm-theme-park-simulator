# Steward Receipt — Routed Crew Development

## Status

`SOURCE_STACKED_AWAITING_LATER_LOCAL_INTEGRATION_REPAIR`

This pass extends the existing visible routed staff system. It does not create a
second staff simulation and does not claim the ready-to-play `dist/` bundle has
been rebuilt yet.

## Added

- individual persistent training level: 0 through 3;
- explicit cumulative training investment;
- work-zone assignment: Whole park, North, East, South, or West half;
- deterministic zone-aware cleaner jobs, mechanic jobs, and patrol destinations;
- stronger/faster trained staff through one bounded training profile;
- paid training from real park cash with today/lifetime cost accounting;
- training and zone events in the existing event log;
- selected-crew keyboard controls: `T` train, `Z` cycle work zone;
- selection explanation with current level, zone, and next training price;
- in-world staff development ring and three training pips;
- old saves receive level 0 / whole-park defaults through the existing staff normalizer.

## Training curve

Training is intentionally shallow rather than an RPG skill tree.

| Level | Move / minute | Cleaner capacity | Mechanic repair | Post-job cooldown |
| --- | ---: | ---: | ---: | ---: |
| 0 | 0.48 | 1.00 | +5 | 2 min |
| 1 | 0.54 | 1.35 | +7 | 1 min |
| 2 | 0.60 | 1.70 | +9 | 0 min |
| 3 | 0.66 | 2.05 | +11 | 0 min |

Training prices are €180, €260, and €360 for levels 1, 2, and 3.

## Zone rule

A work zone constrains which job targets and patrol destinations a staff member
may accept. It does **not** create invisible walls or teleportation. Staff still
use the normal declared pathfinder and may traverse connected paths outside the
named half while travelling to an allowed target.

Changing zone cancels the current assignment and returns the agent to idle so a
previous target cannot silently survive a new player instruction.

## Authority and economy boundary

Training and work-zone choices are authoritative staff-management state, so they
live in `core/staff.js` / `core/staffManagement.js`, not in the renderer.

The renderer only requests the action and visualizes the resulting committed
agent fields. Training spends real park cash and updates both today's and
lifetime costs. No free unit or free repair is created by the visual layer.

The central `simulation.js` dispatcher was deliberately not rewritten in this
chat pass. The playable client routes only the three bounded staff-development
actions to the staff core, while all existing actions still use `applyAction`.
Local integration may later fold these staff actions into the central dispatcher
if that is the cleaner long-term seam after runtime testing.

## Focused tests added

`tests/staff-management.test.js` covers:

- default level/zone fields;
- real training cost and bounded benefit;
- max-level refusal;
- out-of-zone job refusal followed by successful reassignment;
- trained mechanic repair strength while paid care remains charged;
- save/export/import persistence;
- playable action/control wiring and renderer authority separation.

These tests are committed but a full repository PASS is intentionally not
claimed from this connected GitHub seat.

## Later local intake route

Pull `steward/guest-body-language`, then run the repository gates from
`AGENTS.md` plus the real WebGL pass.

For this crew chunk specifically verify:

1. click a cleaner/mechanic and confirm the L0 / Whole park explanation;
2. press `T`, confirm cash drops by the stated price and a training pip appears;
3. press `Z`, confirm the zone name/ring changes and the old assignment clears;
4. place/produce work inside and outside the zone and confirm only allowed target
   work is accepted;
5. train a cleaner and compare litter removed per completed job;
6. train a mechanic and compare condition restored per paid care job;
7. save/reload and confirm level, investment, and zone persist;
8. visually check pips/rings at Crisp, Retro, and Tiny quality;
9. decide whether keyboard controls should remain or become inspector buttons.

## Hold

No `dist/game.js` rebuild, release promotion, or CANON claim is made here.
