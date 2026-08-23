# State Ownership, Actions, and Rollback

## State ownership

A module writes only namespaces declared in its manifest. Cross-module data is
read through published state/evidence contracts. Atomic batches contain either
authoritative updates or visual updates, never both.

## Actions

Every action follows:

1. proposal;
2. ownership and authority check;
3. state-version check;
4. domain validation;
5. visible decision;
6. deterministic event creation;
7. owning-module state update.

Player, campaign, and AI proposals use the same gate.

## Stale actions

An action created against an older state version is rejected and must be reviewed
or proposed again. It is never silently applied to a changed park.

## Rollback

Snapshots are immutable inputs for a new fork/load operation. The reference
state store does not secretly rewind a live state object. This keeps rollback,
branching, and replay explicit.
