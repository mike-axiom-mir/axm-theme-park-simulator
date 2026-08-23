# Architecture v0.2.0

## Design shape

The project is a versioned event-driven simulation with independent domain
owners. Deep simulation state is authoritative; interfaces and game modes are
views and action sources.

## Layer 0 — Root integrity

Owns:

- canonical roots and hashes;
- foundation contract version;
- forbidden shortcuts;
- change requests;
- merge gate;
- rollback requirements.

No domain module can silently redefine this layer.

## Layer 1 — Deterministic runtime

Owns:

- stable IDs;
- canonical serialization;
- deterministic seeds;
- simulation ticks;
- ordered events;
- event hash chain;
- snapshots and replay;
- save manifests;
- migration history.

## Layer 2 — Shared park ecology

Owns shared contracts for:

- world clock, season, weather, daylight, opening schedule;
- geography and travel friction;
- audience reach and awareness;
- player park-identity intent;
- active attendance and scale;
- expectation, reputation, and contribution;
- evidence, confidence, and explanation packets.

This layer provides shared meaning, not detailed ride, guest, scenery, or store
behavior.

## Layer 3 — Domain modules

Primary independent branches:

1. Rides and Attractions
2. Visitors and Crews
3. Decoration, Atmosphere, and Influence
4. Stores, Food, Services, and Economy

Later providers:

- transport and accommodation;
- weather depth and seasonal operations;
- campaign/scenario authoring;
- adventure inspection;
- old-school animation and rendering;
- physics adapter;
- theme-architect planning and validation.

Each module owns its private entities, publishes capabilities, consumes contracts,
and communicates through events/evidence.

## Layer 4 — Experiences

- sandbox;
- campaigns;
- scenarios;
- tutorials;
- challenge modes;
- shared-screen multiplayer;
- AI-observer or AI-player seats;
- postgame hooks.

All experiences use the same world state.

## Layer 5 — Interfaces

- beginner guidance;
- standard management UI;
- advanced evidence inspector;
- park overview;
- first-person/adventure camera;
- editors and mod tools;
- architecture/planning views.

Presentation profiles can reduce visible detail but cannot change simulation
outcomes.

## Authoritative action flow

1. A player, AI, campaign, or world process proposes an action.
2. The owning module validates it against current state and contracts.
3. The runtime derives or records a deterministic seed.
4. An ordered event is appended to the tamper-evident log.
5. Owning and subscribed modules calculate state transitions.
6. Evidence and explanation packets are stored with state version and confidence.
7. Interfaces render the same state at an appropriate detail level.
8. A save records root, module, state, and event-log hashes.

## Cross-branch rule

Modules may not reach into another branch's private state. They request published
evidence or react to declared events.

## Reference-code boundary

`src/park_foundation` proves contract shape and determinism. It is intentionally
small and standard-library-only. Production engine choices remain open.
