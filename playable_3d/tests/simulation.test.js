import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceOneMinute, applyAction, canPlace, catalogUnlocked, createNewGame,
  estimateQueueWait, getAdventureView, getEntityDiagnosis, getProgressionView, getStaffInsight, getVisitorInsight,
  recomputeMetrics, refreshConnections, simulateMinutes
} from "../src/core/simulation.js";
import { findPath } from "../src/core/pathfinding.js";
import { deserializeGame, serializeGame } from "../src/core/save.js";
import { stateHash } from "../src/core/random.js";
import { LIVING_GLOBE_SOURCE } from "../src/world/livingGlobeAdapter.js";
import { deriveOpeningSignal } from "../src/presentation/openingSequence.js";

test("same seed and actions replay to the same verified state", () => {
  const first = createNewGame({ seed: "replay-proof" });
  const second = createNewGame({ seed: "replay-proof" });
  applyAction(first, { type: "build", catalogId: "path", x: 16, z: 24, rotation: 0 });
  applyAction(second, { type: "build", catalogId: "path", x: 16, z: 24, rotation: 0 });
  simulateMinutes(first, 420);
  simulateMinutes(second, 420);
  assert.equal(stateHash(first), stateHash(second));
  assert.deepEqual(first, second);
});

test("an old carousel has no age-only demand penalty", () => {
  const state = createNewGame({ seed: "age-is-evidence" });
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  const oldDiagnosis = getEntityDiagnosis(state, carousel.id);
  carousel.builtTick = state.tick;
  const newDiagnosis = getEntityDiagnosis(state, carousel.id);
  assert.ok(oldDiagnosis.ageDays > 6000);
  assert.equal(newDiagnosis.ageDays, 0);
  assert.deepEqual(oldDiagnosis.segmentScores, newDiagnosis.segmentScores);
});

test("building uses declared space and money", () => {
  const state = createNewGame({ seed: "build-contract" });
  const before = state.economy.cash;
  assert.equal(canPlace(state, "path", 16, 24).ok, true);
  const result = applyAction(state, { type: "build", catalogId: "path", x: 16, z: 24, rotation: 0 });
  assert.equal(result.ok, true);
  assert.equal(state.economy.cash, before - 12);
  assert.ok(state.world.paths.some((path) => path.x === 16 && path.z === 24));
  assert.equal(canPlace(state, "path", 16, 24).ok, false);
});

test("maintain and evolve preserve attraction identity and history", () => {
  const state = createNewGame({ seed: "preserve-history" });
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  const identity = { id: carousel.id, builtTick: carousel.builtTick };
  carousel.condition = 40;
  assert.equal(applyAction(state, { type: "maintain", entityId: carousel.id }).ok, true);
  assert.ok(carousel.condition > 40);
  assert.equal(applyAction(state, { type: "evolve", entityId: carousel.id }).ok, true);
  assert.equal(carousel.evolutionLevel, 2);
  assert.deepEqual({ id: carousel.id, builtTick: carousel.builtTick }, identity);
});

test("replace is explicit and does not occur during safety closure", () => {
  const state = createNewGame({ seed: "replacement-agency" });
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  carousel.condition = 17;
  advanceOneMinute(state);
  assert.equal(carousel.open, false);
  assert.ok(state.world.entities.includes(carousel));
  assert.equal(applyAction(state, { type: "replace", entityId: carousel.id }).ok, true);
  assert.ok(!state.world.entities.includes(carousel));
});

test("save export round-trips and rejects tampering", () => {
  const state = createNewGame({ seed: "save-proof" });
  simulateMinutes(state, 75);
  const serialized = serializeGame(state);
  const restored = deserializeGame(serialized);
  assert.deepEqual(restored, JSON.parse(serialized).state);
  const tampered = JSON.parse(serialized);
  tampered.state.economy.cash += 99999;
  assert.throws(() => deserializeGame(JSON.stringify(tampered)), /hash mismatch/);
});

test("pathfinder only uses connected declared paths", () => {
  const paths = new Set(["0,0", "1,0", "2,0", "2,1", "2,2", "0,2"]);
  assert.deepEqual(findPath(paths, [0, 0], [[2, 2]], 4), [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]);
  assert.deepEqual(findPath(paths, [0, 0], [[0, 2]], 4), []);
});

test("campaign exposes several evidence-backed endings without auto-selecting one", () => {
  const state = createNewGame({ seed: "plural-futures" });
  state.world.entities.push({
    ...structuredClone(state.world.entities.find((entity) => entity.catalogId === "carousel")),
    id: "test-wheel", catalogId: "wheel", condition: 100, accessCell: [15, 22]
  });
  state.world.entities.push({
    ...structuredClone(state.world.entities.find((entity) => entity.catalogId === "carousel")),
    id: "test-spinner", catalogId: "spinner", condition: 100, accessCell: [15, 22]
  });
  state.world.entities.push({ id: "test-drinks", catalogId: "drinks", kind: "service", x: 1, z: 1, rotation: 0, condition: 100, evolutionLevel: 0, open: true, queue: [], riders: [], cycleRemaining: 0, cycles: 0, revenue: 0, operatingSpend: 0, price: 4, accessCell: [15, 22] });
  state.world.entities.push({ id: "test-toilets", catalogId: "toilets", kind: "service", x: 3, z: 1, rotation: 0, condition: 100, evolutionLevel: 0, open: true, queue: [], riders: [], cycleRemaining: 0, cycles: 0, revenue: 0, operatingSpend: 0, price: 0, accessCell: [15, 22] });
  state.park.lifetimeVisitors = 100;
  state.park.litter = 0;
  state.metrics.averageHappiness = 96;
  recomputeMetrics(state);
  state.campaign.objectives.forEach((objective) => { objective.complete = true; });
  recomputeMetrics(state);
  assert.ok(state.campaign.availableEndings.length >= 2);
  assert.equal(state.park.selectedEnding, null);
});

test("small Living Globe is a traced substrate, not park-owned state", () => {
  assert.equal(LIVING_GLOBE_SOURCE.sourceWorldId, "world.grafthold.globe");
  assert.equal(LIVING_GLOBE_SOURCE.parkOwnsWorld, false);
  assert.equal(LIVING_GLOBE_SOURCE.adapterOwnsSimulation, false);
  assert.equal(LIVING_GLOBE_SOURCE.sourceCommit.length, 40);
});

test("disconnected attractions remain visible but receive no fabricated access", () => {
  const state = createNewGame({ seed: "no-fake-access" });
  state.world.entities.push({ id: "remote", catalogId: "spinner", kind: "ride", x: 0, z: 0, rotation: 0, condition: 100, evolutionLevel: 0, open: true, queue: [], riders: [], cycleRemaining: 0, cycles: 0, revenue: 0, operatingSpend: 0, price: 3, accessCell: [15, 22] });
  refreshConnections(state);
  assert.equal(state.world.entities.find((entity) => entity.id === "remote").accessCell, null);
});

test("a complete operating day routes real guests and produces causal ride use", () => {
  const state = createNewGame({ seed: "full-day-smoke" });
  simulateMinutes(state, 780);
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  assert.equal(state.clock.minute, 22 * 60);
  assert.ok(state.park.lifetimeVisitors >= 60);
  assert.ok(carousel.cycles > 20);
  assert.ok(carousel.revenue > 0);
  assert.ok(carousel.condition < 82, "condition changes through use rather than age");
  assert.ok(state.park.rating > 0);
  assert.equal(state.stateHash, stateHash(state));
});

test("campaign progression gates large rides while sandbox opens the catalog", () => {
  const campaign = createNewGame({ seed: "campaign-locks", mode: "campaign" });
  const sandbox = createNewGame({ seed: "sandbox-open", mode: "sandbox" });
  assert.equal(catalogUnlocked(campaign, "coaster"), false);
  assert.match(canPlace(campaign, "coaster", 0, 0).reason, /park level 4/i);
  assert.equal(catalogUnlocked(sandbox, "coaster"), true);
  assert.equal(canPlace(sandbox, "coaster", 0, 0).ok, true);
  campaign.park.lifetimeVisitors = 20;
  recomputeMetrics(campaign);
  assert.equal(getProgressionView(campaign).level, 2);
  assert.equal(catalogUnlocked(campaign, "wheel"), true);
});

test("declared queue paths expand physical queue capacity", () => {
  const state = createNewGame({ seed: "queue-lanes" });
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  const before = carousel.queueCapacity;
  for (const path of state.world.paths) {
    if ((path.x === 10 && path.z >= 17 && path.z <= 22) || (path.z === 17 && path.x >= 10 && path.x <= 14)) {
      path.type = "queue";
    }
  }
  refreshConnections(state);
  assert.ok(carousel.queueCapacity > before);
  carousel.queue = Array.from({ length: 12 }, (_, index) => `queued-${index}`);
  assert.ok(estimateQueueWait(carousel) >= 8);
});

test("guests abandon a queue when its wait exceeds their patience", () => {
  const state = createNewGame({ seed: "queue-patience" });
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  const visitor = {
    id: "visitor-patient-zero", segment: "family", origin: "nearby", budget: 30,
    happiness: 70, hunger: 0, thirst: 0, toilet: 0, energy: 1,
    state: "queueing", cell: [...carousel.accessCell], route: [], routeIndex: 0,
    routeProgress: 0, targetId: carousel.id, activityRemaining: 1, visited: [],
    stayRemaining: 120, preferences: {}, patience: 1, queueJoinedTick: 0,
    lastThought: "Waiting."
  };
  state.visitors = [visitor];
  carousel.queue = [visitor.id];
  carousel.cycleRemaining = 5;
  advanceOneMinute(state);
  assert.equal(visitor.state, "idle");
  assert.equal(carousel.queue.includes(visitor.id), false);
  assert.match(getVisitorInsight(state, visitor.id).thought, /too long/i);
});

test("tired guests route to a two-seat bench, sit, recover, and resume", () => {
  const state = createNewGame({ seed: "bench-rest-proof" });
  const bench = state.world.entities.find((entity) => entity.catalogId === "bench");
  const visitor = {
    id: "visitor-rest-proof", segment: "family", origin: "nearby", budget: 30,
    happiness: 64, hunger: 0, thirst: 0, toilet: 0, energy: 0.18,
    state: "idle", cell: [...state.world.entrance], route: [], routeIndex: 0,
    routeProgress: 0, targetId: null, activityRemaining: 0, visited: [],
    stayRemaining: 300, preferences: {}, patience: 60, queueJoinedTick: null,
    lastThought: "I need a short rest."
  };
  state.visitors = [visitor];
  advanceOneMinute(state);
  assert.equal(visitor.targetId, bench.id);
  assert.equal(visitor.state, "walking");
  simulateMinutes(state, 90);
  assert.equal(state.operations.todayBenchRests, 1);
  assert.ok(visitor.energy > 0.5);
  assert.equal(state.eventLog.filter((item) => item.type === "visitor.bench.rested").length, 1);
  assert.notEqual(visitor.state, "resting");
  assert.equal(bench.riders.includes(visitor.id), false);
});

test("older saves and day reports receive explicit bench-rest counters", () => {
  const legacy = createNewGame({ seed: "bench-save-migration" });
  delete legacy.operations.todayBenchRests;
  legacy.operations.dayReport = {
    day: 1, visitors: 2, income: 24, costs: 10, profit: 14, rating: 58,
    cleanliness: 90, topRideId: null, topRideLabel: "No ride operated",
    topRideRevenue: 0, cleanups: 0, repairs: 0
  };
  legacy.stateHash = stateHash(legacy);
  const restored = deserializeGame(JSON.stringify({
    schema: "axm.theme-park.playable-save", version: 3,
    savedAt: "2026-08-22T00:00:00.000Z", state: legacy
  }));
  assert.equal(restored.operations.todayBenchRests, 0);
  assert.equal(restored.operations.dayReport.benchRests, 0);
});

test("closing creates a day report and next morning resets the operating ledger", () => {
  const state = createNewGame({ seed: "day-loop" });
  simulateMinutes(state, 780);
  assert.equal(state.park.open, false);
  assert.equal(state.operations.dayReport.day, 1);
  assert.equal(state.operations.dayReport.income, state.economy.todayIncome);
  assert.equal(applyAction(state, { type: "startNextDay" }).ok, true);
  assert.equal(state.clock.day, 2);
  assert.equal(state.clock.minute, 9 * 60);
  assert.equal(state.park.open, true);
  assert.equal(state.operations.dayReport, null);
  assert.equal(state.economy.todayVisitors, 0);
});

test("a manually closed park still reaches an end-of-day report", () => {
  const state = createNewGame({ seed: "closed-park-report" });
  assert.equal(applyAction(state, { type: "togglePark" }).ok, true);
  simulateMinutes(state, 780);
  assert.equal(state.operations.dayReport.day, 1);
  assert.equal(state.operations.dayReport.visitors, 0);
});

test("walking discoveries persist and complete with explicit rewards", () => {
  const state = createNewGame({ seed: "discovery-trail" });
  const before = state.economy.cash;
  const ids = state.adventure.stamps.map((stamp) => stamp.id);
  assert.equal(getAdventureView(state).found, 0);
  assert.equal(applyAction(state, { type: "collectStamp", stampId: ids[0] }).ok, true);
  assert.equal(state.economy.cash, before + 75);
  assert.equal(applyAction(state, { type: "collectStamp", stampId: ids[0] }).ok, false);
  for (const stampId of ids.slice(1)) assert.equal(applyAction(state, { type: "collectStamp", stampId }).ok, true);
  assert.deepEqual(getAdventureView(state), {
    title: "Living Globe Discovery Trail",
    found: 5,
    total: 5,
    completed: true,
    remaining: []
  });
  assert.equal(state.economy.cash, before + 5 * 75 + 500);
});

test("visible staff roster follows hiring and firing without replacing existing identities", () => {
  const state = createNewGame({ seed: "staff-roster" });
  const originalIds = state.staffAgents.map((agent) => agent.id);
  assert.deepEqual(state.staffAgents.map((agent) => agent.role).sort(), ["cleaner", "mechanic"]);
  assert.equal(applyAction(state, { type: "staff", role: "cleaners", delta: 1 }).ok, true);
  assert.equal(state.staffAgents.filter((agent) => agent.role === "cleaner").length, 2);
  assert.ok(originalIds.every((id) => state.staffAgents.some((agent) => agent.id === id)));
  assert.equal(applyAction(state, { type: "staff", role: "cleaners", delta: -1 }).ok, true);
  assert.deepEqual(state.staffAgents.map((agent) => agent.id).sort(), originalIds.sort());
});

test("a cleaner routes to spatial litter and reports evidenced work", () => {
  const state = createNewGame({ seed: "cleaner-routing" });
  const cleaner = state.staffAgents.find((agent) => agent.role === "cleaner");
  const before = state.park.litter;
  simulateMinutes(state, 90);
  assert.equal(before, 4);
  assert.equal(state.park.litter, 0);
  assert.equal(state.world.litter.length, 0);
  assert.equal(state.operations.todayCleanups, 4);
  assert.equal(cleaner.jobsCompleted, 4);
  assert.ok(state.world.paths.some((path) => path.x === cleaner.cell[0] && path.z === cleaner.cell[1]));
  assert.equal(state.eventLog.filter((item) => item.type === "staff.cleaner.completed").length, 4);
  assert.match(getStaffInsight(state, cleaner.id).agent.lastCompletedJob, /cleared litter/i);
});

test("a mechanic reaches a worn ride before charging for care", () => {
  const state = createNewGame({ seed: "mechanic-routing" });
  state.park.open = false;
  const carousel = state.world.entities.find((entity) => entity.catalogId === "carousel");
  const mechanic = state.staffAgents.find((agent) => agent.role === "mechanic");
  carousel.condition = 53;
  const beforeCash = state.economy.cash;
  simulateMinutes(state, 60);
  assert.equal(carousel.condition, 58);
  assert.equal(state.economy.cash, beforeCash - 28);
  assert.equal(state.operations.todayRepairs, 1);
  assert.equal(mechanic.jobsCompleted, 1);
  assert.equal(state.eventLog.filter((item) => item.type === "staff.mechanic.completed").length, 1);
  assert.match(getStaffInsight(state, mechanic.id).agent.lastCompletedJob, /completed paid care/i);
});

test("opening signal is deterministic, state-bound, JSON-safe, and non-authoritative", () => {
  const state = createNewGame({ seed: "opening-signal" });
  const before = structuredClone(state);
  const first = deriveOpeningSignal(state);
  const second = deriveOpeningSignal(state);
  assert.deepEqual(first, second);
  assert.deepEqual(state, before, "deriving presentation must not mutate simulation state");
  assert.equal(first.authoritative, false);
  assert.equal(first.rebuildable, true);
  assert.equal(first.parameters.sourceStateHash, state.stateHash);
  assert.equal(first.state_version, state.tick);
  assert.deepEqual(Object.keys(first).sort(), [
    "authoritative", "clip_id", "duration_ticks", "entity_id", "parameters",
    "rebuildable", "signal_id", "source_event_id", "start_tick", "state_version"
  ]);
  assert.doesNotThrow(() => JSON.stringify(first));
  const later = structuredClone(state);
  later.tick += 1;
  later.stateHash = stateHash(later);
  assert.notEqual(deriveOpeningSignal(later).signal_id, first.signal_id);
});

test("v0.4 saves migrate spatial litter and visible crew into save version 3", () => {
  const legacy = createNewGame({ seed: "v040-save" });
  legacy.schemaVersion = 2;
  delete legacy.staffAgents;
  delete legacy.nextStaffId;
  delete legacy.world.litter;
  delete legacy.world.nextLitterId;
  delete legacy.operations.todayCleanups;
  delete legacy.operations.todayRepairs;
  legacy.park.litter = 3;
  legacy.stateHash = stateHash(legacy);
  const restored = deserializeGame(JSON.stringify({
    schema: "axm.theme-park.playable-save",
    version: 2,
    savedAt: "2026-08-21T00:00:00.000Z",
    state: legacy
  }));
  assert.equal(restored.schemaVersion, 3);
  assert.equal(restored.staffAgents.length, 2);
  assert.equal(restored.world.litter.length, 1);
  assert.equal(restored.world.litter[0].amount, 3);
  assert.equal(restored.operations.todayCleanups, 0);
  assert.equal(restored.operations.todayRepairs, 0);
});

test("v0.3 save payloads migrate into the v0.4.6 runtime", () => {
  const legacy = createNewGame({ seed: "legacy-save" });
  legacy.schemaVersion = 1;
  delete legacy.gameMode;
  delete legacy.progression;
  delete legacy.operations;
  delete legacy.adventure;
  delete legacy.economy.todayVisitors;
  for (const entity of legacy.world.entities) {
    delete entity.queueCapacity;
    delete entity.queueWaitMinutes;
    delete entity.todayRevenue;
  }
  legacy.stateHash = stateHash(legacy);
  const payload = JSON.stringify({
    schema: "axm.theme-park.playable-save",
    version: 1,
    savedAt: "2026-08-12T00:00:00.000Z",
    state: legacy
  });
  const restored = deserializeGame(payload);
  assert.equal(restored.schemaVersion, 3);
  assert.equal(restored.gameMode, "campaign");
  assert.equal(restored.progression.level, 1);
  assert.equal(restored.operations.dayReport, null);
  assert.equal(restored.adventure.stamps.length, 5);
  assert.ok(restored.world.entities.every((entity) => Number.isFinite(entity.todayRevenue)));
  assert.equal(restored.staffAgents.length, 2);
  assert.ok(restored.world.litter.length > 0);
});
