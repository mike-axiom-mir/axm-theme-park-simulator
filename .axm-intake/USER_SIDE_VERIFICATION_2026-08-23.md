# Theme Park user-side verification — 2026-08-23

Status: `TEST`

Claim checked: a Windows user can launch the standalone Theme Park branch, enter the
live 3D park, change between management and walk modes, save, reload, and resume
without the Workshop runtime.

## Failure found

The first live launch reached the safety screen with:

```text
TypeError: Cannot read properties of null (reading 'copy')
```

The first day-night frame called `Color.copy` on a fresh Three.js scene whose
`background` was still `null`.

## Repair

- Initialize the scene background from the calculated sky color when it is absent.
- Preserve the existing in-place color update after initialization.
- Add a regression test that executes the day-night update against a fresh scene.
- Rebuild the checked-in local browser bundle.
- Preserve the supplied checksum indexes and record the three post-intake hashes in
  `LOCAL_PATCHES.json`.

## Live user journey after repair

Environment: in-app desktop browser, 1280 × 720 viewport, device pixel ratio 1.25,
served from the repository over localhost.

1. `PLAY_GAME.html` redirected to the bundled `playable_3d/dist/index.html` client.
2. `Continue autosave` entered a visibly active 3D park; the clock, guests, cash and
   park level changed as the simulation ran.
3. `Walk park` moved to the third-person park view and exposed the movement controls.
4. `Menu` opened the three local world-save slots.
5. Saving to World 1 changed the slot from `Empty` to `Moonroot Park` with day and
   cash metadata.
6. Closing the menu resumed the moving park, and `Manage park` returned to the
   overhead management view.
7. Reloading returned to the opening menu; `Continue autosave` restored the level 3
   park and its later clock state.

No new browser error was emitted after the repaired build. The browser retained the
timestamped pre-repair exception in its diagnostic history; it did not recur.

Selected in-memory screenshot SHA-256 digests:

- pre-repair safety screen: `60114a242a2bc4c98aa21db102444ca39e50e3cba88ffa134a5df2ed756f6417`
- repaired walk mode: `de350b7d929c95c4d3adbfb4752ed6be55c7e7e50d9b753b356fdcb7128ee273`
- repaired reload/autosave resume: `6e3206079d2337ec63d155b5cdf24d1a83984e1976d39e2c76d309b55987375f`

Observation used settled screenshots around 0.35–0.70 seconds after each bounded
action, plus a 0.30-second transition frame and a 1.60-second settled frame on first
entry. No rolling video buffer was available, so this receipt does not claim
frame-perfect animation coverage.

## Scripted verification after repair

- `npm run check`: PASS
  - local intake: 343 / 343 checksum rows, including 3 declared local patches
  - headless filesystem runtime: 7 / 7
  - playable suite: 44 / 44
  - browser bundle: 21 local modules, 967,512 bytes
- donor verifier: PASS, 136 / 136
- final local intake rerun: PASS

The branch remains a standalone sibling simulator. Browser/WebGL is an optional
client; the filesystem runtime is independently verified. This receipt does not
canonize or publish the branch.
