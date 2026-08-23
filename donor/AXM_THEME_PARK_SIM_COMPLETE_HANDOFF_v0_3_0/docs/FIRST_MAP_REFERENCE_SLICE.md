# First-Map Reference Slice — What It Proves and What It Does Not

Run:

```bash
python examples/run_first_map_reference_slice.py
```

This is a deterministic **cross-organ reference**, not a playable map.

## Proven in one repeatable flow

- a player command is validated and committed as one atomic event/reducer transaction;
- ride-owned state and visitor notification state update through registered reducers;
- an audience cohort moves through awareness, first visit, repeat visit, loyalty,
  disappointment, and recovery without creating or deleting people;
- first-time and repeat demand share explicit park capacity;
- one real value occurrence can be split across contributing subjects without
  exceeding 100% attribution or being counted twice;
- evidence and a derived metric retain state/version lineage;
- the resulting state and event history restore from a verified snapshot;
- an experiment forks from the snapshot without rewriting `main`;
- maintain/evolve/replace/no-action projections remain reviews rather than an
  automatic decision;
- animation is derived from authoritative events but cannot become authority;
- the same inputs produce the same complete demo digest.

## Deliberately not claimed

The reference does not contain a rendered park, map editor, pathfinding, complete
ride operation, crew task loop, production economy, first-person view, or visible
self-made animation. Its acceptance report therefore remains blocked. This is an
intentional `no fake done` result and a precise build target for the domain chats.
