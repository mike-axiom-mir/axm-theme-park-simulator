# Contribution Ledger and Counterfactual Review

## Contribution claims

A park element can create direct and indirect value. The ledger supports benefits
such as revenue, induced spending, visit attraction, duration, identity, crowd
balance, heritage, and resilience, plus operating, maintenance, staffing, risk,
and land-opportunity costs.

Each claim cites one causal occurrence and allocates a share. Several subjects may
share the value, but all shares for the same occurrence must total no more than
1.0. Conflicting base amounts, duplicate IDs, and over-allocation are rejected
atomically.

Unallocated share stays visible. The ledger never invents a beneficiary merely
to make totals look complete. Totals use stable summation, and the complete ledger
has an insertion-order-independent digest for save, replay, and merge evidence.

## Counterfactuals

Maintain, evolve, replace, retarget, refurbish, preserve, capacity upgrade, and
no-action can be reviewed against one exact baseline state hash/version.

A projection exposes:

- metric changes;
- costs separately from score;
- evidence coverage;
- confidence;
- assumptions;
- reversibility.

The no-action baseline is always retained. Baseline hashes must be real SHA-256
hex, all metric/cost inputs must be finite, and projection identities must be
unique. Comparison produces review order, not an automatic command. An
irreversible proposal should first fork a rollback branch.
