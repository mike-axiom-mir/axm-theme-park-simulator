# Steward Receipt — Contextual Guest Body Language

## Status

`SOURCE_INTEGRATED_AWAITING_FULL_CHECK_AND_BUNDLE_REBUILD`

This steward pass extends the existing v0.4.6 playable source without changing
simulation authority, save schema, economy, pathfinding, visitor decisions, or
world ownership.

## What changed

- Added `src/presentation/guestBodyLanguage.js`, a pure deterministic descriptor
  for guest posture.
- Added `src/render/expressiveWorldRenderer.js`, an additive renderer subclass
  that applies posture only after the existing visitor renderer has positioned
  and animated each live guest.
- Switched the editable `src/main.js` entrypoint to that renderer subclass.
- Added `tests/guest-body-language.test.js` for determinism, non-mutation,
  precedence, existing thresholds, and presentation-authority separation.

## Current expressions

Existing simulation evidence can now produce presentation-only body language:

- long queue: impatient weight shift and head movement;
- low energy: slouched tired posture with slow breathing;
- low happiness: subdued disappointed posture;
- committed resting and service states remain owned by their existing seated and
  service animations.

The derivation reuses the already-established thresholds used by v0.4.6 guest
feedback: long wait after 36 minutes, rest need below 0.58 energy, and unhappy
visitor thought below 45 happiness.

## Authority boundary

The new presentation layer reads visitor evidence but never writes visitor,
economy, clock, save, event-log, routing, queue, or RNG state. It changes mesh
transforms and stores only the frozen presentation descriptor on the rendered
model's `userData`.

No save migration or version bump is required for this source change.

## Verification honestly completed in this steward seat

- isolated descriptor behavior checks: 4/4 passed;
- new presentation module syntax: passed;
- new renderer-extension syntax: passed;
- branch diff inspected: only one existing source line changed, plus three
  additive files before this receipt.

## Verification still required

The connected GitHub seat does not expose a runnable repository checkout, so the
full repository gate has **not** been claimed as passed here.

Before promotion, run from `playable_3d/`:

```bash
npm run check
```

That command runs the complete Node test suite and rebuilds the dependency-free
offline `dist/game.js` bundle. The current committed `dist/` remains the verified
v0.4.6 bundle until that rebuild is performed.

After rebuilding, repeat the existing local WebGL visual gate and specifically
observe:

1. a guest waiting longer than 36 minutes;
2. a guest below 0.58 energy while walking toward rest;
3. a low-happiness guest;
4. transitions from those poses into service, bench rest, and normal walking;
5. Crisp, Retro, and Tiny profiles for readability and visual noise.

## Promotion rule

Do not describe contextual guest body language as present in the ready-to-play
`PLAY_GAME.html` build until `npm run check` has regenerated `dist/game.js` and
the generated bundle is committed. Until then, this is a source-integrated
steward improvement awaiting the normal build gate.
