import {
  CAMPAIGN_LEVELS, CATALOG, GRID_SIZE, PARK_CLOSE_MINUTE, PARK_OPEN_MINUTE,
  campaignLevelForCatalog, catalogDefinition, catalogIdsThroughLevel, rotatedFootprint
} from "./catalog.js";
import { cellKey, findPath, neighbors, reachablePathKeys } from "./pathfinding.js";
import { hashString, nextRandom, pick, randomInt, stateHash } from "./random.js";
import { adventureProgress, createAdventureState } from "./adventure.js";
import {
  addLitterPile, advanceStaffAgents, getStaffInsight as staffInsight,
  normalizeStaffState, resetStaffForDay, syncStaffRoster, washLitter
} from "./staff.js";

const SEGMENTS = ["family", "thrill", "explorer", "local"];
const ORIGINS = ["nearby", "regional", "tourist"];

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const roundMoney = (value) => Math.round(value * 100) / 100;
const keyOf = ([x, z]) => cellKey(x, z);
const isRestFacility = (definition) => definition.need === "rest" && definition.capacity > 0;
const handlesVisitors = (definition) => definition.kind === "ride"
  || definition.kind === "service" || isRestFacility(definition);

function progressionTargetLevel(state) {
  if (state.gameMode === "sandbox") return CAMPAIGN_LEVELS.at(-1).level;
  const visitors = state.park.lifetimeVisitors;
  const rating = state.park.rating;
  if (visitors >= 90 && rating >= 70) return 4;
  if (visitors >= 55 && rating >= 62) return 3;
  if (visitors >= 20 && rating >= 55) return 2;
  return 1;
}

export function catalogUnlocked(state, catalogId) {
  return state.gameMode === "sandbox"
    || (state.progression?.unlockedCatalogIds ?? catalogIdsThroughLevel(1)).includes(catalogId);
}

export function getProgressionView(state) {
  const level = state.progression?.level ?? 1;
  const tier = CAMPAIGN_LEVELS.find((item) => item.level === level) ?? CAMPAIGN_LEVELS[0];
  const next = CAMPAIGN_LEVELS.find((item) => item.level === level + 1) ?? null;
  return {
    level,
    label: tier.label,
    nextRequirement: next?.requirement ?? "All current attractions unlocked",
    unlockedCatalogIds: [...(state.progression?.unlockedCatalogIds ?? catalogIdsThroughLevel(level))]
  };
}

export function getAdventureView(state) {
  const progress = adventureProgress(state.adventure);
  return {
    title: state.adventure?.title ?? "Living Globe Discovery Trail",
    ...progress,
    remaining: (state.adventure?.stamps ?? []).filter((stamp) => !stamp.found)
  };
}

function updateProgression(state) {
  const target = progressionTargetLevel(state);
  const current = state.progression?.level ?? 1;
  if (!state.progression) {
    state.progression = { level: current, unlockedCatalogIds: catalogIdsThroughLevel(current) };
  }
  if (target <= current) return;
  const newlyUnlocked = catalogIdsThroughLevel(target)
    .filter((catalogId) => !state.progression.unlockedCatalogIds.includes(catalogId));
  state.progression.level = target;
  state.progression.unlockedCatalogIds = catalogIdsThroughLevel(target);
  const labels = newlyUnlocked.map((catalogId) => catalogDefinition(catalogId).label);
  notice(state, `Park level ${target}: ${labels.join(", ")} unlocked.`, "story");
  event(state, "progression.level.unlocked", state.park.id, { level: target, catalogIds: newlyUnlocked });
}

function event(state, type, subjectId, data = {}) {
  state.eventLog.push({
    sequence: state.eventLog.length + 1,
    tick: state.tick,
    type,
    subjectId,
    data
  });
  if (state.eventLog.length > 400) state.eventLog.splice(0, state.eventLog.length - 400);
}

function notice(state, text, tone = "info") {
  state.notifications.push({ id: `${state.tick}-${state.notifications.length}`, text, tone });
  if (state.notifications.length > 12) state.notifications.shift();
}

function addInitialPath(state, x, z, type = "path") {
  state.world.paths.push({ x, z, type });
}

function createEntity(state, catalogId, x, z, rotation = 0, overrides = {}) {
  const definition = catalogDefinition(catalogId);
  const entity = {
    id: `entity-${state.world.nextEntityId++}`,
    catalogId,
    kind: definition.kind,
    x,
    z,
    rotation: rotation % 4,
    builtTick: state.tick,
    condition: 100,
    evolutionLevel: 0,
    open: true,
    queue: [],
    queueCapacity: 0,
    queueWaitMinutes: 0,
    riders: [],
    cycleRemaining: 0,
    cycles: 0,
    revenue: 0,
    todayRevenue: 0,
    operatingSpend: 0,
    price: definition.ridePrice ?? definition.itemPrice ?? 0,
    accessCell: null,
    ...overrides
  };
  state.world.entities.push(entity);
  return entity;
}

export function createNewGame({ seed = "AXM-LOCAL-PARK-001", parkName = "Moonroot Park", mode = "campaign" } = {}) {
  const gameMode = mode === "sandbox" ? "sandbox" : "campaign";
  const startingLevel = gameMode === "sandbox" ? CAMPAIGN_LEVELS.at(-1).level : 1;
  const state = {
    schemaVersion: 3,
    gameMode,
    seed: String(seed),
    rngState: hashString(seed) || 0x6d2b79f5,
    tick: 0,
    stateHash: "",
    clock: { day: 1, minute: PARK_OPEN_MINUTE, season: "spring", year: 1 },
    weather: { type: "bright", temperature: 17, wind: 0.18, precipitation: 0 },
    park: {
      id: "park-moonroot",
      name: parkName,
      identity: "small local family park",
      promise: "A cared-for local adventure where classics and new discoveries coexist.",
      open: true,
      ticketPrice: 12,
      reputation: 48,
      rating: 58,
      cleanliness: 87,
      litter: 0,
      marketing: "local-families",
      lifetimeVisitors: 0,
      inspections: [],
      selectedEnding: null
    },
    economy: {
      cash: 12800,
      loan: 0,
      todayIncome: 0,
      todayCosts: 0,
      todayVisitors: 0,
      lifetimeIncome: 0,
      lifetimeCosts: 0
    },
    progression: {
      level: startingLevel,
      unlockedCatalogIds: catalogIdsThroughLevel(startingLevel)
    },
    operations: {
      dayReport: null,
      lastReportDay: 0,
      todayCleanups: 0,
      todayRepairs: 0,
      todayBenchRests: 0
    },
    adventure: createAdventureState(),
    staff: { cleaners: 1, mechanics: 1 },
    staffAgents: [],
    nextStaffId: 1,
    world: {
      size: GRID_SIZE,
      entrance: [15, 29],
      paths: [],
      entities: [],
      nextEntityId: 1,
      litter: [],
      nextLitterId: 1
    },
    visitors: [],
    nextVisitorId: 1,
    campaign: {
      id: "forgotten-local-park",
      title: "A Local Park With a Future",
      briefing: "You inherited a modest fairground with one beloved old carousel. Care for what works, then decide what this place should become.",
      objectives: [
        { id: "care", label: "Keep cleanliness and ride condition above 75", complete: false },
        { id: "welcome", label: "Welcome 80 visitors", complete: false },
        { id: "identity", label: "Operate three different ride types and reach rating 70", complete: false }
      ],
      availableEndings: [],
      completed: false
    },
    metrics: {
      averageHappiness: 70,
      reachableDemand: 0.45,
      familyAlignment: 0.5,
      thrillAlignment: 0.1,
      explorerAlignment: 0.35,
      serviceCoverage: 0.25,
      atmosphere: 0.45,
      reliableRideShare: 1,
      activeAttendance: 0
    },
    eventLog: [],
    notifications: []
  };

  if (gameMode === "sandbox") {
    state.economy.cash = 50000;
    state.campaign.id = "living-globe-sandbox";
    state.campaign.title = "Living Globe Sandbox";
    state.campaign.briefing = "All current attractions are unlocked. Build freely, then walk through the same live simulation.";
  }

  for (let z = 29; z >= 22; z -= 1) addInitialPath(state, 15, z);
  for (let x = 10; x <= 21; x += 1) addInitialPath(state, x, 22);
  for (let z = 22; z >= 17; z -= 1) addInitialPath(state, 10, z);
  for (let x = 10; x <= 14; x += 1) addInitialPath(state, x, 17);

  addLitterPile(state, [15, 25], 2);
  addLitterPile(state, [12, 22], 2);

  createEntity(state, "carousel", 11, 18, 0, {
    builtTick: -365 * 24 * 60 * 18,
    condition: 82,
    evolutionLevel: 1,
    price: 2
  });
  createEntity(state, "snacks", 18, 20, 0, { condition: 76 });
  createEntity(state, "fountain", 15, 19);
  createEntity(state, "bench", 14, 23, 0);
  createEntity(state, "bench", 17, 23, 0);
  createEntity(state, "tree", 9, 19);
  createEntity(state, "tree", 16, 17);
  createEntity(state, "tree", 20, 19);
  createEntity(state, "lantern", 12, 23);
  createEntity(state, "lantern", 19, 23);

  refreshConnections(state);
  recomputeMetrics(state);
  event(state, "campaign.started", state.campaign.id, { inheritedAssets: true });
  notice(state, "The gates are open. The old carousel still has a future.", "story");
  normalizeStaffState(state);
  state.stateHash = stateHash(state);
  return state;
}

export function pathSet(state) {
  return new Set(state.world.paths.map(({ x, z }) => cellKey(x, z)));
}

function queuePathSet(state) {
  return new Set(state.world.paths
    .filter((path) => path.type === "queue")
    .map(({ x, z }) => cellKey(x, z)));
}

function connectedQueueTiles(state, accessCell) {
  if (!accessCell) return 0;
  const allowed = queuePathSet(state);
  const start = keyOf(accessCell);
  if (!allowed.has(start)) return 0;
  const reached = new Set([start]);
  const queue = [accessCell];
  let cursor = 0;
  while (cursor < queue.length && reached.size < 24) {
    const [x, z] = queue[cursor++];
    for (const cell of neighbors(x, z, state.world.size)) {
      const key = keyOf(cell);
      if (!allowed.has(key) || reached.has(key)) continue;
      reached.add(key);
      queue.push(cell);
    }
  }
  return reached.size;
}

export function estimateQueueWait(entity) {
  const definition = catalogDefinition(entity.catalogId);
  if (!handlesVisitors(definition)) return 0;
  const capacity = Math.max(1, definition.capacity ?? 1);
  const duration = definition.kind === "ride" ? definition.cycleMinutes : definition.serviceMinutes;
  return Math.max(0, entity.cycleRemaining ?? 0) + Math.ceil((entity.queue?.length ?? 0) / capacity) * duration;
}

export function entityCells(entity) {
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation);
  const result = [];
  for (let dx = 0; dx < width; dx += 1) {
    for (let dz = 0; dz < depth; dz += 1) result.push([entity.x + dx, entity.z + dz]);
  }
  return result;
}

export function occupiedCells(state, exceptId = null) {
  const result = new Map();
  for (const entity of state.world.entities) {
    if (entity.id === exceptId) continue;
    for (const [x, z] of entityCells(entity)) result.set(cellKey(x, z), entity.id);
  }
  return result;
}

export function canPlace(state, catalogId, x, z, rotation = 0) {
  const definition = catalogDefinition(catalogId);
  if (!catalogUnlocked(state, catalogId)) {
    const level = campaignLevelForCatalog(catalogId);
    const requirement = CAMPAIGN_LEVELS.find((tier) => tier.level === level)?.requirement ?? "Keep growing the park";
    return { ok: false, reason: `Unlocks at park level ${level}: ${requirement}.` };
  }
  const [width, depth] = rotatedFootprint(definition, rotation);
  if (x < 0 || z < 0 || x + width > state.world.size || z + depth > state.world.size) {
    return { ok: false, reason: "Outside the park boundary." };
  }
  const occupied = occupiedCells(state);
  const paths = pathSet(state);
  for (let dx = 0; dx < width; dx += 1) {
    for (let dz = 0; dz < depth; dz += 1) {
      const key = cellKey(x + dx, z + dz);
      if (occupied.has(key)) return { ok: false, reason: "Another park element occupies this space." };
      if (definition.kind !== "path" && paths.has(key)) return { ok: false, reason: "This would block an existing path." };
      if (definition.kind === "path" && paths.has(key)) return { ok: false, reason: "A path already exists here." };
    }
  }
  if (state.economy.cash < definition.cost) return { ok: false, reason: "Not enough cash." };
  return { ok: true };
}

function perimeterCells(state, entity) {
  const cells = entityCells(entity);
  const owned = new Set(cells.map(keyOf));
  const result = [];
  for (const [x, z] of cells) {
    for (const candidate of neighbors(x, z, state.world.size)) {
      const key = keyOf(candidate);
      if (!owned.has(key) && !result.some((item) => keyOf(item) === key)) result.push(candidate);
    }
  }
  return result;
}

export function getPlacementPreview(state, catalogId, x, z, rotation = 0) {
  const definition = catalogDefinition(catalogId);
  const check = canPlace(state, catalogId, x, z, rotation);
  const base = {
    ...check,
    catalogId,
    label: definition.label,
    cost: definition.cost,
    cell: [x, z],
    rotation,
    connection: null,
    newlyReachableTiles: 0
  };
  if (!check.ok) {
    return {
      ...base,
      tone: "invalid",
      title: "Cannot build here",
      detail: check.reason
    };
  }

  const reachableBefore = reachablePathKeys(pathSet(state), state.world.entrance, state.world.size);
  if (definition.kind === "path") {
    const proposedPaths = pathSet(state);
    proposedPaths.add(cellKey(x, z));
    const reachableAfter = reachablePathKeys(proposedPaths, state.world.entrance, state.world.size);
    const connection = reachableAfter.has(cellKey(x, z)) ? "connected" : "disconnected";
    const newlyReachableTiles = Math.max(0, reachableAfter.size - reachableBefore.size);
    return {
      ...base,
      connection,
      newlyReachableTiles,
      tone: connection === "connected" ? "connected" : "caution",
      title: connection === "connected" ? "Joins the entrance network" : "Isolated path segment",
      detail: connection === "connected"
        ? `${newlyReachableTiles} path tile${newlyReachableTiles === 1 ? "" : "s"} will become reachable.`
        : "Guests cannot use this segment until a continuous path reaches it."
    };
  }

  if (handlesVisitors(definition)) {
    const proposed = { catalogId, x, z, rotation };
    const accessCell = perimeterCells(state, proposed).find((cell) => reachableBefore.has(keyOf(cell))) ?? null;
    const connection = accessCell ? "connected" : "disconnected";
    return {
      ...base,
      connection,
      accessCell,
      tone: connection === "connected" ? "connected" : "caution",
      title: connection === "connected" ? "Guests can reach this" : "No guest access yet",
      detail: connection === "connected"
        ? `Connects through path cell ${accessCell[0]},${accessCell[1]}.`
        : "Build a continuous path beside its footprint before guests can use it."
    };
  }

  return {
    ...base,
    tone: "neutral",
    title: "Legal scenery placement",
    detail: "Scenery can be placed here and does not require guest access."
  };
}

export function refreshConnections(state) {
  const paths = pathSet(state);
  const queuePaths = queuePathSet(state);
  const reachable = reachablePathKeys(paths, state.world.entrance, state.world.size);
  for (const entity of state.world.entities) {
    const access = perimeterCells(state, entity).filter((cell) => reachable.has(keyOf(cell)));
    const queueAccess = access.find((cell) => queuePaths.has(keyOf(cell)));
    entity.accessCell = queueAccess ?? access[0] ?? null;
    const definition = catalogDefinition(entity.catalogId);
    if (handlesVisitors(definition)) {
      const baseCapacity = Math.max(2, definition.capacity ?? 1);
      const laneTiles = connectedQueueTiles(state, entity.accessCell);
      entity.queueCapacity = Math.min(48, baseCapacity + laneTiles * 2);
      entity.queueWaitMinutes = estimateQueueWait(entity);
    }
  }
  return reachable;
}

function charge(state, amount, label) {
  state.economy.cash = roundMoney(state.economy.cash - amount);
  state.economy.todayCosts = roundMoney(state.economy.todayCosts + amount);
  state.economy.lifetimeCosts = roundMoney(state.economy.lifetimeCosts + amount);
  event(state, "economy.cost", "park", { amount, label });
}

function earn(state, amount, label, entity = null) {
  state.economy.cash = roundMoney(state.economy.cash + amount);
  state.economy.todayIncome = roundMoney(state.economy.todayIncome + amount);
  state.economy.lifetimeIncome = roundMoney(state.economy.lifetimeIncome + amount);
  if (entity) {
    entity.revenue = roundMoney(entity.revenue + amount);
    entity.todayRevenue = roundMoney((entity.todayRevenue ?? 0) + amount);
  }
  event(state, "economy.income", entity?.id ?? "park", { amount, label });
}

export function applyAction(state, action) {
  switch (action.type) {
    case "build": {
      const preview = getPlacementPreview(state, action.catalogId, action.x, action.z, action.rotation ?? 0);
      if (!preview.ok) return preview;
      const definition = catalogDefinition(action.catalogId);
      charge(state, definition.cost, `Build ${definition.label}`);
      let builtEntity = null;
      if (definition.kind === "path") {
        state.world.paths.push({ x: action.x, z: action.z, type: action.catalogId });
        event(state, "path.built", cellKey(action.x, action.z), { catalogId: action.catalogId });
      } else {
        builtEntity = createEntity(state, action.catalogId, action.x, action.z, action.rotation ?? 0);
        event(state, "entity.built", builtEntity.id, { catalogId: action.catalogId });
      }
      const reachable = refreshConnections(state);
      recomputeMetrics(state);
      state.stateHash = stateHash(state);
      const connection = definition.kind === "path"
        ? (reachable.has(cellKey(action.x, action.z)) ? "connected" : "disconnected")
        : handlesVisitors(definition) ? (builtEntity?.accessCell ? "connected" : "disconnected") : null;
      return {
        ok: true,
        receipt: {
          catalogId: action.catalogId,
          label: definition.label,
          kind: definition.kind,
          cost: definition.cost,
          cashAfter: state.economy.cash,
          x: action.x,
          z: action.z,
          rotation: action.rotation ?? 0,
          connection,
          dragging: Boolean(action.dragging)
        }
      };
    }
    case "removePath": {
      const index = state.world.paths.findIndex((path) => path.x === action.x && path.z === action.z);
      if (index < 0) return { ok: false, reason: "No path exists here." };
      const [removed] = state.world.paths.splice(index, 1);
      const refund = Math.floor(catalogDefinition(removed.type).cost * 0.4);
      earn(state, refund, "Recovered path material");
      event(state, "path.removed", cellKey(action.x, action.z), { playerChoice: true });
      refreshConnections(state);
      recomputeMetrics(state);
      return { ok: true };
    }
    case "replace": {
      const index = state.world.entities.findIndex((entity) => entity.id === action.entityId);
      if (index < 0) return { ok: false, reason: "Park element not found." };
      const entity = state.world.entities[index];
      const definition = catalogDefinition(entity.catalogId);
      if (entity.riders.length || entity.queue.length) return { ok: false, reason: "Close and clear this attraction first." };
      state.world.entities.splice(index, 1);
      earn(state, Math.floor(definition.cost * 0.3), `Recovered material from ${definition.label}`);
      event(state, "entity.replaced", entity.id, { deliberatePlayerChoice: true });
      refreshConnections(state);
      recomputeMetrics(state);
      return { ok: true };
    }
    case "maintain": {
      const entity = state.world.entities.find((item) => item.id === action.entityId);
      if (!entity) return { ok: false, reason: "Park element not found." };
      const definition = catalogDefinition(entity.catalogId);
      const cost = Math.max(35, Math.round(definition.cost * 0.035));
      if (state.economy.cash < cost) return { ok: false, reason: "Not enough cash for maintenance." };
      charge(state, cost, `Maintain ${definition.label}`);
      entity.condition = Math.min(100, entity.condition + 28);
      entity.open = true;
      event(state, "entity.maintained", entity.id, { condition: entity.condition, cost });
      notice(state, `${definition.label} was maintained, not erased.`, "good");
      return { ok: true };
    }
    case "evolve": {
      const entity = state.world.entities.find((item) => item.id === action.entityId);
      if (!entity) return { ok: false, reason: "Park element not found." };
      const definition = catalogDefinition(entity.catalogId);
      if (entity.evolutionLevel >= 3) return { ok: false, reason: "This slice supports three evolution steps per element." };
      const cost = Math.round(definition.cost * (0.14 + entity.evolutionLevel * 0.05));
      if (state.economy.cash < cost) return { ok: false, reason: "Not enough cash for this evolution." };
      charge(state, cost, `Evolve ${definition.label}`);
      entity.evolutionLevel += 1;
      entity.condition = Math.min(100, entity.condition + 12);
      event(state, "entity.evolved", entity.id, { level: entity.evolutionLevel, cost });
      notice(state, `${definition.label} evolved while keeping its history.`, "good");
      recomputeMetrics(state);
      return { ok: true };
    }
    case "toggleEntity": {
      const entity = state.world.entities.find((item) => item.id === action.entityId);
      if (!entity) return { ok: false, reason: "Park element not found." };
      entity.open = !entity.open;
      event(state, entity.open ? "entity.opened" : "entity.closed", entity.id, { playerChoice: true });
      return { ok: true };
    }
    case "setEntityPrice": {
      const entity = state.world.entities.find((item) => item.id === action.entityId);
      if (!entity) return { ok: false, reason: "Park element not found." };
      entity.price = clamp(Number(action.value), 0, 20);
      event(state, "entity.price.changed", entity.id, { value: entity.price });
      return { ok: true };
    }
    case "setTicketPrice":
      state.park.ticketPrice = clamp(Number(action.value), 0, 60);
      event(state, "park.ticket.changed", state.park.id, { value: state.park.ticketPrice });
      recomputeMetrics(state);
      return { ok: true };
    case "togglePark":
      state.park.open = !state.park.open;
      event(state, state.park.open ? "park.opened" : "park.closed", state.park.id);
      return { ok: true };
    case "staff": {
      if (!Object.hasOwn(state.staff, action.role)) return { ok: false, reason: "Unknown staff role." };
      const next = clamp(state.staff[action.role] + Number(action.delta), 0, 12);
      if (next > state.staff[action.role] && state.economy.cash < 75) return { ok: false, reason: "Hiring deposit requires €75." };
      if (next > state.staff[action.role]) charge(state, 75, `Hire ${action.role}`);
      state.staff[action.role] = next;
      syncStaffRoster(state);
      event(state, "staff.changed", action.role, { count: next });
      return { ok: true };
    }
    case "marketing":
      state.park.marketing = action.campaign;
      event(state, "marketing.changed", state.park.id, { campaign: action.campaign });
      recomputeMetrics(state);
      return { ok: true };
    case "renamePark":
      state.park.name = String(action.name || "Moonroot Park").slice(0, 40);
      return { ok: true };
    case "collectStamp": {
      const stamp = state.adventure?.stamps?.find((item) => item.id === action.stampId);
      if (!stamp) return { ok: false, reason: "That discovery does not exist in this park." };
      if (stamp.found) return { ok: false, reason: "That discovery is already in your trail book." };
      stamp.found = true;
      earn(state, 75, `Discovery: ${stamp.label}`);
      state.park.reputation = clamp(state.park.reputation + 0.8, 0, 100);
      event(state, "adventure.stamp.collected", stamp.id, { label: stamp.label, playerChoice: true });
      const progress = adventureProgress(state.adventure);
      if (progress.completed && !state.adventure.completed) {
        state.adventure.completed = true;
        earn(state, 500, "Living Globe Discovery Trail completed");
        state.park.reputation = clamp(state.park.reputation + 3, 0, 100);
        notice(state, "Discovery Trail complete: the Living Globe remembers your walk.", "story");
        event(state, "adventure.trail.completed", state.park.id, { reward: 500 });
      } else {
        notice(state, `${stamp.label} found · ${progress.found}/${progress.total} trail stamps.`, "good");
      }
      recomputeMetrics(state);
      return { ok: true, progress };
    }
    case "inspect": {
      const observation = {
        tick: state.tick,
        stateHash: state.stateHash,
        subjectId: action.entityId ?? state.park.id,
        note: action.note ?? "Player inspected the live park."
      };
      state.park.inspections.push(observation);
      if (state.park.inspections.length > 50) state.park.inspections.shift();
      event(state, "inspection.recorded", observation.subjectId, observation);
      return { ok: true, observation };
    }
    case "startNextDay": {
      const report = state.operations?.dayReport;
      if (!report) return { ok: false, reason: "Finish the current operating day first." };
      state.visitors = [];
      for (const entity of state.world.entities) {
        entity.queue = [];
        entity.riders = [];
        entity.cycleRemaining = 0;
        entity.queueWaitMinutes = 0;
        entity.todayRevenue = 0;
      }
      state.clock.day = Math.max(state.clock.day + 1, report.day + 1);
      state.clock.minute = PARK_OPEN_MINUTE;
      state.park.open = true;
      state.economy.todayIncome = 0;
      state.economy.todayCosts = 0;
      state.economy.todayVisitors = 0;
      state.operations.todayCleanups = 0;
      state.operations.todayRepairs = 0;
      state.operations.todayBenchRests = 0;
      state.operations.dayReport = null;
      resetStaffForDay(state);
      updateEnvironment(state);
      refreshConnections(state);
      recomputeMetrics(state);
      event(state, "clock.next-operating-day", "clock", { day: state.clock.day });
      notice(state, `Day ${state.clock.day}: the gates are open.`, "story");
      return { ok: true };
    }
    case "selectEnding": {
      if (!state.campaign.availableEndings.some((ending) => ending.id === action.endingId)) {
        return { ok: false, reason: "That future is not supported by the current evidence." };
      }
      state.park.selectedEnding = action.endingId;
      state.campaign.completed = true;
      event(state, "campaign.ending.selected", action.endingId, { playerChoice: true });
      return { ok: true };
    }
    default:
      return { ok: false, reason: `Unknown action: ${action.type}` };
  }
}

function attractionAtmosphere(state, entity) {
  const definition = catalogDefinition(entity.catalogId);
  if (definition.kind !== "ride") return 0;
  const centerX = entity.x + rotatedFootprint(definition, entity.rotation)[0] / 2;
  const centerZ = entity.z + rotatedFootprint(definition, entity.rotation)[1] / 2;
  const quadrants = new Set();
  const influences = new Set();
  let coherence = 0;
  let contradiction = 0;
  for (const scenery of state.world.entities.filter((item) => item.kind === "scenery")) {
    const sceneryDef = catalogDefinition(scenery.catalogId);
    const dx = scenery.x - centerX;
    const dz = scenery.z - centerZ;
    const distance = Math.hypot(dx, dz);
    if (distance > 7) continue;
    quadrants.add(`${dx >= 0 ? 1 : -1},${dz >= 0 ? 1 : -1}`);
    influences.add(sceneryDef.influence);
    if (sceneryDef.theme === definition.theme || sceneryDef.theme === "neutral" || sceneryDef.theme === "nature") coherence += 1 / (1 + distance * 0.3);
    else contradiction += 0.08;
  }
  const coverage = quadrants.size / 4;
  const sensoryRange = Math.min(1, influences.size / 3);
  return clamp(0.18 + coverage * 0.34 + sensoryRange * 0.22 + Math.min(0.28, coherence * 0.06) - contradiction);
}

function contextualRideScore(state, visitor, entity) {
  const definition = catalogDefinition(entity.catalogId);
  const fit = visitor.segment === "family" ? definition.familyFit
    : visitor.segment === "thrill" ? definition.thrillFit
      : visitor.segment === "explorer" ? definition.explorerFit
        : (definition.familyFit + definition.explorerFit) / 2;
  const experienced = visitor.visited.includes(entity.id);
  const experience = experienced ? definition.repeatValue : definition.firstValue;
  const atmosphere = attractionAtmosphere(state, entity);
  const priceFit = clamp(1 - entity.price / Math.max(1, visitor.budget));
  const queueFit = clamp(1 - estimateQueueWait(entity) / Math.max(12, visitor.patience ?? 45));
  const condition = entity.condition / 100;
  const evolution = entity.evolutionLevel * 0.035;
  const weather = definition.id === "splash"
    ? (state.weather.temperature > 20 ? 0.12 : state.weather.precipitation > 0 ? -0.15 : 0)
    : 0;
  return fit * 0.28 + experience * 0.24 + atmosphere * 0.13 + priceFit * 0.1
    + queueFit * 0.12 + condition * 0.1 + evolution + weather;
}

function chooseTarget(state, visitor) {
  const candidates = state.world.entities.filter((entity) => entity.open && entity.accessCell);
  const urgentNeed = visitor.toilet > 0.78 ? "toilet" : visitor.thirst > 0.76 ? "thirst" : visitor.hunger > 0.72 ? "hunger" : null;
  const services = urgentNeed
    ? candidates.filter((entity) => catalogDefinition(entity.catalogId).need === urgentNeed)
    : [];
  const restStops = visitor.energy < 0.58
    ? candidates.filter((entity) => isRestFacility(catalogDefinition(entity.catalogId)))
    : [];
  const pool = services.length ? services : restStops.length ? restStops : candidates.filter((entity) => entity.kind === "ride");
  let best = null;
  let bestScore = -Infinity;
  for (const entity of pool) {
    const definition = catalogDefinition(entity.catalogId);
    if (entity.price > visitor.budget) continue;
    if ((entity.queue?.length ?? 0) >= (entity.queueCapacity ?? Math.max(2, (definition.capacity ?? 1) * 2))) continue;
    let score = entity.kind === "ride" ? contextualRideScore(state, visitor, entity)
      : isRestFacility(definition) ? 1.05 + (1 - visitor.energy) * 0.5 : 1.2;
    const distance = Math.abs(visitor.cell[0] - entity.accessCell[0]) + Math.abs(visitor.cell[1] - entity.accessCell[1]);
    score -= distance * 0.012;
    score += visitor.preferences[definition.id] ?? 0;
    if (score > bestScore) {
      best = entity;
      bestScore = score;
    }
  }
  return bestScore > 0.32 ? best : null;
}

function routeVisitor(state, visitor, targetCell, nextState = "walking") {
  const route = findPath(pathSet(state), visitor.cell, [targetCell], state.world.size);
  if (!route.length) return false;
  visitor.route = route;
  visitor.routeIndex = 0;
  visitor.routeProgress = 0;
  visitor.state = nextState;
  return true;
}

function createVisitor(state) {
  const segment = pick(state, SEGMENTS);
  const originWeights = state.park.marketing === "tourist-discovery"
    ? ["regional", "tourist", "tourist"]
    : state.park.marketing === "thrill-seekers"
      ? ["regional", "regional", "tourist"]
      : ORIGINS;
  const origin = pick(state, originWeights);
  const visitor = {
    id: `visitor-${state.nextVisitorId++}`,
    segment,
    origin,
    budget: randomInt(state, 18, 55),
    happiness: randomInt(state, 68, 82),
    hunger: nextRandom(state) * 0.35,
    thirst: nextRandom(state) * 0.3,
    toilet: nextRandom(state) * 0.22,
    energy: 1,
    state: "idle",
    cell: [...state.world.entrance],
    route: [],
    routeIndex: 0,
    routeProgress: 0,
    targetId: null,
    activityRemaining: 0,
    patience: randomInt(state, 28, 72),
    queueJoinedTick: null,
    lastThought: "I wonder what this little park will become.",
    visited: [],
    stayRemaining: randomInt(state, 170, 330),
    preferences: {
      carousel: (nextRandom(state) - 0.5) * 0.2,
      wheel: (nextRandom(state) - 0.5) * 0.2,
      coaster: (nextRandom(state) - 0.5) * 0.2,
      splash: (nextRandom(state) - 0.5) * 0.2,
      haunted: (nextRandom(state) - 0.5) * 0.2,
      spinner: (nextRandom(state) - 0.5) * 0.2
    }
  };
  state.visitors.push(visitor);
  state.park.lifetimeVisitors += 1;
  state.economy.todayVisitors = (state.economy.todayVisitors ?? 0) + 1;
  earn(state, state.park.ticketPrice, "Admission", null);
  event(state, "visitor.entered", visitor.id, { segment, origin, ticketPrice: state.park.ticketPrice });
  return visitor;
}

function finishVisitorActivity(state, visitor, entity) {
  const definition = catalogDefinition(entity.catalogId);
  visitor.cell = entity.accessCell ? [...entity.accessCell] : visitor.cell;
  visitor.state = "idle";
  visitor.targetId = null;
  visitor.activityRemaining = 0;
  visitor.queueJoinedTick = null;
  if (definition.kind === "ride") {
    if (!visitor.visited.includes(entity.id)) visitor.visited.push(entity.id);
    visitor.happiness = clamp(visitor.happiness + (definition.firstValue * 8 + definition.repeatValue * 4) - entity.price * 0.25, 0, 100);
    visitor.energy = clamp(visitor.energy - definition.intensity * 0.08);
    visitor.lastThought = `That ${definition.label} was worth the wait.`;
  } else if (definition.need === "hunger") {
    visitor.hunger = 0.05;
    visitor.happiness = clamp(visitor.happiness + 2, 0, 100);
    addLitterPile(state, visitor.cell, 0.7);
    visitor.lastThought = "Much better. Now, what should I ride?";
  } else if (definition.need === "thirst") {
    visitor.thirst = 0.04;
    visitor.happiness = clamp(visitor.happiness + 1, 0, 100);
    addLitterPile(state, visitor.cell, 0.35);
    visitor.lastThought = "That fixed my thirst.";
  } else if (definition.need === "toilet") {
    visitor.toilet = 0.03;
    visitor.happiness = clamp(visitor.happiness + 2, 0, 100);
    visitor.lastThought = "Good—the essentials are covered.";
  } else if (definition.need === "rest") {
    visitor.energy = clamp(visitor.energy + 0.56);
    visitor.happiness = clamp(visitor.happiness + 2.5, 0, 100);
    visitor.lastThought = "That little rest helped. I am ready to explore again.";
    state.operations.todayBenchRests = (state.operations.todayBenchRests ?? 0) + 1;
    event(state, "visitor.bench.rested", visitor.id, { entityId: entity.id, energy: visitor.energy });
  }
}

function processEntity(state, entity) {
  const definition = catalogDefinition(entity.catalogId);
  entity.queueWaitMinutes = estimateQueueWait(entity);
  if (!entity.open || !entity.accessCell || !handlesVisitors(definition)) return;
  if (entity.cycleRemaining > 0) {
    entity.cycleRemaining -= 1;
    if (entity.cycleRemaining <= 0) {
      for (const visitorId of entity.riders) {
        const visitor = state.visitors.find((item) => item.id === visitorId);
        if (visitor) finishVisitorActivity(state, visitor, entity);
      }
      entity.riders = [];
      if (definition.kind === "ride") {
        entity.cycles += 1;
        entity.condition = Math.max(0, entity.condition - definition.conditionLoss * Math.max(1, definition.intensity * 1.4));
        event(state, "ride.cycle.completed", entity.id, { cycle: entity.cycles, condition: entity.condition });
      }
    }
    return;
  }
  if (!entity.queue.length) return;
  const capacity = definition.capacity ?? 1;
  entity.riders = entity.queue.splice(0, capacity);
  entity.cycleRemaining = definition.kind === "ride" ? definition.cycleMinutes : definition.serviceMinutes;
  for (const visitorId of entity.riders) {
    const visitor = state.visitors.find((item) => item.id === visitorId);
    if (!visitor) continue;
    visitor.state = definition.kind === "ride" ? "riding"
      : isRestFacility(definition) ? "resting" : "usingService";
    visitor.activityRemaining = entity.cycleRemaining;
    const spend = Math.min(visitor.budget, entity.price);
    visitor.budget = roundMoney(visitor.budget - spend);
    if (spend > 0) earn(state, spend, definition.kind === "ride" ? "Ride ticket" : "Service sale", entity);
  }
}

function updateWalkingVisitor(state, visitor) {
  visitor.routeProgress += 0.34 + visitor.energy * 0.08;
  if (visitor.routeProgress < 1) return;
  visitor.routeProgress -= 1;
  visitor.routeIndex += 1;
  if (visitor.routeIndex < visitor.route.length) visitor.cell = [...visitor.route[visitor.routeIndex]];
  if (visitor.routeIndex < visitor.route.length - 1) return;

  if (visitor.state === "leaving") {
    visitor.state = "departed";
    return;
  }
  const target = state.world.entities.find((entity) => entity.id === visitor.targetId);
  if (!target || !target.open || !target.accessCell) {
    visitor.state = "idle";
    visitor.targetId = null;
    return;
  }
  target.queue.push(visitor.id);
  visitor.state = "queueing";
  visitor.activityRemaining = 0;
  visitor.queueJoinedTick = state.tick;
  visitor.lastThought = `Queued for ${catalogDefinition(target.catalogId).label}.`;
}

function updateVisitor(state, visitor) {
  visitor.stayRemaining -= 1;
  visitor.hunger = clamp(visitor.hunger + 0.0027);
  visitor.thirst = clamp(visitor.thirst + 0.0035 + Math.max(0, state.weather.temperature - 20) * 0.00025);
  visitor.toilet = clamp(visitor.toilet + 0.0022);
  visitor.energy = clamp(visitor.energy - 0.0008);
  if (state.park.cleanliness < 55) visitor.happiness = clamp(visitor.happiness - 0.025, 0, 100);
  if (visitor.state === "walking" || visitor.state === "leaving") {
    updateWalkingVisitor(state, visitor);
    return;
  }
  if (visitor.state === "queueing") {
    visitor.activityRemaining += 1;
    if (visitor.activityRemaining > 45) visitor.happiness = clamp(visitor.happiness - 0.04, 0, 100);
    if (visitor.activityRemaining > (visitor.patience ?? 45)) {
      const target = state.world.entities.find((entity) => entity.id === visitor.targetId);
      visitor.state = "idle";
      visitor.targetId = null;
      visitor.queueJoinedTick = null;
      visitor.activityRemaining = 0;
      visitor.happiness = clamp(visitor.happiness - 4, 0, 100);
      visitor.lastThought = target
        ? `The queue for ${catalogDefinition(target.catalogId).label} was too long.`
        : "That queue was taking too long.";
      event(state, "visitor.queue.abandoned", visitor.id, { entityId: target?.id ?? null });
    }
    return;
  }
  if (visitor.state === "riding" || visitor.state === "usingService" || visitor.state === "resting") return;
  if (visitor.stayRemaining <= 0 || visitor.happiness < 20 || !state.park.open) {
    routeVisitor(state, visitor, state.world.entrance, "leaving");
    return;
  }
  const target = chooseTarget(state, visitor);
  if (target && routeVisitor(state, visitor, target.accessCell)) {
    visitor.targetId = target.id;
    return;
  }
  const reachable = [...reachablePathKeys(pathSet(state), state.world.entrance, state.world.size)];
  if (reachable.length) {
    const wanderKey = reachable[randomInt(state, 0, reachable.length - 1)];
    const [x, z] = wanderKey.split(",").map(Number);
    routeVisitor(state, visitor, [x, z]);
  }
}

function hourlyOperations(state) {
  if (!state.park.open || state.clock.minute < PARK_OPEN_MINUTE || state.clock.minute >= PARK_CLOSE_MINUTE) return;
  let total = 0;
  for (const entity of state.world.entities) {
    const definition = catalogDefinition(entity.catalogId);
    if (!entity.open || !definition.operatingCost) continue;
    total += definition.operatingCost;
    entity.operatingSpend = roundMoney(entity.operatingSpend + definition.operatingCost);
  }
  total += state.staff.cleaners * 18 + state.staff.mechanics * 24;
  total += state.park.marketing === "none" ? 0 : 16;
  if (total > 0) charge(state, total, "Hourly operations and staff");

}

function updateEnvironment(state) {
  const roll = nextRandom(state);
  const previous = state.weather.type;
  if (roll < 0.18) state.weather = { type: "rain", temperature: randomInt(state, 11, 17), wind: 0.52, precipitation: 0.72 };
  else if (roll < 0.48) state.weather = { type: "cloudy", temperature: randomInt(state, 13, 20), wind: 0.32, precipitation: 0 };
  else state.weather = { type: "bright", temperature: randomInt(state, 17, 25), wind: 0.18, precipitation: 0 };
  if (previous !== state.weather.type) {
    notice(state, `Weather changed: ${state.weather.type}, ${state.weather.temperature}°C.`, "weather");
    event(state, "environment.changed", "weather", structuredClone(state.weather));
  }
}

function spawnDemand(state) {
  if (!state.park.open || state.clock.minute < PARK_OPEN_MINUTE || state.clock.minute >= PARK_CLOSE_MINUTE) return;
  if (state.visitors.length >= 90) return;
  const demand = state.metrics.reachableDemand;
  const timeFactor = state.clock.minute < 11 * 60 ? 1.25 : state.clock.minute > 19 * 60 ? 0.45 : 1;
  if (nextRandom(state) < demand * 0.115 * timeFactor) createVisitor(state);
  if (demand > 0.72 && nextRandom(state) < 0.035 * timeFactor) createVisitor(state);
}

export function recomputeMetrics(state) {
  const rides = state.world.entities.filter((entity) => entity.kind === "ride");
  const services = state.world.entities.filter((entity) => entity.kind === "service");
  const uniqueRides = new Set(rides.map((entity) => entity.catalogId)).size;
  const averageHappiness = state.visitors.length
    ? state.visitors.reduce((total, visitor) => total + visitor.happiness, 0) / state.visitors.length
    : state.metrics.averageHappiness;
  const family = rides.length ? rides.reduce((sum, entity) => sum + catalogDefinition(entity.catalogId).familyFit, 0) / rides.length : 0;
  const thrill = rides.length ? rides.reduce((sum, entity) => sum + catalogDefinition(entity.catalogId).thrillFit, 0) / rides.length : 0;
  const explorer = rides.length ? rides.reduce((sum, entity) => sum + catalogDefinition(entity.catalogId).explorerFit, 0) / rides.length : 0;
  const atmosphere = rides.length ? rides.reduce((sum, entity) => sum + attractionAtmosphere(state, entity), 0) / rides.length : 0.2;
  const reliableRideShare = rides.length ? rides.filter((entity) => entity.condition >= 60 && entity.open).length / rides.length : 0;
  const needs = new Set(services.filter((entity) => entity.accessCell).map((entity) => catalogDefinition(entity.catalogId).need));
  const serviceCoverage = needs.size / 3;
  const cleanliness = clamp(1 - state.park.litter / 45);
  state.park.cleanliness = Math.round(cleanliness * 100);

  const marketingFit = state.park.marketing === "none" ? 0.45
    : state.park.marketing === "thrill-seekers" ? thrill
      : state.park.marketing === "tourist-discovery" ? explorer
        : family;
  const priceFit = clamp(1 - Math.max(0, state.park.ticketPrice - (8 + uniqueRides * 4)) / 30);
  const weatherFit = state.weather.type === "rain" ? 0.7 : 1;
  const variety = clamp(uniqueRides / 5);
  const reachableDemand = clamp(
    0.08 + variety * 0.22 + state.park.reputation / 100 * 0.22 + marketingFit * 0.2
    + priceFit * 0.18 + serviceCoverage * 0.08 + atmosphere * 0.1
  ) * weatherFit;
  const rating = Math.round(clamp(
    averageHappiness / 100 * 0.26 + cleanliness * 0.16 + variety * 0.18
    + serviceCoverage * 0.12 + atmosphere * 0.13 + reliableRideShare * 0.15
  ) * 100);

  Object.assign(state.metrics, {
    averageHappiness: Math.round(averageHappiness),
    reachableDemand,
    familyAlignment: family,
    thrillAlignment: thrill,
    explorerAlignment: explorer,
    serviceCoverage,
    atmosphere,
    reliableRideShare,
    activeAttendance: state.visitors.length
  });
  state.park.rating = rating;
  updateProgression(state);

  state.campaign.objectives[0].complete = state.park.cleanliness >= 75 && rides.every((entity) => entity.condition >= 75);
  state.campaign.objectives[1].complete = state.park.lifetimeVisitors >= 80;
  state.campaign.objectives[2].complete = uniqueRides >= 3 && state.park.rating >= 70;
  if (state.campaign.objectives.every((objective) => objective.complete) && !state.campaign.availableEndings.length) {
    const endings = [];
    if (family >= 0.7 && serviceCoverage >= 0.66) endings.push({ id: "family-haven", label: "The Neighbourhood Haven", reason: "Strong family fit, care, and essential services." });
    if (thrill >= 0.64 && uniqueRides >= 3) endings.push({ id: "thrill-landmark", label: "The Local Thrill Landmark", reason: "A clear thrill identity supported by varied attractions." });
    if (explorer >= 0.68 && atmosphere >= 0.55) endings.push({ id: "living-adventure", label: "The Living Adventure Park", reason: "Discovery and atmosphere have become the park's strength." });
    endings.push({ id: "balanced-future", label: "The Balanced Local Future", reason: "A viable mixed park that preserved its roots while growing." });
    state.campaign.availableEndings = endings;
    notice(state, "Your park now supports more than one valid future. The choice remains yours.", "story");
    event(state, "campaign.endings.available", state.campaign.id, { endings: endings.map((ending) => ending.id) });
  }
}

function closeOperatingDay(state) {
  state.operations ??= { dayReport: null, lastReportDay: 0 };
  if (state.operations.lastReportDay === state.clock.day) return;
  const rides = state.world.entities.filter((entity) => entity.kind === "ride");
  const topRideCandidate = rides.slice().sort((a, b) => (b.todayRevenue ?? 0) - (a.todayRevenue ?? 0))[0] ?? null;
  const topRide = (topRideCandidate?.todayRevenue ?? 0) > 0 ? topRideCandidate : null;
  state.operations.dayReport = {
    day: state.clock.day,
    visitors: state.economy.todayVisitors ?? 0,
    income: roundMoney(state.economy.todayIncome),
    costs: roundMoney(state.economy.todayCosts),
    profit: roundMoney(state.economy.todayIncome - state.economy.todayCosts),
    rating: state.park.rating,
    cleanliness: state.park.cleanliness,
    topRideId: topRide?.id ?? null,
    topRideLabel: topRide ? catalogDefinition(topRide.catalogId).label : "No ride operated",
    topRideRevenue: roundMoney(topRide?.todayRevenue ?? 0),
    cleanups: state.operations.todayCleanups ?? 0,
    repairs: state.operations.todayRepairs ?? 0,
    benchRests: state.operations.todayBenchRests ?? 0
  };
  state.operations.lastReportDay = state.clock.day;
  event(state, "operations.day.closed", state.park.id, structuredClone(state.operations.dayReport));
}

export function advanceOneMinute(state) {
  state.tick += 1;
  state.clock.minute += 1;
  if (state.clock.minute >= 24 * 60) {
    state.clock.minute = 0;
    state.clock.day += 1;
    state.economy.todayIncome = 0;
    state.economy.todayCosts = 0;
    event(state, "clock.day.started", "clock", { day: state.clock.day });
  }
  if (state.clock.minute === PARK_OPEN_MINUTE && !state.park.open) {
    notice(state, "It is opening time. The park remains closed until you open it.", "info");
  }
  if (state.clock.minute === PARK_CLOSE_MINUTE) {
    const wasOpen = state.park.open;
    state.park.open = false;
    closeOperatingDay(state);
    notice(state, wasOpen
      ? "Closing time. Remaining guests are heading home."
      : "The operating day is complete. Review the report when ready.", "info");
    event(state, "park.closed", state.park.id, { scheduled: true, wasOpen });
  }
  if (state.clock.minute % 180 === 0) updateEnvironment(state);
  if (state.clock.minute % 60 === 0) hourlyOperations(state);

  spawnDemand(state);
  for (const entity of state.world.entities) processEntity(state, entity);
  for (const visitor of [...state.visitors]) updateVisitor(state, visitor);
  advanceStaffAgents(state, { charge, event, notice });
  for (const entity of state.world.entities) {
    entity.queue = entity.queue.filter((id) => state.visitors.some((visitor) => visitor.id === id && visitor.state === "queueing"));
    entity.riders = entity.riders.filter((id) => state.visitors.some((visitor) => visitor.id === id));
    if (entity.kind === "ride" && entity.condition < 18 && entity.open) {
      entity.open = false;
      notice(state, `${catalogDefinition(entity.catalogId).label} closed for evidenced safety care. It was not demolished.`, "warning");
      event(state, "entity.safety-closed", entity.id, { condition: entity.condition });
    }
  }
  state.visitors = state.visitors.filter((visitor) => visitor.state !== "departed");
  if (state.weather.type === "rain") washLitter(state, 0.015);
  if (state.tick % 5 === 0) {
    recomputeMetrics(state);
    state.park.reputation = clamp(state.park.reputation + (state.metrics.averageHappiness - state.park.reputation) * 0.003, 0, 100);
  }
  if (state.tick % 10 === 0) state.stateHash = stateHash(state);
  return state;
}

export function simulateMinutes(state, minutes) {
  for (let index = 0; index < minutes; index += 1) advanceOneMinute(state);
  state.stateHash = stateHash(state);
  return state;
}

export function formatClock(clock) {
  const hours = Math.floor(clock.minute / 60).toString().padStart(2, "0");
  const minutes = (clock.minute % 60).toString().padStart(2, "0");
  return `Day ${clock.day} · ${hours}:${minutes}`;
}

export function getEntityDiagnosis(state, entityId) {
  const entity = state.world.entities.find((item) => item.id === entityId);
  if (!entity) return null;
  const definition = catalogDefinition(entity.catalogId);
  const ageDays = Math.max(0, Math.floor((state.tick - entity.builtTick) / (24 * 60)));
  if (definition.kind !== "ride") {
    return {
      entity,
      definition,
      headline: entity.accessCell ? "Connected to the live park" : "Not connected to the entrance",
      causes: [definition.description]
    };
  }
  const sample = {
    cell: entity.accessCell ?? state.world.entrance,
    budget: 40,
    visited: [],
    preferences: {},
    segment: "family"
  };
  const segmentScores = Object.fromEntries(SEGMENTS.map((segment) => {
    sample.segment = segment;
    return [segment, Math.round(contextualRideScore(state, sample, entity) * 100)];
  }));
  const atmosphere = attractionAtmosphere(state, entity);
  const net = entity.revenue - entity.operatingSpend;
  return {
    entity,
    definition,
    ageDays,
    headline: entity.condition < 40 ? "Needs care, not automatic replacement"
      : entity.accessCell ? "Operating with contextual demand" : "Disconnected from reachable paths",
    segmentScores,
    atmosphere,
    netContribution: net,
    causes: [
      `Condition ${Math.round(entity.condition)}% from cycles and care—not age punishment.`,
      `Queue ${entity.queue.length}/${entity.queueCapacity ?? definition.capacity * 2}; estimated wait ${estimateQueueWait(entity)} minutes.`,
      `Atmosphere ${Math.round(atmosphere * 100)}% from coverage, coherence, and different kinds of support.`,
      `First experience ${Math.round(definition.firstValue * 100)}%; repeat strength ${Math.round(definition.repeatValue * 100)}%.`,
      `Direct net contribution €${net.toFixed(0)}; identity and visit-duration value are reported separately.`
    ],
    options: ["Maintain", "Evolve", "Replace deliberately"]
  };
}

export function getVisitorInsight(state, visitorId) {
  const visitor = state.visitors.find((item) => item.id === visitorId);
  if (!visitor) return null;
  const target = state.world.entities.find((entity) => entity.id === visitor.targetId) ?? null;
  let thought = visitor.lastThought ?? "Taking in the park.";
  if (visitor.state === "queueing" && target) {
    const position = Math.max(0, target.queue.indexOf(visitor.id)) + 1;
    thought = `Position ${position} for ${catalogDefinition(target.catalogId).label}; about ${estimateQueueWait(target)} minutes.`;
  } else if (visitor.state === "resting" && target) thought = `Resting at ${catalogDefinition(target.catalogId).label}.`;
  else if (visitor.toilet > 0.78) thought = "I need a comfort cabin soon.";
  else if (visitor.thirst > 0.76) thought = "A drink would keep this visit going.";
  else if (visitor.hunger > 0.72) thought = "I am ready for a snack.";
  else if (visitor.energy < 0.58) thought = "A bench would help before the next ride.";
  else if (visitor.happiness < 45) thought = "This visit is not quite working for me yet.";
  const stateLabels = {
    idle: "Choosing what to do",
    walking: "Walking through the park",
    queueing: "Waiting in a queue",
    riding: "On a ride",
    usingService: "Using a service",
    resting: "Resting on a bench",
    leaving: "Heading home"
  };
  return {
    visitor,
    target,
    thought,
    activity: stateLabels[visitor.state] ?? visitor.state,
    needs: {
      happiness: Math.round(visitor.happiness),
      hunger: Math.round(visitor.hunger * 100),
      thirst: Math.round(visitor.thirst * 100),
      toilet: Math.round(visitor.toilet * 100),
      energy: Math.round(visitor.energy * 100)
    }
  };
}

export function getStaffInsight(state, staffId) {
  return staffInsight(state, staffId);
}

export function getParkGuidance(state) {
  const cards = [];
  if (state.park.cleanliness < 70) cards.push({ tone: "warning", title: "Paths are losing comfort", body: "Food use is creating litter faster than the current cleaners can remove it. Hire a cleaner or improve service placement." });
  if (state.metrics.serviceCoverage < 0.67) cards.push({ tone: "info", title: "Visits end earlier than necessary", body: "At least one essential need—food, drink, or toilets—has no reachable service. This affects stay length, not a magic service score." });
  if (state.metrics.reliableRideShare < 0.75) cards.push({ tone: "warning", title: "Mechanical care is stretched", body: "Some rides are closed or below reliable condition. Maintenance preserves their history; demolition is not required." });
  if (state.metrics.atmosphere < 0.48) cards.push({ tone: "info", title: "The rides work, but their surroundings feel thin", body: "Use varied, coherent support around paths and queues. Repeating one object does not create atmosphere." });
  if (state.economy.cash < 1200) cards.push({ tone: "warning", title: "Cash buffer is narrow", body: "Pause expansion and let existing attractions contribute before taking on more operating cost." });
  if (!cards.length) cards.push({ tone: "good", title: "The park has a stable base", body: "No forced churn is needed. Choose growth that matches the future you want for this place." });
  return cards.slice(0, 3);
}
