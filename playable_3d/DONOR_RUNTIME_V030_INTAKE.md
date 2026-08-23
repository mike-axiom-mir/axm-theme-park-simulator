# v0.3.0 simulation donor intake

Source archive: `AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0.zip`

SHA-256: `010782f07a931b002112240c6aed820629e00281a797ab28a57b0bd9bca3b609`

The donor package passed its own `scripts/verify_package.py` acceptance run, including 136 tests. It is a deterministic simulation and integration reference, not a playable renderer. This browser game therefore uses it as a design donor and does not overwrite the protected v0.2 foundation roots.

## Intake map

### EXISTING

- Authoritative simulation time is already separate from render time.
- Seeded simulation, canonical state hashes, save verification, and explicit migrations already exist.
- Visitor rendering already has a fixed visual actor budget without changing exact simulation state.

### ADAPT

- The opening cinematic is emitted as a JSON-safe, non-authoritative, rebuildable animation signal.
- The signal identity includes the committed playable state hash and state version.
- The cinematic is skippable and respects reduced-motion preferences.
- The same signal drives a render-only 3D camera flight and gate reveal; skipping
  cancels the visual flight without changing the committed park state.
- Presentation never advances or mutates authoritative park state.

### NEW

- A procedural 16-bit-style Living Globe gate-opening sequence plays when a campaign or sandbox begins.
- The illustrated sequence dissolves into the actual 3D globe, whose camera
  settles exactly on the normal management pose.
- The menu can replay that sequence from the current committed state.
- Visible cleaners and mechanics route along declared paths and report completed work.

### HOLD

- The donor namespace kernel, command/event/reducer protocol, cohort demand ledger, contribution attribution, verified snapshot lineage, and counterfactual review remain future integration work.
- Those systems require a broader save and authority migration; importing them piecemeal would create two competing sources of truth.
