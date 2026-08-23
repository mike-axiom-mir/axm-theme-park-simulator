# Action Report — Playable Living Globe 3D v0.4.6

## Outcome

Guests now use the park's rest benches instead of benches being decoration
only. Tired guests pathfind to a reachable bench, join its bounded queue, occupy
one of two seats, recover energy, and return to the live park. The day report,
save migration, guest inspector, deterministic event log, 3D placement, and
visual presentation all understand the new resting state.

The visitor layer also communicates more clearly. A bounded set of animated
16×16-style status signals shows the most urgent live guest needs, and a small
Guest Pulse panel summarizes comfort, drink, snack, rest, and long-wait demand.

This remains a playable vertical slice, not a claim of complete commercial
Theme Park World-scale content.

## Functional rest benches

- Every Rest Bench has two real seats and a 14-minute service cycle.
- Guests seek rest once energy falls below the evidenced threshold.
- Existing pathfinding, queue capacity, access, and deterministic ordering are
  reused; no hidden teleport or fabricated access path was added.
- Completion restores energy, improves happiness, writes a
  `visitor.bench.rested` event, and increments the day's bench-rest count.
- The daily report exposes real seated recoveries.
- Existing v0.3/v0.4 saves migrate with explicit zero defaults for the new
  counter and report field. Save schema 3 and the v042 slot prefix remain
  compatible.

## Guest animation and status visuals

- Resting guests are positioned against the real bench entity and receive a
  seated low-poly pose while their simulation state is `resting`.
- Pixel status signals cover comfort, drink, snack, rest, and long wait.
- Signals are deterministic presentation descriptors and never write back to
  visitor needs, cash, time, or simulation RNG.
- Hard signal ceilings are 18 at Crisp, 12 at Retro, and 6 at Tiny quality.
- Guest Pulse reads the same live needs but stays UI-only.
- Existing ride, service, staff, scenery, path, ambience, opening, and weather
  animation systems remain intact.

## Verification completed

- Protected Python foundation: 39/39 tests passed.
- Playable JavaScript branch: 43/43 tests passed.
- Attached donor handoff: 136/136 tests passed.
- Two-seat routing, recovery, resumption, event evidence, save migration,
  quality ceilings, deterministic ordering, UI wiring, and presentation-only
  boundaries are under automated tests.
- Offline deterministic bundle: 21 local modules, 967,416 UTF-8 bytes; syntax
  check passed.
- Static local delivery: entry HTML, production HTML, JavaScript, and CSS each
  returned HTTP 200.
- Full operating day (`full-day-smoke`) is deterministic: 86 visitors, 81
  carousel cycles, €1,164 carousel revenue, rating 76, €1,418 day surplus, 13
  cleanups, 5 bench rests, and a verified final hash.
- Deterministic three-day simulation and final state hash: passed.

## Live visual gate

`MISSING_VISUAL_CAPTURE`: the cloud-browser-to-localhost seam previously
returned `ERR_BLOCKED_BY_CLIENT` before a game frame rendered. Automated
execution proves the simulation, model, signal, UI, and quality paths, but
seated alignment, signal readability, clipping, responsive fit, and WebGL
appearance still require a local visual pass.

See `PLAYABLE_3D_LIVE_VISUAL_RECEIPT.txt` for the bounded receipt.

## Next safest visual route

1. Open `playable_3d/PLAY_GAME.html` on a local WebGL-capable desktop.
2. Start Campaign and let the opening animation finish.
3. Run at fast speed until a Guest Pulse rest count appears.
4. Follow the signaled guest to a bench and confirm path, queue, seated pose,
   signal cadence, recovery, and departure from the seat.
5. Compare signal density at Crisp, Retro, and Tiny.
6. Finish the day and confirm Bench rests in the report.
7. Save/reload and confirm the park continues normally.
