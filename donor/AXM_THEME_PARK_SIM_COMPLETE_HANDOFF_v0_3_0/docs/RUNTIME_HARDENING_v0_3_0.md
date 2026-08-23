# Runtime Hardening v0.3.0

This layer protects the deterministic park runtime from malformed branch data
without changing the canonical design roots.

## Hardened boundaries

- Audience populations, lifecycle stages, transition amounts, rates, capacity,
  contribution values, confidence, projected metrics, costs, and priority
  weights must be finite numbers within their declared bounds.
- Cohort recovery repairs willingness and trust while preserving prior exposure.
  A disappointed previous visitor can never silently become a first-time visitor.
- Animation parameters must survive canonical JSON serialization. Animation
  identity includes the committed authoritative state version, preventing two
  visually similar signals from different states from collapsing together.
- Population-resolution decisions validate exact conservation and report the
  maximum concrete visual-actor count required at each resolution tier.
- Contribution totals and ledger digests are independent of insertion order.
  Split attribution remains capped at 100% of one causal occurrence.
- Counterfactuals require a real lowercase SHA-256 baseline hash, finite values,
  non-negative costs and weights, unique plan/projection identities, and remain
  unable to commit authoritative state.

## Why this matters

Independent local or next-chat branches can fail through ordinary malformed
inputs, not only through intentional rule violations. These checks reject bad
state at the boundary instead of allowing NaN, infinity, negative population,
duplicate experiment identity, or non-serializable visual data to poison saves,
replay, evidence, or later merges.

## Validation

The hardening behavior is covered by `tests/test_runtime_hardening.py` and the
full package test suite. It remains reference infrastructure; it does not imply
a rendered playable first map.
