# Theme Park standalone simulator branch

Status: `EXPERIMENTAL`

This repository makes the Theme Park line a standalone simulator sibling. The
active game is Playable Living Globe 3D v0.4.6. Its browser/WebGL interface is
kept intact, but the authoritative simulation can also run from Node.js with
filesystem saves.

## Lineage layout

- `playable_3d/` — active v0.4.6 simulation, offline build, tests, and WebGL
  client.
- root v0.2.0 files — the protected foundation shipped with v0.4.6.
- `donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/` — preserved v0.3.0
  deterministic donor/reference lineage.
- `runtime/` — additive non-browser adapter over the active v0.4.6 core.

The v0.3.0 donor remains a reference rather than a second active kernel. The
v0.4.6 source explicitly holds the donor namespace kernel and wider authority
migration for a future integration decision.

## Headless use

```powershell
New-Item -ItemType Directory -Force headless-saves | Out-Null
npm run headless -- new headless-saves/park.json park-seed sandbox "My Park"
npm run headless -- step headless-saves/park.json headless-saves/park-060.json 60
npm run headless -- inspect headless-saves/park-060.json
```

Apply an existing simulation action from a JSON file:

```powershell
npm run headless -- action headless-saves/park-060.json headless-saves/renamed.json action.json
```

Outputs use create-new filesystem semantics and refuse silent overwrite.

## Browser client

Open `playable_3d/PLAY_GAME.html` for the supplied offline 3D client. It remains
an optional presentation path, not the only way the simulation can run.

## Honest limits

The supplied branch is a playable vertical slice, not a complete commercial
theme-park simulator. Local WebGL appearance and interaction still require a
fresh live visual pass. No merge, promotion, remote push, or canon decision is
part of this intake.
