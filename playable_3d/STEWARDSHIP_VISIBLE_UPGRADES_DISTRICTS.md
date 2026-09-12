# Stewardship — Visible Upgrades + Park District Foundation

Status: **SOURCE-INTEGRATED / AWAITING LOCAL TEST/BUILD**

This pass follows the Research -> Growth -> Upgrades stack by making installed hardware visibly legible in the park and adding a small, bounded district/theming foundation without turning style into a new simulation grind.

## Visible installed upgrades

The final presentation renderer derives visuals only from already-committed `installedUpgrades` and `state.upgrades.park` evidence.

Entity modules now receive small low-poly hardware rather than giant UI icons. Examples include:
- Quick-Load Gate posts and moving gate arm;
- Condition Sensor mast and pulsing sensor node;
- Comfort Package seating detail;
- Scene Sequencer light boxes;
- Panorama Audio speakers;
- Twin Counter hardware;
- Smart Energy Meter dial;
- Hospitality Counter lantern;
- Storefront Story display frame;
- Collector Display pedestal;
- Comfort Corner seating/plant detail;
- Accessibility Station marker.

Park infrastructure receives small physical presentation objects near the entrance-side park interior:
- Live Wayfinding Boards;
- Crew Radio Network;
- Energy Loop;
- Rain Shelter Network;
- Welcome Square;
- Night Signature;
- Recycling Network.

These objects are render-only. Upgrade costs, research gates, slots and functional effects remain authoritative in `core/upgrades.js` and `core/upgradeRuntime.js`.

## Park district/theming foundation

New schema: `axm.themepark.districts/v1`.

The starter park is deterministically partitioned into four wedge-shaped districts:
- North;
- East;
- South;
- West.

Each district starts `Neutral`; there is no forced global skin.

Available presentation identities:
- Neutral;
- Garden;
- Adventure;
- Storybook;
- Future.

Select a park element in management view and either press **Y** or use the contextual **District Style** top-bar button to cycle the style of the district containing that element. The button disables itself whenever there is no selected park element, including while a guest/crew member is selected or a build/remove tool has cleared entity selection.

All park elements in the same district inherit the same small visual accent, giving the park a coherent local identity without overwriting each attraction's own model.

District styling currently has **zero simulation effects**:
- no guest motive mutation;
- no price/revenue effect;
- no rating bonus;
- no research requirement;
- no pathfinding behavior;
- no staff behavior;
- no forced theme choice.

The style change is logged as `district.theme.changed` and persisted in normal saves. Legacy saves receive four neutral district defaults without a save-version bump.

## Layering / repair path

The stable `main.js` import is preserved.

Presentation stack:

```text
worldRenderer
  -> expressiveWorldRenderer
    -> staffAwareWorldRenderer
      -> specialContentWorldRenderer
        -> parkIdentityWorldRenderer
          -> stateSafeParkIdentityWorldRenderer
            -> contentStudioWorldRenderer compatibility seam
```

The previous special-content model swap logic was preserved verbatim in `specialContentWorldRenderer.js` so the new visible layer can be bypassed or repaired independently.

`stateSafeParkIdentityWorldRenderer.js` normalizes style-only district defaults before renderer intake, immediately refreshes `stateHash`, owns the touch/mouse District Style control, keeps its enabled state synchronized with the current selection, and blocks style changes while tool dialogs are open.

`simulation.js` remains district-independent and does not own visual upgrade hardware.

## Focused tests added

`tests/park-identity-visuals.test.js` covers:
- four neutral defaults;
- deterministic cardinal district partitioning;
- district cycling without economy/rating/visitor mutation;
- bounded declared theme vocabulary;
- save persistence and legacy neutral defaults;
- final renderer layering;
- state-hash guard presence;
- District Style button/dialog guard source wiring;
- preserved simulation independence from district/visual hardware code.

## Verification truth boundary

A lightweight checkout/test attempt from this connected seat was made, but the execution container could not resolve `github.com`, so no Node test PASS is claimed from this chat.

`dist/game.js` remains untouched.

Later local intake still must run the full required gates:

```text
npm run verify:intake
npm run test:headless
npm run test:playable
npm run build:playable
python donor/AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0/scripts/verify_package.py
```

Then perform the real WebGL/play gate with special attention to:
- hardware scale/placement across small and large attraction models;
- click/select behavior when module meshes overlap attraction meshes;
- park infrastructure placement near the entrance on the Living Globe;
- district accent scale on all content families;
- Y/button isolation while dialogs/input fields are active;
- save/load of district themes;
- visual performance with a large park;
- Growth + Upgrade stacking balance remains unchanged by presentation code.
