# Architecture

## Core layers

### Layer 0 — Deterministic Runtime

Owns simulation clock, seeds, stable IDs, ordered events, snapshots, replay,
module versions, and evidence lineage.

### Layer 1 — Shared Park Ecology

Owns geography, market reach, park identity, audience interfaces, active
attendance, capacity pressure, park-level economics, reputation, expectation,
and contribution accounting.

### Layer 2 — Domain Providers

Independent modules provide detailed behavior:

- rides and attractions;
- visitors and crews;
- decoration, atmosphere, and influence;
- stores, food, services, and economy;
- transport and accommodation;
- weather and environment;
- animation and rendering;
- later physics and architecture validation.

### Layer 3 — Experiences

Campaigns, sandbox, scenarios, adventure mode, tutorials, challenge modes,
accessibility presets, and multiplayer use the same domain state.

### Layer 4 — Interfaces

Beginner cards, advanced dashboards, evidence inspectors, visual park view,
first-person/adventure view, editors, mod tools, and architect tools.

## Authoritative flow

1. A player, AI, campaign, or world process proposes an action.
2. The owning domain module validates the action.
3. The foundation records an ordered event with seed and evidence references.
4. Affected domain modules calculate state changes.
5. The foundation stores outcomes and explanation packets.
6. Interfaces render the same authoritative state at different detail levels.

## Integration rule

A module may:

- own new entity types;
- publish capabilities;
- emit or consume events;
- add evidence;
- calculate a declared metric;
- propose player actions.

A module may not:

- mutate another module's private state directly;
- redefine canonical fields;
- use unseeded randomness;
- create unexplained global popularity;
- infer success from age alone;
- force replacement as routine upkeep.
