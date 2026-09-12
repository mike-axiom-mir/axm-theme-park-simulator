import { appendRetainedEvent } from "./eventStream.js";
import { catalogDefinition } from "./catalog.js";

export const RESEARCH_SCHEMA = "axm.themepark.research/v1";
export const RESEARCH_INSIGHT_UNIT = 8;
export const ENTITY_GROWTH_TRACK_MAX = 2;
export const ENTITY_GROWTH_TOTAL_CAP = 4;
export const PARK_GROWTH_TRACK_MAX = 3;
export const PARK_GROWTH_TOTAL_CAP = 6;

export const RESEARCH_CHANNELS = Object.freeze({
  rides: Object.freeze({ label: "Ridecraft", icon: "⌁" }),
  services: Object.freeze({ label: "Guest services", icon: "▤" }),
  commerce: Object.freeze({ label: "Commerce", icon: "◇" }),
  operations: Object.freeze({ label: "Operations", icon: "⚙" }),
  guests: Object.freeze({ label: "Guest insight", icon: "☺" }),
  park: Object.freeze({ label: "Park learning", icon: "◉" })
});

const project = (data) => Object.freeze({ prerequisites: [], requires: {}, ...data });

export const RESEARCH_PROJECTS = Object.freeze({
  "ride-throughput": project({
    id: "ride-throughput", branch: "Ridecraft", label: "Platform Rhythm", cost: 3,
    requires: { rides: 12 },
    summary: "Study loading, dispatch and reset rhythm without changing the ride's identity.",
    unlock: "Ride/attraction Throughput growth"
  }),
  "ride-reliability": project({
    id: "ride-reliability", branch: "Ridecraft", label: "Gentle Machinery", cost: 4,
    prerequisites: ["ride-throughput"], requires: { rides: 20, operations: 8 },
    summary: "Learn where wear actually happens and reinforce the parts that earn the work.",
    unlock: "Ride/attraction Reliability growth"
  }),
  "ride-experience": project({
    id: "ride-experience", branch: "Ridecraft", label: "Experience Craft", cost: 5,
    prerequisites: ["ride-throughput"], requires: { rides: 24, guests: 24 },
    summary: "Use repeat-ride and guest evidence to improve the experience instead of only adding spectacle.",
    unlock: "Ride/attraction Experience growth"
  }),
  "service-throughput": project({
    id: "service-throughput", branch: "Servicecraft", label: "Service Flow", cost: 3,
    requires: { services: 10 },
    summary: "Reduce dead time at counters and facilities while keeping service simple.",
    unlock: "Active service/store Throughput growth"
  }),
  "service-efficiency": project({
    id: "service-efficiency", branch: "Servicecraft", label: "Waste & Energy Sense", cost: 4,
    prerequisites: ["service-throughput"], requires: { services: 16, operations: 6 },
    summary: "Find recurring operating waste and remove it without cutting the guest-facing function.",
    unlock: "Active service/store Efficiency growth"
  }),
  "service-quality": project({
    id: "service-quality", branch: "Servicecraft", label: "Little Details", cost: 5,
    prerequisites: ["service-throughput"], requires: { services: 20, guests: 24 },
    summary: "Turn ordinary service encounters into small positive moments.",
    unlock: "Active service/store Quality growth"
  }),
  "retail-appeal": project({
    id: "retail-appeal", branch: "Park life", label: "Retail Storycraft", cost: 4,
    requires: { commerce: 10, guests: 16 },
    summary: "Make shops and keepsakes part of the park identity without inventing a shopping chore.",
    unlock: "Passive store Appeal growth"
  }),
  "care-network": project({
    id: "care-network", branch: "Park life", label: "Care Network", cost: 4,
    requires: { services: 12, park: 10 },
    summary: "Treat practical support as a visible park capability rather than background furniture.",
    unlock: "Passive support-facility Care growth"
  }),
  "park-wayfinding": project({
    id: "park-wayfinding", branch: "Parkcraft", label: "Clear Wayfinding", cost: 4,
    requires: { guests: 20, park: 10 },
    summary: "Study where people hesitate and make the whole park easier to understand.",
    unlock: "Park Hospitality growth"
  }),
  "park-operations": project({
    id: "park-operations", branch: "Parkcraft", label: "Operations Desk", cost: 5,
    requires: { operations: 14, park: 12 },
    summary: "Turn maintenance, staffing and operating evidence into a calmer park-wide rhythm.",
    unlock: "Park Operations growth"
  }),
  "park-identity": project({
    id: "park-identity", branch: "Parkcraft", label: "Living Park Identity", cost: 6,
    prerequisites: ["park-wayfinding"], requires: { park: 24, rides: 16, services: 10 },
    summary: "Learn what makes this particular park worth returning to instead of chasing generic scale.",
    unlock: "Park Identity growth"
  }),
  "learning-culture": project({
    id: "learning-culture", branch: "Research", label: "Learning Culture", cost: 6,
    requires: { rides: 12, services: 10, operations: 8, guests: 20, park: 12 },
    summary: "Turn ordinary operating evidence into insight more efficiently across the whole park.",
    unlock: "+25% future evidence-to-insight progress"
  })
});

export const GROWTH_TRACKS = Object.freeze({
  throughput: Object.freeze({ label: "Throughput", project: "ride-throughput", serviceProject: "service-throughput" }),
  reliability: Object.freeze({ label: "Reliability", project: "ride-reliability" }),
  experience: Object.freeze({ label: "Experience", project: "ride-experience" }),
  efficiency: Object.freeze({ label: "Efficiency", project: "service-efficiency" }),
  quality: Object.freeze({ label: "Quality", project: "service-quality" }),
  appeal: Object.freeze({ label: "Appeal", project: "retail-appeal" }),
  care: Object.freeze({ label: "Care", project: "care-network" })
});

export const PARK_GROWTH_TRACKS = Object.freeze({
  hospitality: Object.freeze({ label: "Hospitality", project: "park-wayfinding", effect: "+patience and visit time for new guests" }),
  operations: Object.freeze({ label: "Operations", project: "park-operations", effect: "lower hourly operating burden" }),
  identity: Object.freeze({ label: "Identity", project: "park-identity", effect: "stronger park draw and rating" })
});

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;

function appendEvent(state, type, subjectId, data = {}) {
  return appendRetainedEvent(state, {
    tick: state.tick ?? 0, type, subjectId, data
  });
}

function charge(state, amount, label) {
  const value = Math.max(0, Math.round(Number(amount) || 0));
  if ((state.economy?.cash ?? 0) < value) return false;
  state.economy.cash -= value;
  state.economy.todayCosts = (state.economy.todayCosts ?? 0) + value;
  state.economy.lifetimeCosts = (state.economy.lifetimeCosts ?? 0) + value;
  appendEvent(state, "economy.cost", "park", { amount: value, label });
  return true;
}

function emptyEvidence() {
  return Object.fromEntries(Object.keys(RESEARCH_CHANNELS).map((key) => [key, 0]));
}

export function normalizeEntityResearchGrowth(entity) {
  entity.researchGrowth ??= {};
  for (const track of Object.keys(GROWTH_TRACKS)) {
    entity.researchGrowth[track] = Math.max(0, Math.min(ENTITY_GROWTH_TRACK_MAX, integer(entity.researchGrowth[track])));
  }
  return entity.researchGrowth;
}

export function normalizeResearchState(state) {
  const existed = Boolean(state.research);
  const lastEventSequence = state.eventLog?.at(-1)?.sequence ?? 0;
  state.research ??= {};
  state.research.schema = RESEARCH_SCHEMA;
  state.research.insight = Math.max(0, integer(state.research.insight));
  state.research.lifetimeInsight = Math.max(state.research.insight, integer(state.research.lifetimeInsight));
  state.research.insightProgress = Math.max(0, Number(state.research.insightProgress) || 0);
  state.research.evidence = { ...emptyEvidence(), ...(state.research.evidence ?? {}) };
  for (const key of Object.keys(RESEARCH_CHANNELS)) state.research.evidence[key] = Math.max(0, integer(state.research.evidence[key]));
  state.research.completed = [...new Set((state.research.completed ?? []).filter((id) => RESEARCH_PROJECTS[id]))];
  state.research.lastEventSequence = existed
    ? Math.max(0, integer(state.research.lastEventSequence))
    : lastEventSequence;
  state.research.parkGrowth = {
    hospitality: 0, operations: 0, identity: 0,
    ...(state.research.parkGrowth ?? {})
  };
  for (const track of Object.keys(PARK_GROWTH_TRACKS)) {
    state.research.parkGrowth[track] = Math.max(0, Math.min(PARK_GROWTH_TRACK_MAX, integer(state.research.parkGrowth[track])));
  }
  for (const entity of state.world?.entities ?? []) normalizeEntityResearchGrowth(entity);
  return state;
}

export function hasResearch(state, projectId) {
  normalizeResearchState(state);
  return state.research.completed.includes(projectId);
}

export function researchEvidenceMet(state, project) {
  normalizeResearchState(state);
  return Object.entries(project.requires).every(([channel, amount]) => (state.research.evidence[channel] ?? 0) >= amount);
}

export function researchProjectView(state, projectId) {
  normalizeResearchState(state);
  const definition = RESEARCH_PROJECTS[projectId];
  if (!definition) return null;
  const completed = state.research.completed.includes(projectId);
  const prerequisitesMet = definition.prerequisites.every((id) => state.research.completed.includes(id));
  const evidenceMet = researchEvidenceMet(state, definition);
  const affordable = state.research.insight >= definition.cost;
  return Object.freeze({
    ...definition,
    completed,
    prerequisitesMet,
    evidenceMet,
    affordable,
    canComplete: !completed && prerequisitesMet && evidenceMet && affordable,
    evidence: Object.freeze(Object.fromEntries(Object.entries(definition.requires).map(([channel, required]) => [
      channel, Object.freeze({ current: state.research.evidence[channel] ?? 0, required })
    ])))
  });
}

export function getResearchView(state) {
  normalizeResearchState(state);
  return Object.freeze({
    schema: RESEARCH_SCHEMA,
    insight: state.research.insight,
    lifetimeInsight: state.research.lifetimeInsight,
    insightProgress: state.research.insightProgress,
    insightUnit: RESEARCH_INSIGHT_UNIT,
    evidence: Object.freeze({ ...state.research.evidence }),
    completed: Object.freeze([...state.research.completed]),
    projects: Object.freeze(Object.keys(RESEARCH_PROJECTS).map((id) => researchProjectView(state, id))),
    parkGrowth: Object.freeze({ ...state.research.parkGrowth })
  });
}

function entityGrowthFamily(definition) {
  if (definition.kind === "ride") return "ride";
  if (definition.kind === "service") return "service";
  if (definition.category === "Stores") return "retail";
  if (definition.category === "Services") return "care";
  return null;
}

export function growthTracksForEntity(state, entity) {
  normalizeResearchState(state);
  if (!entity) return [];
  const definition = catalogDefinition(entity.catalogId);
  const family = entityGrowthFamily(definition);
  const tracks = family === "ride" ? ["throughput", "reliability", "experience"]
    : family === "service" ? ["throughput", "efficiency", "quality"]
      : family === "retail" ? ["appeal"]
        : family === "care" ? ["care"] : [];
  return tracks.map((id) => {
    const level = normalizeEntityResearchGrowth(entity)[id];
    const projectId = id === "throughput" && family === "service"
      ? GROWTH_TRACKS[id].serviceProject : GROWTH_TRACKS[id].project;
    const unlocked = hasResearch(state, projectId);
    return Object.freeze({ id, label: GROWTH_TRACKS[id].label, level, max: ENTITY_GROWTH_TRACK_MAX, projectId, unlocked });
  });
}

export function entityGrowthTotal(entity) {
  const growth = normalizeEntityResearchGrowth(entity);
  return Object.values(growth).reduce((sum, value) => sum + value, 0);
}

export function entityGrowthCost(entity, track) {
  const definition = catalogDefinition(entity.catalogId);
  const growth = normalizeEntityResearchGrowth(entity);
  const nextLevel = Math.min(ENTITY_GROWTH_TRACK_MAX, (growth[track] ?? 0) + 1);
  const total = entityGrowthTotal(entity);
  return Math.max(75, Math.round(definition.cost * (0.035 + total * 0.018 + nextLevel * 0.012)));
}

export function getEntityGrowthView(state, entityId) {
  normalizeResearchState(state);
  const entity = state.world?.entities?.find((item) => item.id === entityId);
  if (!entity) return null;
  const definition = catalogDefinition(entity.catalogId);
  const tracks = growthTracksForEntity(state, entity).map((track) => Object.freeze({
    ...track,
    cost: track.level >= track.max ? null : entityGrowthCost(entity, track.id)
  }));
  return Object.freeze({
    entityId,
    label: definition.label,
    family: entityGrowthFamily(definition),
    total: entityGrowthTotal(entity),
    cap: ENTITY_GROWTH_TOTAL_CAP,
    tracks: Object.freeze(tracks)
  });
}

export function parkGrowthCost(state, track) {
  normalizeResearchState(state);
  const nextLevel = Math.min(PARK_GROWTH_TRACK_MAX, state.research.parkGrowth[track] + 1);
  const total = Object.values(state.research.parkGrowth).reduce((sum, value) => sum + value, 0);
  return 550 + nextLevel * 350 + total * 180;
}

export function getParkGrowthView(state) {
  normalizeResearchState(state);
  const total = Object.values(state.research.parkGrowth).reduce((sum, value) => sum + value, 0);
  return Object.freeze({
    total,
    cap: PARK_GROWTH_TOTAL_CAP,
    tracks: Object.freeze(Object.entries(PARK_GROWTH_TRACKS).map(([id, definition]) => {
      const level = state.research.parkGrowth[id];
      return Object.freeze({
        id, ...definition, level, max: PARK_GROWTH_TRACK_MAX,
        unlocked: hasResearch(state, definition.project),
        cost: level >= PARK_GROWTH_TRACK_MAX ? null : parkGrowthCost(state, id)
      });
    }))
  });
}

function completeResearch(state, projectId) {
  normalizeResearchState(state);
  const view = researchProjectView(state, projectId);
  if (!view) return { ok: false, reason: "Unknown research project." };
  if (view.completed) return { ok: false, reason: `${view.label} is already complete.` };
  if (!view.prerequisitesMet) return { ok: false, reason: "Complete the prerequisite research first." };
  if (!view.evidenceMet) return { ok: false, reason: "The park has not produced enough relevant evidence yet." };
  if (!view.affordable) return { ok: false, reason: `Need ${view.cost} research insight.` };
  state.research.insight -= view.cost;
  state.research.completed.push(projectId);
  appendEvent(state, "research.project.completed", projectId, { cost: view.cost, branch: view.branch });
  return { ok: true, message: `Research complete: ${view.label} · ${view.unlock}` };
}

function growEntity(state, entityId, track) {
  normalizeResearchState(state);
  const entity = state.world?.entities?.find((item) => item.id === entityId);
  if (!entity) return { ok: false, reason: "Park element not found." };
  const growthView = getEntityGrowthView(state, entityId);
  const trackView = growthView?.tracks.find((item) => item.id === track);
  if (!trackView) return { ok: false, reason: "That growth track does not apply to this park element." };
  if (!trackView.unlocked) return { ok: false, reason: `Research ${RESEARCH_PROJECTS[trackView.projectId].label} first.` };
  if (trackView.level >= trackView.max) return { ok: false, reason: `${trackView.label} is already fully developed.` };
  if (growthView.total >= growthView.cap) return { ok: false, reason: "This park element has reached its current functional growth capacity." };
  const cost = trackView.cost;
  if (!charge(state, cost, `Grow ${growthView.label}: ${trackView.label}`)) return { ok: false, reason: "Not enough park cash for this growth step." };
  normalizeEntityResearchGrowth(entity)[track] += 1;
  appendEvent(state, "research.entity.grown", entity.id, { track, level: entity.researchGrowth[track], cost });
  return { ok: true, message: `${growthView.label}: ${trackView.label} grew to L${entity.researchGrowth[track]}.` };
}

function growPark(state, track) {
  normalizeResearchState(state);
  const definition = PARK_GROWTH_TRACKS[track];
  if (!definition) return { ok: false, reason: "Unknown park growth track." };
  if (!hasResearch(state, definition.project)) return { ok: false, reason: `Research ${RESEARCH_PROJECTS[definition.project].label} first.` };
  const total = Object.values(state.research.parkGrowth).reduce((sum, value) => sum + value, 0);
  if (total >= PARK_GROWTH_TOTAL_CAP) return { ok: false, reason: "The park has reached its current growth capacity." };
  if (state.research.parkGrowth[track] >= PARK_GROWTH_TRACK_MAX) return { ok: false, reason: `${definition.label} is already fully developed.` };
  const cost = parkGrowthCost(state, track);
  if (!charge(state, cost, `Park growth: ${definition.label}`)) return { ok: false, reason: "Not enough park cash for this park-wide growth step." };
  state.research.parkGrowth[track] += 1;
  appendEvent(state, "research.park.grown", state.park.id, { track, level: state.research.parkGrowth[track], cost });
  return { ok: true, message: `Park ${definition.label} grew to L${state.research.parkGrowth[track]}.` };
}

export function applyResearchAction(state, action) {
  if (action?.type === "completeResearch") return completeResearch(state, action.projectId);
  if (action?.type === "growEntity") return growEntity(state, action.entityId, action.track);
  if (action?.type === "growPark") return growPark(state, action.track);
  return { ok: false, reason: `Unknown research action: ${action?.type}` };
}

export function addResearchEvidence(state, evidence = {}, insightUnits = 0) {
  normalizeResearchState(state);
  for (const [channel, amount] of Object.entries(evidence)) {
    if (!Object.hasOwn(RESEARCH_CHANNELS, channel)) continue;
    state.research.evidence[channel] += Math.max(0, integer(amount));
  }
  const multiplier = hasResearch(state, "learning-culture") ? 1.25 : 1;
  state.research.insightProgress += Math.max(0, Number(insightUnits) || 0) * multiplier;
  const earned = Math.floor(state.research.insightProgress / RESEARCH_INSIGHT_UNIT);
  if (earned > 0) {
    state.research.insight += earned;
    state.research.lifetimeInsight += earned;
    state.research.insightProgress -= earned * RESEARCH_INSIGHT_UNIT;
  }
  return earned;
}

const EVENT_EVIDENCE = Object.freeze({
  "visitor.entered": Object.freeze({ units: 1, evidence: { guests: 1, park: 1 } }),
  "ride.cycle.completed": Object.freeze({ units: 2, evidence: { rides: 2, park: 1 } }),
  "staff.cleaner.completed": Object.freeze({ units: 2, evidence: { operations: 2 } }),
  "staff.mechanic.completed": Object.freeze({ units: 2, evidence: { operations: 2, rides: 1 } }),
  "operations.day.closed": Object.freeze({ units: 4, evidence: { operations: 2, park: 4 } }),
  "progression.level.unlocked": Object.freeze({ units: 3, evidence: { park: 5 } }),
  "entity.evolved": Object.freeze({ units: 2, evidence: { rides: 2, operations: 1 } }),
  "entity.built": Object.freeze({ units: 1, evidence: { park: 1 } }),
  "adventure.stamp.collected": Object.freeze({ units: 1, evidence: { guests: 1, park: 2 } })
});

export function processResearchEvents(state) {
  normalizeResearchState(state);
  const events = (state.eventLog ?? []).filter((entry) => entry.sequence > state.research.lastEventSequence);
  let earned = 0;
  for (const entry of events) {
    let signal = EVENT_EVIDENCE[entry.type] ?? null;
    if (entry.type === "economy.income" && entry.data?.label === "Service sale") {
      signal = { units: 1, evidence: { services: 1, commerce: 1 } };
    }
    if (signal) earned += addResearchEvidence(state, signal.evidence, signal.units);
    state.research.lastEventSequence = Math.max(state.research.lastEventSequence, entry.sequence);
  }
  return earned;
}

export function parkResearchModifier(state) {
  normalizeResearchState(state);
  let retailLevels = 0;
  let careLevels = 0;
  for (const entity of state.world?.entities ?? []) {
    const definition = catalogDefinition(entity.catalogId);
    const growth = normalizeEntityResearchGrowth(entity);
    if (definition.category === "Stores" && definition.kind !== "service") retailLevels += growth.appeal;
    if (definition.category === "Services" && definition.kind !== "service" && definition.need !== "rest") careLevels += growth.care;
  }
  const park = state.research.parkGrowth;
  return Object.freeze({
    newGuestPatience: park.hospitality * 3,
    newGuestStay: park.hospitality * 8,
    hourlyOperationsRebate: clamp(park.operations * 0.04, 0, 0.16),
    demandBonus: clamp(park.identity * 0.01 + retailLevels * 0.002 + careLevels * 0.0015, 0, 0.08),
    ratingBonus: clamp(park.identity * 0.4 + retailLevels * 0.12 + careLevels * 0.18, 0, 4)
  });
}
