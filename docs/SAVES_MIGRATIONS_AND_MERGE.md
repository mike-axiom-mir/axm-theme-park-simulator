# Saves, Migrations, and Merge Gate

## Snapshots

State snapshots use canonical JSON serialization and SHA-256. Module versions and
contract versions are part of the snapshot. A previous-snapshot hash can form an
explicit lineage.

## Rollback

Rollback returns a verified prior snapshot. It is not a silent rewrite; a runtime
using rollback should append a rollback event identifying the selected snapshot.

## Migrations

Every migration declares source version, target version, migration ID, and an
explicit transform. Version gaps or branching ambiguity fail instead of guessing.
Production migrations should add reverse transforms where lossless rollback is
possible.

## Merge gate

The reference merge gate only determines whether a change request is eligible for
human review. It never automatically canonizes root changes. Protected-root impact,
rationale, evidence, base version, and target version must be explicit.
