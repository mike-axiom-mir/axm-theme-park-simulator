# Time, Seasons, and Environment

One clock owns authoritative progression. A renderer may interpolate movement
between ticks, but a visual frame cannot create a second simulation result.

The environment is split into:

1. **generation** — a seeded provider emits an environment frame;
2. **effects** — rides, visitors, crews, scenery, shops, and campaigns consume the
   frame through their own contracts;
3. **presentation** — graphics show rain, daylight, wind, or temperature cues.

This prevents one weather module from directly rewriting every domain.

The bundled weather generator is only a deterministic test reference. It is not a
claim of meteorological realism. A later provider can replace it while preserving
the `EnvironmentFrame` contract and replay seed.
