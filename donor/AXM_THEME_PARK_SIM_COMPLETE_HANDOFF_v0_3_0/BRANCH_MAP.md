# Branch Map v0.2.0

## Shared foundation — current package

Owns deterministic runtime, shared contracts, world context, evidence,
uncertainty, park identity, campaign compatibility, save/migration, merge gate,
presentation profiles, and branch registration.

It does not own detailed gameplay of the four primary branches.

## A — Rides and Attractions

Own:

- ride and attraction definitions;
- construction and removal proposals;
- capacity, dispatch, cycle time, downtime, accessibility;
- physical condition, reliability, comfort, intensity;
- maintenance and refurbishment evidence;
- first-experience and repeat-experience properties;
- later physics adapter.

Never own a global popularity number.

## B — Visitors and Crews

Own:

- visitors, households, groups, origin zones, visit history;
- motivations, budgets, tolerances, needs, memories;
- movement, queues, choices, satisfaction, revisit intent;
- crew roles, skills, schedules, workload, morale, execution.

Novelty belongs here at visitor/audience level, not inside ride age.

## C — Decoration, Atmosphere, and Influence

Own:

- scenery entities, theme zones, coherence, transitions;
- sightlines, contradiction, clutter, lighting, sound, landscaping;
- shade, comfort, sensory integration;
- queue/ride/land atmosphere evidence.

Never score theme through object count alone.

## D — Stores, Food, Services, and Economy

Own:

- shops, food, recipes, stock, prices, waste, procurement;
- toilets, first aid, information, rentals, lockers;
- service speed, demand, spending, staffing, operating costs;
- direct and induced financial evidence.

Never label an element worthless through direct revenue alone.

## E — Campaign and Adventure

Own:

- scenario definitions;
- inherited history and constraints;
- outcome paths;
- campaign events and epilogues;
- observation tasks and first-person inspection hooks.

Must permit multiple coherent endings when the campaign design supports them.

## F — Animation Testing Ground

Own:

- self-made low-graphic assets and animation clips;
- movement visualization;
- ride and queue animation adapters;
- visual debug overlays;
- visual-quality ladder and replacement provenance.

Rendering may approximate state visually; it may not fabricate different state.

## Sealed later branch — alien postgame

Kept in `docs/SCI_FI_POSTGAME_SEED.md`. It is a future reasoning expansion, not
part of the first Earth-map scope.
