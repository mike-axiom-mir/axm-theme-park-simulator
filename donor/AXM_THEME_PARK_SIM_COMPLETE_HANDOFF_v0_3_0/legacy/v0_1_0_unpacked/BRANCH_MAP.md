# Branch Map and Build Order

## Foundation — this package

Shared rules, contracts, deterministic event spine, explainability, and module
registration.

## Branch A — Rides and Attractions

Own:

- ride definitions and construction;
- capacity, cycle time, downtime, reliability, comfort, intensity;
- physical condition and maintenance interfaces;
- first-experience and repeat-experience properties;
- attraction evidence exposed to visitors, crews, scenery, and economy;
- later physics-engine adapter.

Must not own:

- global popularity;
- visitor identity or pathfinding;
- scenery coherence;
- complete park finances.

## Branch B — Visitors and Crews

Own:

- visitor profiles, households/groups, geography, awareness, visit history;
- motivations, budgets, tolerances, accessibility needs, memories;
- pathfinding, decisions, queues, satisfaction evidence;
- staff roles, skills, shifts, workload, morale, and service execution.

Must consume attraction, scenery, shop, weather, and park evidence without
rewriting those providers.

## Branch C — Decoration, Atmosphere, and Influence

Own:

- scenery entities and placement;
- themes, zones, coherence, transitions, visibility, contradiction, clutter;
- lighting, sound, landscaping, environmental comfort;
- queue/ride/land integration;
- atmosphere evidence and optional experience influence.

Must never award value solely by counting placed objects.

## Branch D — Stores, Food, Services, and Economy

Own:

- shops, food, stock, recipes, prices, service rate, waste, and procurement;
- toilets, first aid, information, rentals, lockers, and other services;
- direct and induced spending;
- operating costs, staffing demand, and service capacity;
- park cashflow interfaces and contribution evidence.

Must not reduce all value to direct per-building profit.

## Later branches

- Campaign and Scenario Authoring
- Adventure and Inspection Mode
- Transport, Hotels, and Destination Reach
- Weather and Seasonal Operations
- Old-School Animation and Skin Workshop
- Physics Engine Adapter
- Theme Architect / Planning Mode
