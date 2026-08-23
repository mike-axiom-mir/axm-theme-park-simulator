# Architecture Extension v0.3.0 — Living Runtime Spine

This document extends the protected v0.2.0 design architecture without changing
its canonical root files or aggregate root hash.

## Why this round exists

v0.2.0 defined strong meanings, evidence, world state, and branch boundaries. A
remaining risk was practical fragmentation: every branch could be locally valid
but still fail to become one deterministic park. A second risk was proving only
isolated reference functions while never running them together.

v0.3.0 addresses both risks.

## Runtime layers

### 1. Phase and cadence planning

Every system declares phase, cadence, priority, read namespaces, write
namespaces, authority status, and whether it is skippable. Registration order
cannot change execution order.

Authoritative simulation work is never skippable. Visual work can be dropped or
reconstructed when hardware is overloaded.

### 2. Atomic command kernel

A state-changing request follows:

`CommandEnvelope → owning handler → CommandPlan → ParkEvent batch → reducers → one state commit`

A stale state version, duplicate command, wrong timekeeper, missing handler, or
failed reducer leaves both state and event log unchanged.

### 3. Owned authoritative state

Every module owns explicit state. Cross-owner writes are rejected. The shared
state envelope hashes each complete version while module payload meaning remains
with the owner.

### 4. Hash-chained event history

Events use deterministic IDs and seeds. Atomic batches are preflighted before
append. Every record commits the previous record hash, enabling replay and
integrity validation.

### 5. Snapshots and branches

A snapshot binds state hash, event-log hash, root hash, module versions, tick,
branch, reason, and creator. Restore is verified. An experiment creates a child
branch with explicit lineage; it does not rewrite the parent.

### 6. Audience market ecology

Audience cohorts conserve population across awareness, consideration, first-time
readiness, prior satisfaction, loyalty, disappointment, and recovery. Marketing
moves people between states; it cannot create people. Visit capacity limits both
first-time and repeat demand.

### 7. Causal contribution ledger

One real value occurrence can be attributed across several park elements, but
total attribution cannot exceed 100%. Unallocated value remains explicitly
unallocated rather than being invented or duplicated.

### 8. Evidence and counterfactual planning

Derived metrics preserve algorithm, state, evidence, assumptions, confidence,
and contributions. Counterfactuals are read-only. They retain a no-action
baseline, expose missing evidence and cost, and never auto-commit a replacement.

### 9. Visual adapter boundary

Animations are rebuildable signals derived from authoritative events. Rendering,
interpolation, dropped frames, and visual-resolution tiers cannot change park
truth.

### 10. Assembly, return, and readiness gates

Manifests declare entities, capabilities, events, namespaces, and systems.
Branches return hashed artifacts with honest capability status. A first map is
not ready while a required check is failed or not run.

## Living reference

`examples/run_living_park_reference.py` connects the kernel, ride state, audience
cohort, economy, contribution ledger, animation signal, snapshot/restore, branch
fork, counterfactual review, cadence, population resolution, and acceptance gate.

It is deliberately a reference state rather than a rendered map. Its purpose is
to prove the organs communicate while preserving the project roots and honest
status boundaries.
