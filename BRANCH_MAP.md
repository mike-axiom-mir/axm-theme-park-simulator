# Branch Map and Build Order v0.2.0

## Foundation — this package

Shared roots, contracts, deterministic runtime reference, evidence, time,
environment, campaign/adventure interfaces, save/migration/merge rules, guidance,
fidelity isolation, and module registration.

## Branch A — Rides and Attractions

Owns ride definitions, construction, cycles, capacity, downtime, reliability,
comfort, intensity, accessibility, condition, maintenance/refurbishment evidence,
first/repeat experience properties, and the later physics adapter.

Does not own global popularity, visitor identity/pathfinding, scenery coherence, or
complete park finances.

## Branch B — Visitors and Crews

Owns people/groups, origin geography, awareness, prior exposure, motivations,
budgets, accessibility needs, memories, movement, queues, decisions, satisfaction,
revisit intent, staff roles, skills, shifts, workload, morale, and service work.

## Branch C — Decoration, Atmosphere, and Influence

Owns scenery entities, themes, zones, coherence, transitions, visibility,
contradiction, clutter, lighting, sound, landscaping, comfort, and queue/ride/land
integration. Object count alone is never influence.

## Branch D — Stores, Food, Services, and Economy

Owns products, recipes, stock, prices, waste, procurement, service rate, toilets,
first aid, information, rentals, lockers, direct/induced spend, operating cost,
service capacity, and park cashflow interfaces.

## Branch E — Campaign and Scenario Authoring

Owns inherited map situations, constraints, authored events, outcome tags,
multiple valid endings, campaign briefing, and campaign-specific evidence. It may
not create separate simulation truth.

## Branch F — Adventure and Inspection Mode

Owns camera/player navigation, ride/view experiences, inspections, observation
packets, and evidence surfacing. It consumes authoritative state and cannot mutate
domain state except through normal declared player actions.

## Branch G — Old-School Animation and Skin Workshop

Owns low-graphic assets, animation clips, LOD, crowds-as-visuals, visual testing,
and skin progression. It must preserve state hashes across fidelity profiles.

## Branch H — Integration and Merge

Owns intake validation, contract compatibility, tests, migration plans, capability
maps, unresolved conflicts, and explicit merge decisions. It does not silently
rewrite branch outputs.

## Later branches

Transport/hotels/destination reach; weather generation; multiplayer; physics;
theme architect/planning mode; sealed postgame alien expansion.
