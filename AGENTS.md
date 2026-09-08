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

## Detail-density and composable capability principle

Quality is often the accumulated result of many small correct details, not one large generic upgrade.

- When improving a system, look for missing small, bounded capabilities, checks, parameters, passes, and repair operations that control specific details or failure modes.
- Prefer many reusable, inspectable, composable capabilities over one opaque "make it better" step when the smaller capabilities create real control or evidence.
- A machine should remain useful without AI: humans, explicit state, recipes, or deterministic logic can invoke the same capabilities directly.
- With AI, the model is primarily an interpretation and orchestration layer: it translates a higher-level goal into selections and combinations of the same underlying capabilities. The AI does not own those capabilities.
- A better reasoning model may improve goal interpretation and composition, while the underlying machine remains portable and usable without that model.
- Judge improvement by accumulated perceptual or functional detail, coherence, failure reduction, and fit to the goal—not by model size, resolution, benchmark score, or one broad upgrade alone.
- For visual, game, asset, animation, and video work, pay attention to small interacting details such as material variation, contact, timing, weight, secondary motion, lighting response, sound layering, asymmetry, wear, scale cues, camera behavior, and continuity.
- Do not fragment working systems merely for ideology. Add granularity where it creates useful control, reuse, diagnosis, repair, or quality.

**Working rule:** thousands of small good details and capabilities in the right places can improve a result more than one simple big upgrade.

## Canonical state and adaptive realization principle

Preserve the deterministic park/simulation body separately from the way a particular device can afford to show it.

- Canonical simulation rules, park state, saves, guest/ride state, and gameplay meaning are authoritative; WebGL scenes, meshes, lighting, particles, audio richness, UI density, and previews are realizations.
- Preserve expression intent when needed so attraction identity, theme, readability, motion meaning, and semantic detail survive lower-cost graphics.
- Prefer one park body with multiple bounded realization contracts over divergent mobile/desktop/lite/ultra game truths.
- Choose realization from canonical state + expression intent + measured machine capabilities + user policy; adaptation may happen at launch or dynamically.
- A weak device should receive cheaper expression, **not weaker park truth or gameplay rules**.
- Never degrade save integrity, simulation rules, fairness, collision/gameplay meaning, privacy, or authoritative state for rendering budgets.
- Never let a simplified render/client cache overwrite richer canonical simulation state. Projection is not authority.
- A richer realization may expose more of existing state/intent; it may not invent canonical facts merely to look better.
- Apply this separation only where presentation can honestly remain subordinate to simulation truth.

**Working rule:** degrade expression, never truth; upgrade expression, never invent truth.
