# Align discovery metadata with the current repository license

Date: 2026-09-25 UTC

Base commit: `bcfd01d1cd3eec04cc9cf8ff66088491551d1caa`

The current LICENSE and LICENSE_BOUNDARY.md declare PolyForm-Noncommercial-1.0.0, while package metadata or the public discovery generator still declared Apache-2.0. This repair aligns current metadata and its admission checks with the existing repository declaration, then regenerates the exact discovery receipt.

No LICENSE text, historical snapshot, third-party notice, donor source, runtime capability, execution authority or CANON state is changed. Historical license grants remain historical evidence.

## Verification

`npm run check`: intake verification, headless tests, playable tests and playable build passed. `python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py`: FINAL PASS, including 136 donor tests. Browser experience was not verified.
