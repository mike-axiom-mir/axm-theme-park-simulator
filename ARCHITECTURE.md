# Architecture v0.2.0

## Layer 0 — Deterministic runtime

Owns stable IDs, canonical serialization, seeds, ordered events, simulation clock,
state hashes, snapshots, replay, module versions, migration lineage, and rollback.

## Layer 1 — Shared park ecology

Owns geography, market reach, park identity intent, audience interfaces, active
attendance, capacity pressure, expectation, reputation, contribution accounting,
season/environment contracts, and evidence vocabulary.

## Layer 2 — Domain providers

Independent modules provide rides, visitors, crews, scenery, stores, services,
transport, accommodation, weather generation, animation, rendering, physics, and
architecture validation.

## Layer 3 — Experiences

Campaigns, scenarios, sandbox, tutorials, challenge modes, adventure inspection,
AI observation, accessibility presets, and multiplayer consume the same state.

## Layer 4 — Presentation and tools

Beginner cards, advanced dashboards, evidence inspectors, park view, first-person
view, editors, mod tools, and architect tools show the authoritative state through
versioned adapters.

## Authoritative transaction flow

1. A player, AI, campaign, or world process proposes an action.
2. The owning domain validates it and records evidence.
3. The runtime appends an ordered seeded event.
4. Consuming domains calculate declared state changes.
5. A new state snapshot and explanation packets are produced.
6. Presentation adapters render the same state at chosen visual and assistance
   profiles.
7. Save and replay systems retain module versions, hashes, and migration lineage.

## Separation that must survive implementation

- simulation tick versus visual frame;
- park identity versus universal success rank;
- assistance profile versus simulation difficulty/initial conditions;
- campaign ending availability versus author-preferred ending;
- adventure observation versus state mutation;
- evidence confidence versus fact;
- visual downgrade versus simulation downgrade;
- maintenance closure versus demolition;
- foundation contract change versus branch-local implementation.

## Module integration rule

A module may own new entity types, publish capabilities, emit or consume events,
add evidence, calculate declared metrics, and propose actions.

A module may not mutate another module's private state, redefine canonical fields,
use unseeded state-changing randomness, create unexplained global popularity,
infer failure from age alone, force replacement as routine upkeep, or alter state
through a visual or beginner interface.
