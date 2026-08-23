# Save, Migration, and Merge Gate

## Save manifest records

- save format version;
- foundation version;
- canonical root hash;
- module versions;
- simulation tick;
- state hash;
- event-log hash;
- parent save;
- migration history.

## Compatible load

A verifier checks:

- root hash;
- required modules;
- module versions;
- save format;
- state and event hashes when available.

## Migration

A migration plan names:

- from and to versions;
- transformations;
- affected contracts;
- before and after root hashes;
- change-request ID when roots differ;
- user-approval requirement;
- rollback save.

Canonical-root changes cannot be hidden inside ordinary save loading.

## Merge gate

No root difference:
- normal merge checks continue.

Root difference:
- explicit change request;
- matching before/after hashes;
- affected-root list;
- evidence;
- rollback plan;
- approved status.

Without those, the merge is blocked.
