# AXM Theme Park Simulator — Complete Handoff v0.3.0

This package contains the protected realistic-deterministic design, v0.1.0 and
v0.2.0 rollback releases, concept visuals, machine-readable contracts, and a
standard-library Python reference foundation.

## Central rule

A park element never loses value merely because it is old. Value changes through
people, geography, expectations, maintenance, operations, context, cost, and the
surrounding experience.

## What v0.3.0 adds

v0.2.0 established the protected simulation meanings. v0.3.0 adds the runtime
organs needed for independently built branches to become one living park:

- deterministic multi-rate phase scheduling;
- separate authoritative and visual clocks;
- namespace-owned atomic state updates;
- atomic command → event batch → reducer transactions;
- duplicate/stale command rejection and timekeeper authority;
- tamper-evident event history;
- verified snapshots, restore, and non-destructive branch lineage;
- audience cohorts that conserve population and separate first/repeat demand;
- recovery that repairs trust without erasing prior exposure;
- explicit capacity allocation and unmet demand;
- finite-number guards at module boundaries;
- contribution attribution with 100% anti-double-count protection and a stable ledger digest;
- metric/evidence provenance;
- maintain/evolve/replace/no-action counterfactual review without auto-choice;
- rebuildable JSON-safe non-authoritative animation signals whose identity includes state version;
- exact population-resolution checks and visual-actor budgets;
- runtime assembly validation;
- machine-verifiable branch return packets;
- evidence-backed first-map acceptance gates;
- two cross-organ living-park reference slices;
- hardened numeric, serialization, identity, and prior-exposure invariants so
  malformed or non-finite branch data is rejected before it enters park state.

The canonical v0.2.0 root files and aggregate root hash remain unchanged. The
foundation contract advances to 0.3.0; the compatible save envelope remains
0.2.0.

## Verify everything

```bash
python scripts/verify_package.py
```

## Run all four deterministic references

```bash
python scripts/run_reference_suite.py
```

Individual examples:

```bash
python examples/run_reference_demo.py
python examples/run_runtime_integration_demo.py
python examples/run_living_park_reference.py
python examples/run_first_map_reference_slice.py
```

## Current validation

The unpacked release passes **136 automated tests** before final archive
verification. The package verifier also checks roots, indexed hashes, manifests,
JSON, system plans, return packets, and repeatable demo output.

## Honest boundary

This is a strong tested foundation and integration protocol, not a falsely
labelled finished game. Detailed production branches still need to implement the
map/editor, ride builder and physics, visitor navigation, crew work, full economy,
renderer, visible self-made animations, first-person experience, and campaign maps.
The living references correctly report `first_map_ready: false`.
