# Steward Receipt — Moonwake Galleon + Coaster Studio

## Status

`SOURCE_STACKED_AWAITING_LOCAL_TEST_BUILD_AND_VISUAL_REPAIR`

This pass intentionally adds real playable-source value to the existing v0.4.6
review branch before the later local integration run.

## New attraction — Moonwake Galleon

`galleon` is a real ride catalog entry, unlocked at park level 2.

Current declared park behavior:

- cost: €4,300;
- footprint: 5 × 3;
- capacity: 12;
- cycle: 8 minutes;
- operating cost: €12 per operating-hour charge cycle;
- ride price: €3 default;
- family/thrill crossover profile;
- normal queue, economy, condition, maintenance, evolution and ride-cycle logic
  through the existing generic ride simulation.

The ride does not rely on the old unknown-ride fallback. A dedicated renderer
model lives in `src/render/extraAttractions.js` and is attached through the
additive `contentStudioWorldRenderer.js` seam.

Visible model behavior includes:

- pendulum ship swing driven by real ride active/wait/open evidence;
- up to 12 visible passenger proxies bound to committed rider count;
- animated frontage, gate and lights;
- ride-camera anchor attached to the moving ship;
- closed/poor-condition warning light;
- L1/L2/L3 evolution dressing so normal ride evolution remains visually legible.

## Coaster Studio v1

Coaster Studio is a design tool, not a fake custom-coaster placement claim.

The portable schema is:

`axm.themepark.coaster-design/v1`

A draft contains:

- coaster name and seed;
- closed track node circuit;
- per-node X/Z position;
- per-node height;
- per-node banking;
- track/support/train/accent colors;
- freely placed decoration records;
- stable next-node and next-decoration identifiers.

Hard current editor limits:

- 24 × 24 design grid;
- minimum 4 track nodes;
- maximum 48 track nodes;
- maximum 80 decorations;
- height 0–18;
- banking -60° to +60°.

## Styling and decorations

Players can currently place and edit:

- trees;
- lanterns;
- rocks;
- flowers;
- track arches;
- theme signs;
- water patches.

Each decoration stores position, rotation and scale. Decorations are explicitly
style/presentation data: they do not silently alter coaster intensity, speed,
capacity, economy or other physics.

The decoration catalog is intentionally reusable so later ride/attraction
styling can consume the same visual vocabulary instead of inventing a second
incompatible styling system.

## Editor interaction

The game shell now exposes `Coaster Studio` from the top action bar.

Track mode:

- click empty plan space to insert a new track node;
- click a node to select it;
- drag a selected node to reshape the closed circuit;
- edit height and banking with sliders;
- remove nodes down to the four-node safety floor.

Decoration mode:

- select a decoration type;
- click to place it;
- click an existing decoration to select it;
- edit rotation and scale;
- remove the selected decoration.

Style controls expose track, support, train and accent colors.

The editor shows deterministic design evidence:

- approximate 3D track length;
- maximum height;
- largest downward segment;
- average absolute banking;
- track-node count;
- decoration count;
- bounded intensity estimate.

## Portability

Verified-format drafts can be:

- autosaved to browser-local Coaster Studio draft storage;
- exported as `.coaster.json`;
- imported back through the same schema.

Malformed schema/version input is rejected instead of silently coerced into a
park ride.

## Park authority boundary

Opening Coaster Studio pauses simulation-time advancement in the current browser
client and closing it resumes the previous speed. Keyboard input inside the
modal is contained so editor interaction does not intentionally control the
park behind it.

Coaster Studio currently has **no placement bridge** into `state.world.entities`.
That is deliberate.

A future bridge should only be added after local testing defines:

1. how a design maps to park footprint and access cells;
2. how design metrics become authoritative ride stats;
3. cost and operating-cost derivation;
4. save/version implications;
5. how decoration geometry is rendered on the curved Living Globe;
6. collision/clearance rules;
7. ride-camera and train motion along the authored spline.

Until that bridge exists, exported designs are portable design artifacts rather
than installed park entities.

## Focused tests added

`tests/coaster-studio.test.js` covers source-level contracts for:

- Galleon catalog/economy metadata;
- normal authoritative build action;
- dedicated Galleon model passenger evidence;
- condition/evolution visual parity;
- deterministic default coaster design;
- track insertion/editing/clamping/removal limits;
- decoration placement/editing/removal;
- track/decor hard budgets;
- deterministic non-mutating metrics;
- export/import round trip;
- game-shell Studio wiring;
- absence of hidden park-write authority in the Studio UI.

No full test-suite PASS is claimed from this GitHub-only seat.

## Local intake checklist

From repository root run the existing gates:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

Then perform the browser/WebGL gate.

### Moonwake visual/play gate

1. reach level 2 or use sandbox;
2. build Moonwake Galleon and connect a queue;
3. confirm riders visibly appear only while committed to the ride;
4. inspect swing amplitude while idle, waiting and active;
5. enter/leave its ride camera;
6. close the ride and verify warning/frontage behavior;
7. lower condition below 35 and verify warning light;
8. evolve through L1/L2/L3 and inspect dressing;
9. rotate/build at multiple orientations;
10. confirm selection and collision footprint remain correct.

### Coaster Studio gate

1. open Studio and confirm the park clock stops advancing;
2. drag every default node and insert nodes between existing nodes;
3. verify the newly inserted node stays selected;
4. change height/bank values at min/max limits;
5. place every decoration type;
6. rotate/scale/remove decorations;
7. change all four style colors;
8. export, clear/new, then import the same design;
9. stress toward 48 nodes and 80 decorations;
10. test mouse + touch sizing on Crisp, Retro and Tiny targets;
11. confirm W/A/S/D, V, F, T and Z do not leak through while editing;
12. close Studio and confirm simulation resumes normally.

## Promotion rule

Do not claim the ready-to-play `dist/game.js` contains this work until local has
run the required tests, rebuilt the bundle, performed the browser visual gate,
and committed the regenerated `dist/` output.
