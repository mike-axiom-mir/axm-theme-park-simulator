# Event Cursor Lane Receipt — 2026-09-09

## Scope

One architecture repair: separate canonical event identity from the bounded `eventLog` projection used by the active v0.4.6 playable and headless runtime.

## Invariants exercised

- More than 400 emitted events retain unique, strictly increasing identities.
- Save round trips preserve the cursor and allocate the next identity exactly once.
- Legacy duplicated identities remain visible and receive an explicit ambiguity label rather than silent renumbering.
- Cursor drift, retention-policy drift, oversized windows and unsupported continuity fail at headless admission.
- Continuous streams must retain an exact contiguous suffix ending at the canonical cursor; impossible internal gaps and empty nonzero windows fail closed.
- Browser and headless clients consume the same shared deterministic capability.

## Authority boundary

The lane is stacked on the exact CI/intake repair in PR #2. It does not alter that lane's workflow or verifier. It remains a review branch, does not merge or promote itself, and has no CANON authority.

## Evidence

- Event-stream mutation and migration suite: 4/4 passed.
- Active playable suite: 48/48 passed.
- Headless runtime suite: 7/7 passed.
- Protected foundation suite: 39/39 passed.
- Donor package verifier and suite: 136/136 passed.
- Intake verifier: 172 active files, 204 donor files and all six declared local patches verified.
- Browser bundle: 22 local modules, 972,120 bytes.
