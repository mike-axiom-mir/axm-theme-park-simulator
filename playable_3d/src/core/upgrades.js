import { catalogDefinition } from "./catalog.js";
import { hasResearch } from "./research.js";

export const UPGRADE_SCHEMA = "axm.themepark.upgrades/v1";
export const ENTITY_UPGRADE_SLOTS = 2;
export const PARK_UPGRADE_SLOTS = 4;
export const UPGRADE_SALVAGE_RATE = 0.25;

const moduleDef = (data) => Object.freeze({ scope: "entity", families: [], minCost: 100, costScale: 0.04, ...data });
const parkDef = (data) => Object.freeze({ scope: "park", cost: 1000, ...data });

export const ENTITY_UPGRADES = Object.freeze({
  "quick-load-gate": moduleDef({
    id: "quick-load-gate", label: "Quick-Load Gate", research: "ride-throughput", families: ["ride"],
    summary: "A dedicated loading gate removes a little dead time from active ride cycles.",
    effect: "Every sixth active minute receives one additional dispatch-progress step.", costScale: 0.045
  }),
  "condition-sensors": moduleDef({
    id: "condition-sensors", label: "Condition Sensors", research: "ride-reliability", families: ["ride"],
    summary: "Simple sensor coverage catches avoidable wear before it becomes a maintenance problem.",
    effect: "Protects 15% of observed ride wear after the normal ride cycle.", costScale: 0.05
  }),
  "comfort-package": moduleDef({
    id: "comfort-package", label: "Comfort Package", research: "ride-experience", families: ["ride"],
    summary: "Better seating, handles and boarding details make the same ride easier to enjoy.",
    effect: "Actual riders completing the attraction gain +1 happiness and a tiny energy recovery.", costScale: 0.045
  }),
  "scene-sequencer": moduleDef({
    id: "scene-sequencer", label: "Scene Sequencer", research: "ride-experience", families: ["indoor"],
    summary: "Tighter timing between lighting, scenes and motion improves indoor story attractions.",
    effect: "Actual riders completing an indoor attraction gain +2 happiness.", costScale: 0.055
  }),
  "panorama-audio": moduleDef({
    id: "panorama-audio", label: "Panorama Audio", research: "ride-experience", families: ["scenic"],
    summary: "A light narration/audio layer gives scenic transport and outlook rides more identity.",
    effect: "Explorer/local guests completing a scenic attraction gain +2 happiness.", costScale: 0.04
  }),
  "twin-counter": moduleDef({
    id: "twin-counter", label: "Twin Counter", research: "service-throughput", families: ["service", "food"],
    summary: "A second serving/work position removes a little dead time without doubling the building.",
    effect: "Every sixth active service minute receives one additional progress step.", costScale: 0.04
  }),
  "smart-meter": moduleDef({
    id: "smart-meter", label: "Smart Energy Meter", research: "service-efficiency", families: ["service", "food"],
    summary: "A small control kit trims repeated energy and utility waste.",
    effect: "Rebates 8% of that entity's observed operating spend.", costScale: 0.04
  }),
  "hospitality-counter": moduleDef({
    id: "hospitality-counter", label: "Hospitality Counter", research: "service-quality", families: ["service", "food"],
    summary: "Better counter layout and little service details make real visits feel smoother.",
    effect: "Guests actually completing the service gain +1 happiness.", costScale: 0.04
  }),
  "storefront-story": moduleDef({
    id: "storefront-story", label: "Storefront Story", research: "retail-appeal", families: ["retail"],
    summary: "Window displays and a clearer shop identity make passive retail part of the park story.",
    effect: "Adds a small bounded park draw/rating contribution without fabricating purchases.", costScale: 0.035
  }),
  "collector-display": moduleDef({
    id: "collector-display", label: "Collector Display", research: "park-identity", families: ["retail"],
    summary: "A signature display turns a shop into a stronger park-identity landmark.",
    effect: "Adds a slightly stronger rating contribution without inventing transactions.", costScale: 0.045
  }),
  "comfort-corner": moduleDef({
    id: "comfort-corner", label: "Comfort Corner", research: "care-network", families: ["care"],
    summary: "A small seating/support improvement makes practical facilities more useful to arriving families.",
    effect: "Each installed module contributes a tiny new-guest patience/stay bonus.", costScale: 0.035
  }),
  "accessibility-station": moduleDef({
    id: "accessibility-station", label: "Accessibility Station", research: "park-wayfinding", families: ["care"],
    summary: "Clearer access information and staging reduce friction around practical support facilities.",
    effect: "Each installed module contributes a small new-guest patience bonus.", costScale: 0.04
  })
});

export const PARK_UPGRADES = Object.freeze({
  "wayfinding-boards": parkDef({
    id: "wayfinding-boards", label: "Live Wayfinding Boards", research: "park-wayfinding", cost: 950,
    summary: "Simple park-wide signs and live orientation points reduce arrival friction.",
    effect: "+4 patience and +4 visit minutes for newly arriving guests; small draw bonus."
  }),
  "staff-radio": parkDef({
    id: "staff-radio", label: "Crew Radio Network", research: "park-operations", cost: 1250,
    summary: "A lightweight radio network helps cleaners and mechanics hand off work faster.",
    effect: "Every second tick can shave one extra minute from active staff cooldown."
  }),
  "energy-loop": parkDef({
    id: "energy-loop", label: "Energy Loop", research: "park-operations", cost: 1650,
    summary: "Shared controls and timed loads reduce repeated park-wide operating waste.",
    effect: "Rebates 6% of real hourly operations-and-staff charges."
  }),
  "rain-shelters": parkDef({
    id: "rain-shelters", label: "Rain Shelter Network", research: "park-wayfinding", cost: 1200,
    summary: "Covered pause points and clearer wet-weather routes make rainy days less punishing.",
    effect: "Recovers a bounded portion of park demand while it is raining."
  }),
  "welcome-square": parkDef({
    id: "welcome-square", label: "Welcome Square", research: "park-identity", cost: 1500,
    summary: "A stronger arrival moment gives the entire park a clearer sense of place.",
    effect: "New guests gain +1 happiness; small park draw/rating bonus."
  }),
  "night-signature": parkDef({
    id: "night-signature", label: "Night Signature", research: "park-identity", cost: 1850,
    summary: "A coordinated evening identity makes late-day operation feel intentional rather than merely darker.",
    effect: "Small additional evening draw/rating bonus after 18:00."
  }),
  "recycling-network": parkDef({
    id: "recycling-network", label: "Recycling Network", research: "park-operations", cost: 1350,
    summary: "Better bins and back-of-house routing catch some newly generated litter before cleaners need to chase it.",
    effect: "Captures 25% of new litter generated during the minute tick."
  })
});

const integer = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.floor(Number(value)) : fallback;
const roundMoney = (value) => Math.round(Number(value || 0) * 100) / 100;

function appendEvent(state, type, subjectId, data = {}) {
  state.eventLog ??= [];
  state.eventLog.push({
    sequence: (state.eventLog.at(-1)?.sequence ?? 0) + 1,
    tick: state.tick ?? 0,
    type,
    subjectId,
    data
  });
  if (state.eventLog.length > 400) state.eventLog.splice(0, state.eventLog.length - 400);
}

function charge(state, amount, label, subjectId = "park") {
  const value = Math.max(0, roundMoney(amount));
  if ((state.economy?.cash ?? 0) < value) return false;
  state.economy.cash = roundMoney(state.economy.cash - value);
  state.economy.todayCosts = roundMoney((state.economy.todayCosts ?? 0) + value);
  state.economy.lifetimeCosts = roundMoney((state.economy.lifetimeCosts ?? 0) + value);
  appendEvent(state, "economy.cost", subjectId, { amount: value, label });
  return true;
}

function salvage(state, amount, label, subjectId = "park") {
  const value = Math.max(0, roundMoney(amount));
  state.economy.cash = roundMoney((state.economy.cash ?? 0) + value);
  state.economy.todayIncome = roundMoney((state.economy.todayIncome ?? 0) + value);
  state.economy.lifetimeIncome = roundMoney((state.economy.lifetimeIncome ?? 0) + value);
  appendEvent(state, "economy.income", subjectId, { amount: value, label });
  return value;
}

export function upgradeFamiliesForDefinition(definition) {
  const families = new Set();
  if (definition.kind === "ride") families.add("ride");
  if (definition.kind === "service") families.add("service");
  if (definition.kind === "service" && definition.category === "Stores") families.add("food");
  if (definition.category === "Stores" && definition.kind !== "service") families.add("retail");
  if (definition.category === "Services" && definition.kind !== "service") families.add("care");

  const visualFamily = definition.visualFamily ?? "";
  if (definition.kind === "ride" && (definition.theme === "river" || ["flume", "rapids", "boats"].includes(visualFamily))) {
    families.add("water");
  }
  if (definition.kind === "ride" && (["darkride", "cinema", "simulator", "submarine"].includes(visualFamily)
    || ["haunted"].includes(definition.id))) {
    families.add("indoor");
  }
  if (definition.kind === "ride" && (["train", "monorail", "boats", "observation"].includes(visualFamily)
    || ["wheel"].includes(definition.id))) {
    families.add("scenic");
  }
  return Object.freeze([...families]);
}

export function normalizeUpgradeState(state) {
  state.upgrades ??= {};
  state.upgrades.schema = UPGRADE_SCHEMA;
  state.upgrades.park = [...new Set((state.upgrades.park ?? []).filter((id) => PARK_UPGRADES[id]))].slice(0, PARK_UPGRADE_SLOTS);
  state.upgrades.lifetimeInstalls = Math.max(0, integer(state.upgrades.lifetimeInstalls));
  for (const entity of state.world?.entities ?? []) {
    const definition = catalogDefinition(entity.catalogId);
    const families = upgradeFamiliesForDefinition(definition);
    entity.installedUpgrades = [...new Set((entity.installedUpgrades ?? []).filter((id) => {
      const module = ENTITY_UPGRADES[id];
      return module && module.families.some((family) => families.includes(family));
    }))].slice(0, ENTITY_UPGRADE_SLOTS);
  }
  return state;
}

export function entityUpgradeCost(entity, upgradeId) {
  const module = ENTITY_UPGRADES[upgradeId];
  if (!module) return null;
  const definition = catalogDefinition(entity.catalogId);
  return Math.max(module.minCost, Math.round(definition.cost * module.costScale));
}

export function entityUpgradeView(state, entityId) {
  normalizeUpgradeState(state);
  const entity = state.world?.entities?.find((item) => item.id === entityId);
  if (!entity) return null;
  const definition = catalogDefinition(entity.catalogId);
  const families = upgradeFamiliesForDefinition(definition);
  const installed = entity.installedUpgrades ?? [];
  const modules = Object.values(ENTITY_UPGRADES)
    .filter((module) => module.families.some((family) => families.includes(family)))
    .map((module) => Object.freeze({
      ...module,
      installed: installed.includes(module.id),
      unlocked: hasResearch(state, module.research),
      cost: entityUpgradeCost(entity, module.id)
    }));
  return Object.freeze({
    entityId,
    label: definition.label,
    families,
    installed: Object.freeze([...installed]),
    slotsUsed: installed.length,
    slots: ENTITY_UPGRADE_SLOTS,
    modules: Object.freeze(modules)
  });
}

export function parkUpgradeView(state) {
  normalizeUpgradeState(state);
  const installed = state.upgrades.park;
  return Object.freeze({
    installed: Object.freeze([...installed]),
    slotsUsed: installed.length,
    slots: PARK_UPGRADE_SLOTS,
    modules: Object.freeze(Object.values(PARK_UPGRADES).map((module) => Object.freeze({
      ...module,
      installed: installed.includes(module.id),
      unlocked: hasResearch(state, module.research)
    })))
  });
}

export function getUpgradeView(state) {
  normalizeUpgradeState(state);
  const entities = (state.world?.entities ?? [])
    .map((entity) => entityUpgradeView(state, entity.id))
    .filter((view) => view?.modules?.length);
  return Object.freeze({
    schema: UPGRADE_SCHEMA,
    park: parkUpgradeView(state),
    entities: Object.freeze(entities)
  });
}

function installEntityUpgrade(state, action) {
  normalizeUpgradeState(state);
  const entity = state.world?.entities?.find((item) => item.id === action.entityId);
  const module = ENTITY_UPGRADES[action.upgradeId];
  if (!entity || !module) return { ok: false, reason: "That upgrade target does not exist." };
  const view = entityUpgradeView(state, entity.id);
  const candidate = view.modules.find((item) => item.id === module.id);
  if (!candidate) return { ok: false, reason: `${module.label} is not compatible with this park element.` };
  if (candidate.installed) return { ok: false, reason: `${module.label} is already installed.` };
  if (!candidate.unlocked) return { ok: false, reason: `Research ${module.research} first.` };
  if (view.slotsUsed >= view.slots) return { ok: false, reason: `${view.label} has no free upgrade slot.` };
  const cost = candidate.cost;
  if (!charge(state, cost, `Install ${module.label}`, entity.id)) return { ok: false, reason: `Need €${cost} to install ${module.label}.` };
  entity.installedUpgrades.push(module.id);
  state.upgrades.lifetimeInstalls += 1;
  appendEvent(state, "upgrade.entity.installed", entity.id, { upgradeId: module.id, cost });
  return { ok: true, message: `${module.label} installed on ${view.label}.`, cost };
}

function removeEntityUpgrade(state, action) {
  normalizeUpgradeState(state);
  const entity = state.world?.entities?.find((item) => item.id === action.entityId);
  const module = ENTITY_UPGRADES[action.upgradeId];
  if (!entity || !module || !entity.installedUpgrades.includes(module.id)) return { ok: false, reason: "That upgrade is not installed." };
  entity.installedUpgrades = entity.installedUpgrades.filter((id) => id !== module.id);
  const recovered = salvage(state, entityUpgradeCost(entity, module.id) * UPGRADE_SALVAGE_RATE,
    `Recover ${module.label} parts`, entity.id);
  appendEvent(state, "upgrade.entity.removed", entity.id, { upgradeId: module.id, recovered });
  return { ok: true, message: `${module.label} removed · €${Math.round(recovered)} recovered.`, recovered };
}

function installParkUpgrade(state, action) {
  normalizeUpgradeState(state);
  const module = PARK_UPGRADES[action.upgradeId];
  if (!module) return { ok: false, reason: "Unknown park upgrade." };
  if (state.upgrades.park.includes(module.id)) return { ok: false, reason: `${module.label} is already installed.` };
  if (!hasResearch(state, module.research)) return { ok: false, reason: `Research ${module.research} first.` };
  if (state.upgrades.park.length >= PARK_UPGRADE_SLOTS) return { ok: false, reason: "The park has no free infrastructure upgrade slot." };
  if (!charge(state, module.cost, `Install ${module.label}`, state.park.id)) return { ok: false, reason: `Need €${module.cost} to install ${module.label}.` };
  state.upgrades.park.push(module.id);
  state.upgrades.lifetimeInstalls += 1;
  appendEvent(state, "upgrade.park.installed", state.park.id, { upgradeId: module.id, cost: module.cost });
  return { ok: true, message: `${module.label} installed park-wide.`, cost: module.cost };
}

function removeParkUpgrade(state, action) {
  normalizeUpgradeState(state);
  const module = PARK_UPGRADES[action.upgradeId];
  if (!module || !state.upgrades.park.includes(module.id)) return { ok: false, reason: "That park upgrade is not installed." };
  state.upgrades.park = state.upgrades.park.filter((id) => id !== module.id);
  const recovered = salvage(state, module.cost * UPGRADE_SALVAGE_RATE, `Recover ${module.label} infrastructure`, state.park.id);
  appendEvent(state, "upgrade.park.removed", state.park.id, { upgradeId: module.id, recovered });
  return { ok: true, message: `${module.label} removed · €${Math.round(recovered)} recovered.`, recovered };
}

export function applyUpgradeAction(state, action) {
  switch (action?.type) {
    case "installEntityUpgrade": return installEntityUpgrade(state, action);
    case "removeEntityUpgrade": return removeEntityUpgrade(state, action);
    case "installParkUpgrade": return installParkUpgrade(state, action);
    case "removeParkUpgrade": return removeParkUpgrade(state, action);
    default: return { ok: false, reason: `Unknown upgrade action: ${action?.type ?? "missing"}` };
  }
}

export function hasEntityUpgrade(entity, upgradeId) {
  return Boolean(entity?.installedUpgrades?.includes(upgradeId));
}

export function hasParkUpgrade(state, upgradeId) {
  normalizeUpgradeState(state);
  return state.upgrades.park.includes(upgradeId);
}

export function upgradeModifierSummary(state) {
  normalizeUpgradeState(state);
  let retailStory = 0;
  let collectorDisplays = 0;
  let comfortCorners = 0;
  let accessibilityStations = 0;
  for (const entity of state.world?.entities ?? []) {
    if (hasEntityUpgrade(entity, "storefront-story")) retailStory += 1;
    if (hasEntityUpgrade(entity, "collector-display")) collectorDisplays += 1;
    if (hasEntityUpgrade(entity, "comfort-corner")) comfortCorners += 1;
    if (hasEntityUpgrade(entity, "accessibility-station")) accessibilityStations += 1;
  }
  const park = new Set(state.upgrades.park);
  return Object.freeze({
    newGuestPatience: (park.has("wayfinding-boards") ? 4 : 0) + comfortCorners + accessibilityStations * 2,
    newGuestStay: (park.has("wayfinding-boards") ? 4 : 0) + comfortCorners * 3,
    newGuestHappiness: park.has("welcome-square") ? 1 : 0,
    hourlyRebate: park.has("energy-loop") ? 0.06 : 0,
    rainDemandRecovery: park.has("rain-shelters") ? 0.05 : 0,
    baseDemandBonus: (park.has("wayfinding-boards") ? 0.01 : 0) + (park.has("welcome-square") ? 0.012 : 0)
      + retailStory * 0.004 + collectorDisplays * 0.002,
    baseRatingBonus: (park.has("welcome-square") ? 0.35 : 0) + retailStory * 0.08 + collectorDisplays * 0.22,
    eveningDemandBonus: park.has("night-signature") ? 0.02 : 0,
    eveningRatingBonus: park.has("night-signature") ? 0.4 : 0,
    staffRadio: park.has("staff-radio"),
    litterCapture: park.has("recycling-network") ? 0.25 : 0
  });
}
