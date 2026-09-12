# AXM Theme Park Simulator

A local-first deterministic theme-park simulation with a headless Node.js runtime and an optional playable WebGL client.

The repository preserves several lineages instead of pretending they are one history:

- the protected v0.2.0 foundation and executable Python reference;
- the active v0.4.6 playable lineage under `playable_3d/`;
- the preserved v0.3.0 deterministic donor under `donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/`.

The active branch is repository truth for this project. It is not automatic AXM CANON.

## What is working

The current body includes a deterministic headless simulator, strict save admission and integrity checks, retained-event continuity, bounded filesystem save/action handling, and an offline browser build.

The playable layer also includes evidence-backed park construction and guest access, research and bounded growth, upgrades, staff development, district/style systems, expanded attractions and facilities, Coaster Studio, historical economy/payment progression, Legacy career/style progression, and presentation layers that remain subordinate to simulation state.

Placement previews distinguish valid connected access from valid-but-disconnected access before money is spent. Simulation speed uses the current `0x / 1x / 2x / 4x` contract. Gate state remains visible during ordinary play and delegates changes to the existing authoritative park-open control.

## Verification

From the repository root:

```bash
python run_tests.py
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

Required CI exercises the protected foundation, the intake seal, the headless runtime, the playable suite, reproducible browser builds, and the preserved donor. Separate browser workflows exercise Save Import and the persistent park controls in real Chromium, including phone-width paths.

The original archive checksum indexes remain immutable. Reviewed differences from those archive bytes are recorded explicitly in `.axm-intake/LOCAL_PATCHES.json`.

## Runtime boundary

The deterministic simulation does not require Workshop, Mirror, an account, cloud storage, or a network host. The browser/WebGL client is a realization of the same park body, not a second source of simulation truth.

Presentation may become richer or cheaper for different devices, but rendering may not silently rewrite save integrity, simulation rules, player choices, or canonical park state.

## Governance

AXM's internal constitutional merge gate is the four roots:

1. Truth
2. Agency / non-domination
3. Continuity
4. Wisdom before speed

No human, machine, role, branch name, or Git permission is itself the constitutional merge gate. Technical permission can execute a merge; it does not by itself create CANON authority. Changes should remain evidence-backed, reversible where practical, provenance-preserving, and explicit about unresolved limits.

## Truth boundary

This repository is a substantial working simulator and research/playable body, but it is not a claim of a finished commercial theme-park game, universal hardware coverage, or perfect cross-device behavior. Browser evidence is bounded to the environments actually exercised by CI. Unsupported claims stay unsupported.
