import { cellKey, findPath, reachablePathKeys } from "./pathfinding.js";
import {
  nextStaffZone, normalizeStaffDevelopment, STAFF_ZONE_IDS, STAFF_ZONE_LABELS,
  staffTrainingCost, staffTrainingProfile, staffZoneContainsCell
} from "./staffManagement.js";

const ROLE_FROM_COUNT = { cleaners: "cleaner", mechanics: "mechanic" };
const COUNT_FROM_ROLE = { cleaner: "cleaners", mechanic: "mechanics" };

const cloneCell = (cell) => [Number(cell?.[0] ?? 0), Number(cell?.[1] ?? 0)];
const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

function stableNumber(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function appendStaffEvent(state, type, subjectId, data = {}) {
  state.eventLog ??= [];
  state.eventLog.push({
    sequence: state.eventLog.length + 1,
    tick: Number(state.tick) || 0,
    type,
    subjectId,
    data
  });
  if (state.eventLog.length > 400) state.eventLog.splice(0, state.eventLog.length - 400);
}

function freshAgent(state, role) {
  const id = `staff-${state.nextStaffId++}`;
  return {
    id,
    role,
    cell: cloneCell(state.world.entrance),
    route: [cloneCell(state.world.entrance)],
    routeIndex: 0,
    routeProgress: 0,
    state: "idle",
    targetId: null,
    jobsCompleted: 0,
    workMinutes: 0,
    cooldown: 0,
    idleMinutes: 0,
    trainingLevel: 0,
    trainingSpent: 0,
    zone: "all",
    lastCompletedJob: null,
    lastThought: role === "cleaner" ? "Keeping an eye on the paths." : "Listening for rides that need care."
  };
}

export function normalizeStaffState(state) {
  state.staff ??= { cleaners: 0, mechanics: 0 };
  state.staff.cleaners = Math.max(0, Math.floor(Number(state.staff.cleaners) || 0));
  state.staff.mechanics = Math.max(0, Math.floor(Number(state.staff.mechanics) || 0));
  state.nextStaffId = Math.max(1, Math.floor(Number(state.nextStaffId) || 1));
  state.staffAgents = Array.isArray(state.staffAgents) ? state.staffAgents : [];
  state.world ??= {};
  state.world.litter = Array.isArray(state.world.litter) ? state.world.litter : [];
  state.world.nextLitterId = Math.max(1, Math.floor(Number(state.world.nextLitterId) || 1));
  state.operations ??= { dayReport: null, lastReportDay: 0 };
  state.operations.todayCleanups ??= 0;
  state.operations.todayRepairs ??= 0;

  for (const pile of state.world.litter) {
    pile.id ??= `litter-${state.world.nextLitterId++}`;
    pile.cell = cloneCell(pile.cell ?? state.world.entrance);
    pile.amount = Math.max(0.05, Number(pile.amount) || 0.05);
  }
  state.world.litter = state.world.litter.filter((pile) => pile.amount > 0);

  for (const agent of state.staffAgents) {
    agent.role = agent.role === "mechanic" ? "mechanic" : "cleaner";
    agent.cell = cloneCell(agent.cell ?? state.world.entrance);
    agent.route = Array.isArray(agent.route) && agent.route.length
      ? agent.route.map(cloneCell) : [cloneCell(agent.cell)];
    agent.routeIndex = Math.max(0, Math.min(agent.route.length - 1, Math.floor(Number(agent.routeIndex) || 0)));
    agent.routeProgress = Math.max(0, Math.min(1, Number(agent.routeProgress) || 0));
    agent.state ??= "idle";
    agent.targetId ??= null;
    agent.jobsCompleted ??= 0;
    agent.workMinutes ??= 0;
    agent.cooldown ??= 0;
    agent.idleMinutes ??= 0;
    normalizeStaffDevelopment(agent);
    agent.lastCompletedJob ??= null;
    agent.lastThought ??= agent.role === "cleaner" ? "Keeping an eye on the paths." : "Listening for rides that need care.";
    const match = /staff-(\d+)/.exec(agent.id);
    if (match) state.nextStaffId = Math.max(state.nextStaffId, Number(match[1]) + 1);
  }
  syncStaffRoster(state);
  return state;
}

export function syncStaffRoster(state) {
  state.staffAgents ??= [];
  state.nextStaffId ??= 1;
  for (const [countRole, role] of Object.entries(ROLE_FROM_COUNT)) {
    const desired = Math.max(0, Math.floor(Number(state.staff?.[countRole]) || 0));
    const current = state.staffAgents.filter((agent) => agent.role === role);
    while (current.length < desired) {
      const agent = freshAgent(state, role);
      state.staffAgents.push(agent);
      current.push(agent);
    }
    while (current.length > desired) {
      const removed = current.pop();
      state.staffAgents.splice(state.staffAgents.findIndex((agent) => agent.id === removed.id), 1);
    }
  }
  return state.staffAgents;
}

export function addLitterPile(state, cell, amount) {
  const value = Math.max(0, Number(amount) || 0);
  if (!value) return null;
  normalizeStaffState(state);
  const target = cloneCell(cell ?? state.world.entrance);
  let pile = state.world.litter.find((item) => cellKey(...item.cell) === cellKey(...target));
  if (!pile) {
    pile = { id: `litter-${state.world.nextLitterId++}`, cell: target, amount: 0 };
    state.world.litter.push(pile);
  }
  pile.amount += value;
  state.park.litter = Math.max(0, Number(state.park.litter) || 0) + value;
  return pile;
}

export function washLitter(state, amount) {
  let remaining = Math.max(0, Number(amount) || 0);
  if (!remaining) return 0;
  normalizeStaffState(state);
  let removed = 0;
  for (const pile of [...state.world.litter]) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, pile.amount);
    pile.amount -= take;
    remaining -= take;
    removed += take;
    if (pile.amount <= 0.001) state.world.litter.splice(state.world.litter.indexOf(pile), 1);
  }
  state.park.litter = Math.max(0, state.park.litter - removed);
  return removed;
}

export function resetStaffForDay(state) {
  normalizeStaffState(state);
  state.operations.todayCleanups = 0;
  state.operations.todayRepairs = 0;
  for (const agent of state.staffAgents) {
    agent.state = "idle";
    agent.targetId = null;
    agent.route = [cloneCell(agent.cell)];
    agent.routeIndex = 0;
    agent.routeProgress = 0;
    agent.cooldown = 0;
    agent.idleMinutes = 0;
    agent.lastThought = agent.role === "cleaner" ? "Starting the morning path check." : "Beginning the morning ride check.";
  }
}

export function resetStaffAssignment(agent, thought = null) {
  if (!agent) return false;
  agent.state = "idle";
  agent.targetId = null;
  agent.route = [cloneCell(agent.cell)];
  agent.routeIndex = 0;
  agent.routeProgress = 0;
  agent.cooldown = 0;
  agent.idleMinutes = 0;
  if (thought) agent.lastThought = thought;
  return true;
}

/**
 * Bounded authoritative staff-development actions. This is deliberately kept
 * beside staff routing so training/zoning cannot become a parallel staff engine.
 */
export function applyStaffDevelopmentAction(state, action = {}) {
  normalizeStaffState(state);
  const agent = state.staffAgents.find((item) => item.id === action.staffId);
  if (!agent) return { ok: false, reason: "Crew member not found." };

  if (action.type === "trainStaff") {
    const cost = staffTrainingCost(agent);
    if (cost === null) return { ok: false, reason: "This crew member already has maximum training." };
    if ((state.economy?.cash ?? 0) < cost) return { ok: false, reason: `Training requires €${cost}.` };
    state.economy.cash = roundMoney(state.economy.cash - cost);
    state.economy.todayCosts = roundMoney((state.economy.todayCosts ?? 0) + cost);
    state.economy.lifetimeCosts = roundMoney((state.economy.lifetimeCosts ?? 0) + cost);
    agent.trainingLevel += 1;
    agent.trainingSpent = roundMoney(agent.trainingSpent + cost);
    const profile = staffTrainingProfile(agent);
    resetStaffAssignment(agent, `Training level ${agent.trainingLevel} complete. Ready for a stronger shift.`);
    appendStaffEvent(state, "staff.training.completed", agent.id, {
      level: agent.trainingLevel,
      cost,
      movePerMinute: profile.movePerMinute,
      cleanerCapacity: profile.cleanerCapacity,
      mechanicRepair: profile.mechanicRepair
    });
    return {
      ok: true,
      message: `${agent.role === "cleaner" ? "Cleaner" : "Mechanic"} training L${agent.trainingLevel} complete · €${cost}.`,
      staffId: agent.id,
      level: agent.trainingLevel,
      cost
    };
  }

  if (action.type === "setStaffZone" || action.type === "cycleStaffZone") {
    const requested = action.type === "cycleStaffZone" ? nextStaffZone(agent.zone) : action.zone;
    if (!STAFF_ZONE_IDS.includes(requested)) return { ok: false, reason: "Unknown crew work zone." };
    agent.zone = requested;
    resetStaffAssignment(agent, `Assigned to ${STAFF_ZONE_LABELS[agent.zone].toLowerCase()}.`);
    appendStaffEvent(state, "staff.zone.changed", agent.id, { zone: agent.zone });
    return {
      ok: true,
      message: `${agent.role === "cleaner" ? "Cleaner" : "Mechanic"} zone · ${STAFF_ZONE_LABELS[agent.zone]}.`,
      staffId: agent.id,
      zone: agent.zone
    };
  }

  return { ok: false, reason: `Unknown staff development action: ${action.type}` };
}

function pathKeys(state) {
  return new Set((state.world.paths ?? []).map((path) => cellKey(path.x, path.z)));
}

function inAgentZone(state, agent, cell) {
  return staffZoneContainsCell(agent.zone, cell, state.world.size);
}

function routeAgent(state, agent, targetCell, targetId, workingState) {
  const route = findPath(pathKeys(state), agent.cell, [targetCell], state.world.size);
  if (!route.length) return false;
  agent.route = route;
  agent.routeIndex = 0;
  agent.routeProgress = 0;
  agent.targetId = targetId;
  agent.state = workingState;
  agent.idleMinutes = 0;
  return true;
}

function pickCleanerJob(state, agent) {
  const candidates = (state.world.litter ?? [])
    .filter((pile) => pile.amount > 0 && inAgentZone(state, agent, pile.cell))
    .sort((a, b) => distance(agent.cell, a.cell) - distance(agent.cell, b.cell) || a.id.localeCompare(b.id));
  for (const pile of candidates) {
    if (routeAgent(state, agent, pile.cell, pile.id, "walking-to-litter")) {
      agent.lastThought = agent.zone === "all"
        ? "Heading to a visible litter spot."
        : `Heading to litter inside my ${STAFF_ZONE_LABELS[agent.zone].toLowerCase()} work zone.`;
      return true;
    }
  }
  return false;
}

function pickMechanicJob(state, agent) {
  const candidates = (state.world.entities ?? [])
    .filter((entity) => entity.kind === "ride" && entity.accessCell && entity.condition < 58
      && inAgentZone(state, agent, entity.accessCell))
    .sort((a, b) => a.condition - b.condition || distance(agent.cell, a.accessCell) - distance(agent.cell, b.accessCell) || a.id.localeCompare(b.id));
  for (const entity of candidates) {
    if (routeAgent(state, agent, entity.accessCell, entity.id, "walking-to-ride")) {
      agent.lastThought = agent.zone === "all"
        ? "Routing to a ride that has evidence of wear."
        : `Routing to worn equipment inside my ${STAFF_ZONE_LABELS[agent.zone].toLowerCase()} work zone.`;
      return true;
    }
  }
  return false;
}

function assignPatrol(state, agent) {
  agent.idleMinutes += 1;
  if (agent.idleMinutes < 10) return;
  const reachable = [...reachablePathKeys(pathKeys(state), state.world.entrance, state.world.size)]
    .filter((key) => inAgentZone(state, agent, key.split(",").map(Number)))
    .sort();
  if (!reachable.length) {
    agent.lastThought = `No connected patrol path reaches my ${STAFF_ZONE_LABELS[agent.zone].toLowerCase()} work zone.`;
    return;
  }
  const patrolIndex = (stableNumber(agent.id) + Math.floor(state.tick / 10)) % reachable.length;
  const target = reachable[patrolIndex].split(",").map(Number);
  if (routeAgent(state, agent, target, `patrol-${reachable[patrolIndex]}`, "patrolling")) {
    const zoneText = agent.zone === "all" ? "connected paths" : STAFF_ZONE_LABELS[agent.zone].toLowerCase();
    agent.lastThought = agent.role === "cleaner"
      ? `Patrolling ${zoneText}.`
      : `Walking a preventive inspection round through ${zoneText}.`;
  }
}

function walkAgent(agent) {
  if (!agent.route?.length || agent.routeIndex >= agent.route.length - 1) return true;
  const profile = staffTrainingProfile(agent);
  agent.routeProgress += profile.movePerMinute;
  if (agent.routeProgress < 1) return false;
  agent.routeProgress -= 1;
  agent.routeIndex += 1;
  agent.cell = cloneCell(agent.route[agent.routeIndex]);
  return agent.routeIndex >= agent.route.length - 1;
}

function finishCleanerJob(state, agent, hooks) {
  const pile = state.world.litter.find((item) => item.id === agent.targetId);
  if (!pile || pile.amount <= 0) return false;
  const profile = staffTrainingProfile(agent);
  const removed = Math.min(profile.cleanerCapacity, pile.amount);
  pile.amount -= removed;
  state.park.litter = Math.max(0, state.park.litter - removed);
  if (pile.amount <= 0.001) state.world.litter.splice(state.world.litter.indexOf(pile), 1);
  agent.jobsCompleted += 1;
  state.operations.todayCleanups += 1;
  agent.lastThought = agent.trainingLevel
    ? `Cleared ${removed.toFixed(1)} litter with level ${agent.trainingLevel} training.`
    : "Cleared litter where guests actually left it.";
  agent.lastCompletedJob = agent.lastThought;
  hooks.event?.(state, "staff.cleaner.completed", agent.id, {
    pileId: pile.id,
    amount: removed,
    cell: cloneCell(agent.cell),
    trainingLevel: agent.trainingLevel,
    zone: agent.zone
  });
  return true;
}

function finishMechanicJob(state, agent, hooks) {
  const entity = state.world.entities.find((item) => item.id === agent.targetId);
  if (!entity || entity.kind !== "ride" || entity.condition >= 58 || state.economy.cash < 28) return false;
  const profile = staffTrainingProfile(agent);
  hooks.charge?.(state, 28, "Routine mechanical care");
  const before = entity.condition;
  entity.condition = Math.min(100, entity.condition + profile.mechanicRepair);
  agent.jobsCompleted += 1;
  state.operations.todayRepairs += 1;
  agent.lastThought = agent.trainingLevel
    ? `Completed level ${agent.trainingLevel} paid care without replacing the ride.`
    : "Completed paid care without replacing the ride.";
  agent.lastCompletedJob = agent.lastThought;
  hooks.event?.(state, "staff.mechanic.completed", agent.id, {
    entityId: entity.id,
    condition: entity.condition,
    restored: entity.condition - before,
    cost: 28,
    trainingLevel: agent.trainingLevel,
    zone: agent.zone
  });
  return true;
}

export function advanceStaffAgents(state, hooks = {}) {
  normalizeStaffState(state);
  for (const agent of state.staffAgents) {
    const profile = staffTrainingProfile(agent);
    agent.workMinutes += 1;
    if (agent.cooldown > 0) {
      agent.cooldown -= 1;
      continue;
    }
    if (agent.state === "idle") {
      const assigned = agent.role === "cleaner" ? pickCleanerJob(state, agent) : pickMechanicJob(state, agent);
      if (!assigned) assignPatrol(state, agent);
    }
    if (!["idle"].includes(agent.state) && walkAgent(agent)) {
      let worked = false;
      if (agent.state === "walking-to-litter") worked = finishCleanerJob(state, agent, hooks);
      else if (agent.state === "walking-to-ride") worked = finishMechanicJob(state, agent, hooks);
      agent.state = "idle";
      agent.targetId = null;
      agent.route = [cloneCell(agent.cell)];
      agent.routeIndex = 0;
      agent.routeProgress = 0;
      agent.cooldown = worked ? profile.cooldownMinutes : 0;
    }
  }
  return state.staffAgents;
}

export function getStaffInsight(state, staffId) {
  const agent = state.staffAgents?.find((item) => item.id === staffId);
  if (!agent) return null;
  normalizeStaffDevelopment(agent);
  const targetRide = agent.role === "mechanic"
    ? state.world.entities.find((entity) => entity.id === agent.targetId) ?? null : null;
  const targetLitter = agent.role === "cleaner"
    ? state.world.litter?.find((pile) => pile.id === agent.targetId) ?? null : null;
  const activity = {
    idle: "Watching the live park",
    patrolling: "Patrolling connected paths",
    "walking-to-litter": "Routing to a litter spot",
    "walking-to-ride": "Routing to a worn ride"
  }[agent.state] ?? agent.state;
  return {
    agent,
    activity,
    targetRide,
    targetLitter,
    rosterCount: state.staff?.[COUNT_FROM_ROLE[agent.role]] ?? 0,
    zoneLabel: STAFF_ZONE_LABELS[agent.zone],
    training: staffTrainingProfile(agent)
  };
}
