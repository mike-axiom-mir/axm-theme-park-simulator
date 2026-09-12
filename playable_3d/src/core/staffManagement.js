export const STAFF_MAX_TRAINING_LEVEL = 3;
export const STAFF_ZONE_IDS = Object.freeze(["all", "north", "east", "south", "west"]);
export const STAFF_ZONE_LABELS = Object.freeze({
  all: "Whole park",
  north: "North half",
  east: "East half",
  south: "South half",
  west: "West half"
});

const clampLevel = (value) => Math.max(0, Math.min(
  STAFF_MAX_TRAINING_LEVEL,
  Math.floor(Number(value) || 0)
));

export function normalizeStaffZone(zone) {
  return STAFF_ZONE_IDS.includes(zone) ? zone : "all";
}

export function staffZoneContainsCell(zone, cell, size = 30) {
  const safeZone = normalizeStaffZone(zone);
  const x = Number(cell?.[0]);
  const z = Number(cell?.[1]);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  if (safeZone === "all") return true;
  const half = Math.max(1, Number(size) || 30) / 2;
  if (safeZone === "north") return z < half;
  if (safeZone === "south") return z >= half;
  if (safeZone === "west") return x < half;
  return x >= half;
}

export function staffTrainingCost(agentOrLevel = 0) {
  const level = clampLevel(typeof agentOrLevel === "object"
    ? agentOrLevel?.trainingLevel
    : agentOrLevel);
  if (level >= STAFF_MAX_TRAINING_LEVEL) return null;
  return [180, 260, 360][level];
}

export function staffTrainingProfile(agentOrLevel = 0) {
  const level = clampLevel(typeof agentOrLevel === "object"
    ? agentOrLevel?.trainingLevel
    : agentOrLevel);
  return Object.freeze({
    level,
    movePerMinute: 0.48 + level * 0.06,
    cleanerCapacity: 1 + level * 0.35,
    mechanicRepair: 5 + level * 2,
    cooldownMinutes: Math.max(0, 2 - level),
    nextTrainingCost: staffTrainingCost(level)
  });
}

export function normalizeStaffDevelopment(agent) {
  agent.trainingLevel = clampLevel(agent?.trainingLevel);
  agent.trainingSpent = Math.max(0, Number(agent?.trainingSpent) || 0);
  agent.zone = normalizeStaffZone(agent?.zone);
  return agent;
}

export function nextStaffZone(zone = "all") {
  const safe = normalizeStaffZone(zone);
  const index = STAFF_ZONE_IDS.indexOf(safe);
  return STAFF_ZONE_IDS[(index + 1) % STAFF_ZONE_IDS.length];
}
