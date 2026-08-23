# AGENTS.md — Standalone Theme Park Simulator

## Repository boundary

This repository is the standalone AXM Theme Park Simulator branch. It is a
sibling of Workshop, Mirror, Living City, and the Factual Space Simulator.
None of those repositories is a required runtime host.

The browser/WebGL build is one client of the simulation. The deterministic
simulation must remain usable through Node.js without `window`, `document`, or
`localStorage`.

## Preserved lineages

- The active playable lineage is v0.4.6 under `playable_3d/`, carried with its
  protected v0.2.0 foundation files.
- The complete v0.3.0 deterministic donor is preserved under
  `donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/`.
- Do not flatten these into one source-of-truth kernel without an explicit
  compatibility and save-migration decision.

Files supplied by the intake archives are preserved byte-for-byte in the first
commit. Intake runtime and repository files are additive.

## Required checks

From this repository root:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

A browser render/click pass is separate. Do not infer it from Node tests, a
successful bundle, or HTTP delivery.

## Status and authority

Use `EXPERIMENTAL`, `TEST`, `WORKING`, `CANON`, `SHELL`, or `BROKEN` honestly.
Work on a review branch. Do not push, merge, promote, release, or label anything
`CANON` without Mike Tobi's explicit decision.
