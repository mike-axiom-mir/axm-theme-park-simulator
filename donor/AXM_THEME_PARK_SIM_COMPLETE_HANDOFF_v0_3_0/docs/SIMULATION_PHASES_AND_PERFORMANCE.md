# Simulation Phases and Performance Rule

Authoritative order:

`command → world → arrival → movement → queue → experience → service → crew → economy → maintenance → evidence → snapshot`

Non-authoritative order:

`animation → presentation`

Cadence can differ by system. Movement may update every simulation tick while
cashflow aggregation updates every five ticks and snapshots every sixty.

## Non-negotiable performance rule

- Authoritative systems are never marked skippable.
- A slow machine may run the world more slowly in real time.
- Animation interpolation and presentation can be reduced or dropped.
- The game must not skip maintenance, visitor decisions, economy, or other truth
  updates merely to preserve visual frame rate.
- Replays depend on simulation ticks and ordered events, not wall-clock timing.

This makes the early low-graphic approach an architectural advantage: visual
complexity can grow without weakening simulation integrity.
