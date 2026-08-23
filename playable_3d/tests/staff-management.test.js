import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createNewGame, simulateMinutes } from "../src/core/simulation.js";
import {
  applyStaffDevelopmentAction, getStaffInsight
} from "../src/core/staff.js";
import {
  STAFF_MAX_TRAINING_LEVEL, STAFF_ZONE_IDS, staffTrainingProfile, staffZoneContainsCell
} from "../src/core/staffManagement.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("new crew begin untrained with whole-park authority only", () => {
  const state = createNewGame({ seed: "crew-development-defaults" });
  assert.equal(state.staffAgents.length, 2);
  for (const agent of state.staffAgents) {
    assert.equal(agent.trainingLevel, 0);
    assert.equal(agent.trainingSpent, 0);
    assert.equal(agent.zone, "all");
    assert.equal(getStaffInsight(state, agent.id).training.level, 0);
  }
  assert.deepEqual(STAFF_ZONE_IDS, ["all", "north", "east", "south", "west"]);
});

test("training spends real park cash and improves bounded work capacity", () => {
  const state = createNewGame({ seed: "crew-training-cost" });
  const cleaner = state.staffAgents.find((agent) => agent.role === "cleaner");
  const beforeCash = state.economy.cash;
  const beforeProfile = staffTrainingProfile(cleaner);

  const first = applyStaffDevelopmentAction(state, { type: "trainStaff", staffId: cleaner.id });
  assert.equal(first.ok, true);
  assert.equal(first.cost, 180);
  assert.equal(state.economy.cash, beforeCash - 180);
  assert.equal(state.economy.todayCosts, 180);
  assert.equal(state.economy.lifetimeCosts, 180);
  assert.equal(cleaner.trainingLevel, 1);
  assert.equal(cleaner.trainingSpent, 180);

  const afterProfile = staffTrainingProfile(cleaner);
  assert.ok(afterProfile.movePerMinute > beforeProfile.movePerMinute);
  assert.ok(afterProfile.cleanerCapacity > beforeProfile.cleanerCapacity);
  assert.equal(state.eventLog.at(-1).type, "staff.training.completed");
  assert.equal(state.eventLog.at(-1).data.cost, 180);

  assert.equal(applyStaffDevelopmentAction(state, { type: "trainStaff", staffId: cleaner.id }).ok, true);
  assert.equal(applyStaffDevelopmentAction(state, { type: "trainStaff", staffId: cleaner.id }).ok, true);
  assert.equal(cleaner.trainingLevel, STAFF_MAX_TRAINING_LEVEL);
  assert.equal(applyStaffDevelopmentAction(state, { type: "trainStaff", staffId: cleaner.id }).ok, false);
});

test("work zones constrain accepted jobs without creating teleport paths", () => {
  const state = createNewGame({ seed: "crew-zone-routing" });
  state.park.open = false;
  const cleaner = state.staffAgents.find((agent) => agent.role === "cleaner");
  state.world.litter = [{ id: "east-litter", cell: [18, 22], amount: 1 }];
  state.park.litter = 1;

  assert.equal(staffZoneContainsCell("west", [18, 22], state.world.size), false);
  assert.equal(staffZoneContainsCell("east", [18, 22], state.world.size), true);
  assert.equal(applyStaffDevelopmentAction(state, {
    type: "setStaffZone", staffId: cleaner.id, zone: "west"
  }).ok, true);
  simulateMinutes(state, 70);
  assert.equal(state.world.litter.length, 1, "cleaner crossed its assigned work-zone target boundary");

  assert.equal(applyStaffDevelopmentAction(state, {
    type: "setStaffZone", staffId: cleaner.id, zone: "east"
  }).ok, true);
  simulateMinutes(state, 70);
  assert.equal(state.world.litter.length, 0);
  assert.equal(state.eventLog.some((entry) => entry.type === "staff.cleaner.completed"), true);
});

test("trained mechanic restores more condition while keeping paid care", () => {
  const state = createNewGame({ seed: "trained-mechanic" });
  state.park.open = false;
  const mechanic = state.staffAgents.find((agent) => agent.role === "mechanic");
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  carousel.condition = 50;
  const beforeCash = state.economy.cash;

  assert.equal(applyStaffDevelopmentAction(state, { type: "trainStaff", staffId: mechanic.id }).ok, true);
  assert.equal(applyStaffDevelopmentAction(state, { type: "trainStaff", staffId: mechanic.id }).ok, true);
  assert.equal(staffTrainingProfile(mechanic).mechanicRepair, 9);
  simulateMinutes(state, 70);

  assert.equal(carousel.condition, 59);
  assert.equal(state.economy.cash, beforeCash - 180 - 260 - 28);
  assert.equal(state.operations.todayRepairs, 1);
  const repair = state.eventLog.find((entry) => entry.type === "staff.mechanic.completed");
  assert.equal(repair.data.restored, 9);
  assert.equal(repair.data.trainingLevel, 2);
});

test("staff development survives existing save version through normalizer defaults", () => {
  const state = createNewGame({ seed: "crew-save-roundtrip" });
  const cleaner = state.staffAgents.find((agent) => agent.role === "cleaner");
  assert.equal(applyStaffDevelopmentAction(state, { type: "trainStaff", staffId: cleaner.id }).ok, true);
  assert.equal(applyStaffDevelopmentAction(state, {
    type: "setStaffZone", staffId: cleaner.id, zone: "north"
  }).ok, true);

  const restored = deserializeGame(serializeGame(state));
  const restoredCleaner = restored.staffAgents.find((agent) => agent.id === cleaner.id);
  assert.equal(restoredCleaner.trainingLevel, 1);
  assert.equal(restoredCleaner.trainingSpent, 180);
  assert.equal(restoredCleaner.zone, "north");
});

test("playable wiring routes staff development without expanding renderer authority", () => {
  const main = read("../src/main.js");
  const staffRenderer = read("../src/render/staffAwareWorldRenderer.js");
  const staff = read("../src/core/staff.js");

  assert.match(main, /applyStaffDevelopmentAction/);
  assert.match(main, /STAFF_DEVELOPMENT_ACTIONS/);
  assert.match(main, /staffAwareWorldRenderer/);
  assert.match(staffRenderer, /KeyT/);
  assert.match(staffRenderer, /KeyZ/);
  assert.match(staffRenderer, /onStaffDevelopment/);
  assert.match(staffRenderer, /staff-development-visual/);
  assert.match(staffRenderer, /OctahedronGeometry/);
  assert.match(staff, /staff\.training\.completed/);
  assert.match(staff, /staff\.zone\.changed/);
  assert.doesNotMatch(staffRenderer, /economy\.cash\s*=/);
});
