# Animation Cadence and Population Resolution

## Two clocks, one authority

Simulation time owns game truth. Render time samples it. A slow phone may render
fewer frames, interpolate differently, or use a lower visual tier, but it may not
skip authoritative visitor, ride, economy, crew, or campaign updates.

`SimulationCadencePlan` declares simulation tick duration, render target,
update-lane intervals, snapshot cadence, and bounded catch-up. Unprocessed time is
carried forward instead of silently erased.

## Animation signals

A simulation event can publish a deterministic `AnimationSignal` containing:

- source event;
- entity and clip;
- start and duration ticks;
- state version;
- visual parameters.

The signal is non-authoritative, rebuildable, and JSON-safe. Its deterministic
identity includes the committed state version, so visually similar signals from
different authoritative states cannot collapse into one cache identity. This is
the seam for AXM's self-made low-graphic animation testing ground: early visuals
can remain simple without compromising the deeper simulation.

## Population resolution

Small crowds can use individual agents. Larger crowds may use exact buckets for
background or strategic calculations. Every tier retains an exact remainder so
represented population always equals authoritative population. The decision also
reports its concrete visual-actor budget, while the authoritative population
remains exact.
