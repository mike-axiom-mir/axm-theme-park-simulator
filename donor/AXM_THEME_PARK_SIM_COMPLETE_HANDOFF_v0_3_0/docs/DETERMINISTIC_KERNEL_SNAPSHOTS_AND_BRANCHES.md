# Deterministic Kernel, Snapshots, and Branches

## Command transaction

Every mutation declares:

- a stable command ID;
- actor and owning module;
- expected state version;
- authoritative tick;
- JSON-safe payload;
- optional evidence and correlation lineage.

The owning handler returns a pure `CommandPlan`. It does not mutate the world.
The kernel deterministically derives events, runs every subscribed reducer on a
detached state copy, and appends the event batch only after all reducers succeed.
The complete state version advances once.

## Rejection and rollback

The reference kernel rejects:

- stale versions;
- duplicate command IDs;
- missing owners/handlers;
- commands behind authoritative time;
- non-foundation tick advancement.

A reducer failure raises `SimulationTransactionError`; no event is appended and
the caller retains the original state.

## Snapshots

A snapshot records:

- state and event-log hashes;
- world, branch, tick, and state version;
- canonical design-root hash;
- module versions;
- reason and creator;
- optional parent snapshot.

Restore recomputes and verifies hashes before returning data.

## Branching

A fork changes only the branch ID and records explicit lineage. The parent state
and event history remain available. This is the default safe path for uncertain
or irreversible experiments, including new visitor models, physics, economics,
and large park redesigns.
