import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { applyAction, createNewGame } from "../src/core/simulation.js";
import { applyResearchAction, normalizeResearchState } from "../src/core/research.js";
import {
  ENTITY_UPGRADE_SLOTS, PARK_UPGRADE_SLOTS, UPGRADE_SCHEMA,
  applyUpgradeAction, entityUpgradeView, normalizeUpgradeState, parkUpgradeView
} from "../src/core/upgrades.js";
import { advanceOneMinuteWithUpgrades } from "../src/core/upgradeRuntime.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function upgradeState(seed = "upgrade-proof") {
  return normalizeUpgradeState(normalizeResearchState(createNewGame({ seed, mode: "sandbox" })));
}

function completeResearch(state, projectId) {
  state.research.insight = 99;
  for (const key of Object.keys(state.research.evidence)) state.research.evidence[key] = 999;
  const result = applyResearchAction(state, { type: "completeResearch", projectId });
  assert.equal(result.ok, true, result.reason);
}

test("upgrade normalizer adds explicit zero state without inventing installed modules", () => {
  const state = createNewGame({ seed: "upgrade-defaults" });
  normalizeResearchState(state);
  normalizeUpgradeState(state);
  assert.equal(state.upgrades.schema, UPGRADE_SCHEMA);
  assert.deepEqual(state.upgrades.park, []);
  assert.equal(state.upgrades.lifetimeInstalls, 0);
  assert.ok(state.world.entities.every((entity) => Array.isArray(entity.installedUpgrades)));
});

test("specific upgrade modules remain research-gated and slot-bounded", () => {
  const state = upgradeState("upgrade-slots");
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  let result = applyUpgradeAction(state, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "quick-load-gate"
  });
  assert.equal(result.ok, false);

  completeResearch(state, "ride-throughput");
  completeResearch(state, "ride-reliability");
  completeResearch(state, "ride-experience");
  assert.equal(applyUpgradeAction(state, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "quick-load-gate"
  }).ok, true);
  assert.equal(applyUpgradeAction(state, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "condition-sensors"
  }).ok, true);
  assert.equal(carousel.installedUpgrades.length, ENTITY_UPGRADE_SLOTS);
  result = applyUpgradeAction(state, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "comfort-package"
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /no free upgrade slot/i);
});

test("specific-family upgrades only appear on compatible attraction families", () => {
  const state = upgradeState("upgrade-families");
  assert.equal(applyAction(state, { type: "build", catalogId: "lanternmaze", x: 1, z: 1, rotation: 0 }).ok, true);
  assert.equal(applyAction(state, { type: "build", catalogId: "sunbeam", x: 7, z: 1, rotation: 0 }).ok, true);
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  const indoor = state.world.entities.find((entity) => entity.catalogId === "lanternmaze");
  const scenic = state.world.entities.find((entity) => entity.catalogId === "sunbeam");
  assert.equal(entityUpgradeView(state, carousel.id).modules.some((item) => item.id === "scene-sequencer"), false);
  assert.equal(entityUpgradeView(state, indoor.id).modules.some((item) => item.id === "scene-sequencer"), true);
  assert.equal(entityUpgradeView(state, scenic.id).modules.some((item) => item.id === "panorama-audio"), true);
});

test("installed Quick-Load Gate changes the real live cycle after the base/research tick", () => {
  const upgraded = upgradeState("quick-load-runtime");
  completeResearch(upgraded, "ride-throughput");
  const carousel = upgraded.world.entities.find((entity) => entity.catalogId === "carousel");
  assert.equal(applyUpgradeAction(upgraded, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "quick-load-gate"
  }).ok, true);
  const control = structuredClone(upgraded);
  control.world.entities.find((entity) => entity.id === carousel.id).installedUpgrades = [];

  upgraded.tick = 5;
  control.tick = 5;
  carousel.cycleRemaining = 8;
  control.world.entities.find((entity) => entity.id === carousel.id).cycleRemaining = 8;
  advanceOneMinuteWithUpgrades(upgraded);
  advanceOneMinuteWithUpgrades(control);
  assert.equal(carousel.cycleRemaining, 6);
  assert.equal(control.world.entities.find((entity) => entity.id === carousel.id).cycleRemaining, 7);
});

test("Condition Sensors protect observed wear instead of replacing ride safety authority", () => {
  const upgraded = upgradeState("sensor-runtime");
  completeResearch(upgraded, "ride-throughput");
  completeResearch(upgraded, "ride-reliability");
  const carousel = upgraded.world.entities.find((entity) => entity.catalogId === "carousel");
  assert.equal(applyUpgradeAction(upgraded, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "condition-sensors"
  }).ok, true);
  const control = structuredClone(upgraded);
  const controlCarousel = control.world.entities.find((entity) => entity.id === carousel.id);
  controlCarousel.installedUpgrades = [];

  carousel.condition = 80;
  controlCarousel.condition = 80;
  carousel.cycleRemaining = 1;
  controlCarousel.cycleRemaining = 1;
  advanceOneMinuteWithUpgrades(upgraded);
  advanceOneMinuteWithUpgrades(control);
  assert.ok(carousel.condition > controlCarousel.condition);
  assert.ok(carousel.condition <= 80);
});

test("park upgrades are research-gated, slot-bounded and operate on real hourly charges", () => {
  const upgraded = upgradeState("park-upgrade-runtime");
  completeResearch(upgraded, "park-operations");
  assert.equal(applyUpgradeAction(upgraded, { type: "installParkUpgrade", upgradeId: "energy-loop" }).ok, true);
  const control = structuredClone(upgraded);
  control.upgrades.park = [];
  upgraded.clock.minute = 599;
  control.clock.minute = 599;
  const upgradedCash = upgraded.economy.cash;
  const controlCash = control.economy.cash;
  advanceOneMinuteWithUpgrades(upgraded);
  advanceOneMinuteWithUpgrades(control);
  assert.ok(upgradedCash - upgraded.economy.cash < controlCash - control.economy.cash);
  assert.ok(upgraded.eventLog.some((entry) => entry.type === "upgrade.efficiency.rebate"));

  const fresh = upgradeState("park-slots");
  completeResearch(fresh, "park-wayfinding");
  completeResearch(fresh, "park-operations");
  completeResearch(fresh, "park-identity");
  for (const id of ["wayfinding-boards", "staff-radio", "energy-loop", "welcome-square"]) {
    assert.equal(applyUpgradeAction(fresh, { type: "installParkUpgrade", upgradeId: id }).ok, true);
  }
  assert.equal(parkUpgradeView(fresh).slotsUsed, PARK_UPGRADE_SLOTS);
  assert.equal(applyUpgradeAction(fresh, { type: "installParkUpgrade", upgradeId: "night-signature" }).ok, false);
});

test("installed modules can be swapped with partial salvage instead of permanent lock-in", () => {
  const state = upgradeState("upgrade-salvage");
  completeResearch(state, "ride-throughput");
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  const installed = applyUpgradeAction(state, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "quick-load-gate"
  });
  assert.equal(installed.ok, true);
  const cashAfterInstall = state.economy.cash;
  const removed = applyUpgradeAction(state, {
    type: "removeEntityUpgrade", entityId: carousel.id, upgradeId: "quick-load-gate"
  });
  assert.equal(removed.ok, true);
  assert.ok(removed.recovered > 0);
  assert.ok(state.economy.cash > cashAfterInstall);
  assert.equal(carousel.installedUpgrades.includes("quick-load-gate"), false);
});

test("upgrade state persists through the existing save version and legacy saves default cleanly", () => {
  const state = upgradeState("upgrade-save");
  completeResearch(state, "ride-throughput");
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  assert.equal(applyUpgradeAction(state, {
    type: "installEntityUpgrade", entityId: carousel.id, upgradeId: "quick-load-gate"
  }).ok, true);
  const restored = deserializeGame(serializeGame(state));
  assert.ok(restored.world.entities.find((entity) => entity.id === carousel.id).installedUpgrades.includes("quick-load-gate"));

  const legacy = createNewGame({ seed: "upgrade-legacy" });
  delete legacy.upgrades;
  for (const entity of legacy.world.entities) delete entity.installedUpgrades;
  const migrated = deserializeGame(serializeGame(legacy));
  assert.equal(migrated.upgrades.schema, UPGRADE_SCHEMA);
  assert.deepEqual(migrated.upgrades.park, []);
  assert.ok(migrated.world.entities.every((entity) => Array.isArray(entity.installedUpgrades)));
});

test("playable wiring layers upgrades after research while preserved simulation remains independent", () => {
  const main = read("../src/main.js");
  const simulation = read("../src/core/simulation.js");
  const researchRuntime = read("../src/core/researchRuntime.js");
  const upgradeRuntime = read("../src/core/upgradeRuntime.js");
  const bay = read("../src/ui/upgradeBayUI.js");
  const save = read("../src/core/save.js");
  assert.match(main, /advanceOneMinuteWithUpgrades/);
  assert.match(main, /UpgradeBayUI/);
  assert.match(main, /installEntityUpgrade/);
  assert.match(main, /installParkUpgrade/);
  assert.match(upgradeRuntime, /advanceOneMinuteWithResearch\(state\)/);
  assert.match(upgradeRuntime, /applyEntityModules/);
  assert.match(upgradeRuntime, /applyParkModules/);
  assert.doesNotMatch(researchRuntime, /upgradeRuntime|installedUpgrades/);
  assert.doesNotMatch(simulation, /upgradeRuntime|installedUpgrades/);
  assert.match(save, /normalizeUpgradeState/);
  assert.match(bay, /Research discovers capabilities\. Growth develops them\./);
});
