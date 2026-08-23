# AXM Theme Park Deterministic Foundation v0.1.0

This package is the shared underlay for every later theme-park subsystem:
rides, visitors, crews, scenery, stores, campaigns, adventure mode, physics,
animation, architecture tools, and future mod/plugin systems.

It does **not** prescribe one correct park. It provides deterministic,
explainable causes so different park identities can become viable.

## Foundation statement

> A park element never loses value merely because it is old.
> Its value changes because people, geography, expectations, maintenance,
> operations, context, competition, cost, and the surrounding experience change.

## First build boundaries

This foundation owns:

- deterministic IDs, time, seeded randomness, events, and replay;
- shared entity/module contracts;
- geographic market and audience reach interfaces;
- explainable attraction and park contribution calculations;
- maintenance/evolution/replacement distinctions;
- common evidence packets for beginner and advanced interfaces;
- campaign/adventure state compatibility;
- module registration and dependency rules.

This foundation does **not** own detailed implementations of:

- ride physics or ride construction;
- visitor pathfinding or crew scheduling;
- scenery placement/rendering;
- shops, food recipes, stock, or detailed pricing;
- final campaign stories or animation assets.

Those systems plug into the shared contracts instead of rewriting the roots.

## Run the reference tests

```bash
python -m unittest discover -s tests -v
```

The Python code is a small executable reference, not a final engine.
The JSON contracts are the language-neutral source of integration truth.
