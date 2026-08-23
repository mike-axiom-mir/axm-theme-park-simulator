# Runtime Organ API Map — Beginner-Friendly Entry

The package now has two related reference paths. They are intentionally separate:

- `VersionedStateStore` demonstrates namespace ownership and visual-versus-authoritative versions.
- `SimulationKernel` demonstrates one atomic command, event batch, and reducer transaction.

A production runtime can adapt or combine them, but a domain branch must not
silently invent a third state-changing path.

## Core files

| Need | Reference file | Main objects | What it protects |
|---|---|---|---|
| Stable ordering | `scheduler.py` | `SystemSpec`, `DeterministicScheduler` | Registration timing cannot change simulation order. |
| Simulation/render clocks | `cadence.py` | `SimulationCadencePlan`, `AnimationSignal` | Visual frames may drop; simulation truth may not. |
| Namespace ownership | `state_store.py` | `NamespaceSpec`, `VersionedStateStore` | A module cannot write another module's private state. |
| Atomic domain actions | `kernel.py` | `CommandEnvelope`, `CommandPlan`, `SimulationKernel` | Handler/reducer failure cannot partially commit state or events. |
| Replay history | `event_log.py` | `ParkEvent`, `DeterministicEventLog` | Events are ordered, seeded, hash-chained, and batch-atomic. |
| No-loss experiments | `snapshot.py` | `StateSnapshot`, `SnapshotStore`, `BranchLineage` | Restore and fork are explicit; `main` is not silently rewritten. |
| Audience lifecycle | `market.py` | `AudienceCohortState`, `CohortForces` | Marketing moves people; recovery never erases prior exposure. |
| Whole-park value | `ledger.py` | `ContributionClaim`, `ContributionLedger` | One occurrence cannot be counted twice; totals/digest do not depend on insertion order. |
| Evidence lineage | `provenance.py` | `DerivedMetricRecord`, `ProvenanceLedger` | Important numbers retain causes, inputs, versions, and evidence. |
| Choice review | `counterfactual.py` | `CounterfactualProjection` | Finite, baseline-bound maintain/evolve/replace reviews remain visible options, not forced actions. |
| Safe module intake | `assembly.py`, `return_packet.py` | planners and verifiers | Separate branch builds must actually fit together. |
| No fake release | `acceptance.py` | `AcceptanceReport` | Missing production evidence remains visibly blocking. |

## Recommended domain-module flow

1. Receive a `CommandEnvelope` against an exact state version.
2. Return a pure `CommandPlan`; do not mutate state in the handler.
3. Let the kernel create deterministic events.
4. Update only registered module-owned state through reducers.
5. Publish evidence and contribution claims from committed events.
6. Derive animation signals from those events; never reverse authority.
7. Capture a snapshot before irreversible experiments.
8. Return the branch through a verified return packet and assembly check.

## Runnable examples

```bash
python examples/run_runtime_integration_demo.py
python examples/run_living_park_reference.py
python examples/run_first_map_reference_slice.py
python scripts/run_reference_suite.py
```

The two living slices deliberately return `first_map_ready: false`. They prove
integration behavior, not rendered gameplay. `docs/RUNTIME_HARDENING_v0_3_0.md`
records the malformed-input and truth-preservation boundaries tested around these
organs.
