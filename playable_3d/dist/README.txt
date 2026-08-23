# AXM Theme Park — Playable Living Globe 3D v0.4.6

This is a deeper playable tycoon-and-adventure slice built on top of the
untouched v0.2.0 deterministic foundation. It is deliberately modest in
graphical complexity but is real 3D: a low-poly, pixel-rendered park that
supports management and third-person exploration of the same live state.

## Play

Open `PLAY_GAME.html` in a modern desktop browser. The production build is
self-contained and does not need a network connection or installation.

If `dist/` is missing, run:

```text
npm run build
```

The build script is dependency-free; no package download is required.

## Main controls

- Management: left-drag rotates, right-drag or WASD pans, wheel zooms.
- Build: choose an item and click to place; drag while building paths; `R`
  rotates rides; the remove-path tool recovers 40% of materials.
- Adventure: choose **Walk park**, then use WASD/arrow keys, Shift to run,
  mouse-drag/Q/E to turn, and Space to inspect or experience a nearby ride.
- Click visible guests or crew to inspect their live thoughts, targets, and work.
- Escape cancels the current build tool or leaves a ride camera.
- Standard controllers: left stick moves/pans, right stick looks/orbits,
  trigger runs/zooms, A inspects, B cancels, and Y changes view.

Touch controls appear automatically on coarse-pointer devices.

The map substrate adapts the small AXM Living Globe at GitHub commit
`a4f99fbfc05268173458bf3fb8f3fe616919e376`; it deliberately does not use the
large Caelus Foundation Planet. See `LIVING_GLOBE_SOURCE_TRACE.md`.

The pinned Three.js r180 runtime is vendored under `vendor/` with its MIT
license so source inspection and tests do not depend on a package download.

Starting a new campaign or sandbox plays a skippable procedural opening. It can
be replayed from the menu and respects reduced-motion preferences. Its animation
signal is derived from committed park state but cannot mutate or advance that
state. The illustrated opening reveals a real 3D globe camera
flight and animated entrance gates before settling exactly into the management
camera. See `DONOR_RUNTIME_V030_INTAKE.md` for the attached v0.3.0 donor mapping.

Weather is now visible as deterministic low-poly cloud and rain actors. Their
layout is rebuildable, capped at 72 total actors, and quality-scaled. Visitors
swing their arms; cleaners sweep after a completed cleanup; mechanics work their
tools after paid care; removed litter shrinks away instead of popping out. These
are presentation effects only and never write to saves or simulation RNG.

In v0.4.4 the park machinery receives the main animation pass. Every ride now
has a moving boarding barrier, turnstile, marquee, and state lights. The
carousel has chase bulbs, the wheel has lit cabins with sway, the coaster has a
lit moving train, the water ride throws spray, ghosts orbit the haunted manor,
and the spinner lifts and tilts its arms. Motion reads real open, queue, and
cycle state, so closed rides stop instead of looping at full speed.

The three service types are no longer one static recolored kiosk. Snack Rocket
has a moving food belt and bobbing rocket sign, Fizz Station runs a drink
machine with rising bubbles, and Comfort Cabin has animated doors with
available/occupied lights. All three have rolling shutters and live signs tied
to their committed service state.

In v0.4.5 the quieter parts of the park move too. Paths gain varied inset
stones, sparse verge plants, and a hard-capped set of swaying flowers; queue
lanes receive fluttering pennants. Trees move their canopy and leaf clusters,
lanterns sway with small orbiting moths, fountains have droplets and expanding
ripples, and bench planters carry gently moving flowers.

A separate deterministic ambience layer anchors butterflies to real paths,
fireflies to evening paths, and windblown leaves to placed trees. It is capped
at 40 actors, quality-scaled, weather/time aware, and render-only. Across the
complete 30×30 grid, at most 100 path tiles receive animated dressing and 129
receive static nature accents, preventing decoration count from growing without
a known ceiling.

In v0.4.6 benches become part of the simulation. A tired guest finds a reachable
Rest Bench, waits for one of two seats, sits for a real recovery cycle, and then
returns to the park. The guest inspector, deterministic event log, daily report,
and save migration all expose that causal chain.

Animated pixel status signals make urgent comfort, drink, snack, rest, and
long-wait needs readable above a bounded number of guests. The ceiling is 18
signals at Crisp, 12 at Retro, and 6 at Tiny. A compact Guest Pulse panel
summarizes the same live needs without changing simulation state.

## Honest scope

Implemented: campaign progression and open sandbox starts, a multi-day operating
loop with day reports, deterministic clock and weather, contextual visitors,
clickable guest needs/thoughts, pathfinding, capacity-bearing queue lanes,
queue abandonment, functional two-seat rest benches, bounded animated pixel
guest signals, Guest Pulse, six state-aware animated rides, three distinct animated
service buildings, staffing, money,
maintenance/evolution with visible upgrade dressing, evidence cards,
third-person walking, a five-stamp persistent discovery trail, ride cameras,
gamepad/touch input, visible routed cleaners and mechanics, spatial litter,
animated work tools and cleanup departures, low-poly weather, three local save
slots, bounded path/nature ambience, four animated scenery families, v0.3/v0.4
save migration, export/import, and retro fidelity settings.

Not yet implemented: custom coaster construction, staff zones and training,
hotels and transport, multiplayer, advanced physics, campaign authoring tools,
or the sealed alien postgame branch.
