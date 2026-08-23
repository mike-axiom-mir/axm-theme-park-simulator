import { GRID_SIZE, catalogDefinition, rotatedFootprint } from "./catalog.js";

export const DISTRICT_SCHEMA = "axm.themepark.districts/v1";
export const DISTRICT_IDS = Object.freeze(["north", "east", "south", "west"]);
export const DISTRICT_THEME_IDS = Object.freeze([
  "neutral", "garden", "adventure", "storybook", "future", "waterfront"
]);

export const DISTRICT_DEFINITIONS = Object.freeze({
  north: Object.freeze({ id: "north", label: "North district" }),
  east: Object.freeze({ id: "east", label: "East district" }),
  south: Object.freeze({ id: "south", label: "South district" }),
  west: Object.freeze({ id: "west", label: "West district" })
});

const frozenTags = (values = []) => Object.freeze([...values]);
const districtTheme = (data) => Object.freeze({
  ...data,
  signatureTags: frozenTags(data.signatureTags),
  preferredTags: frozenTags(data.preferredTags)
});

export const DISTRICT_THEMES = Object.freeze({
  neutral: districtTheme({
    id: "neutral",
    label: "Neutral",
    summary: "Keep each park element's own identity without added district dressing.",
    signatureTags: [],
    preferredTags: []
  }),
  garden: districtTheme({
    id: "garden",
    label: "Garden",
    summary: "Planting, ponds, shade, family comfort and warm-lantern atmosphere.",
    signatureTags: ["garden"],
    preferredTags: ["garden", "scenic", "family", "water", "care"]
  }),
  adventure: districtTheme({
    id: "adventure",
    label: "Adventure",
    summary: "Timber, expedition details, water action, movement and bolder thrill landmarks.",
    signatureTags: ["adventure"],
    preferredTags: ["adventure", "thrill", "water", "family", "scenic"]
  }),
  storybook: districtTheme({
    id: "storybook",
    label: "Storybook",
    summary: "Playful lanterns, fairytale framing, family rides and indoor story experiences.",
    signatureTags: ["storybook"],
    preferredTags: ["storybook", "family", "indoor", "scenic", "garden"]
  }),
  future: districtTheme({
    id: "future",
    label: "Future",
    summary: "Clean rings, signal nodes, kinetic rides, indoor worlds and restrained luminous accents.",
    signatureTags: ["future"],
    preferredTags: ["future", "thrill", "indoor", "scenic", "water"]
  }),
  waterfront: districtTheme({
    id: "waterfront",
    label: "Waterfront",
    summary: "Boardwalk timber, reeds, mist, harbour lights and attractions shaped around water.",
    signatureTags: ["water"],
    preferredTags: ["water", "scenic", "family", "garden", "adventure", "food", "care"]
  })
});

const safeTheme = (value) => DISTRICT_THEME_IDS.includes(value) ? value : "neutral";

/**
 * Fixed wedge-shaped starter districts. They are a presentation/style substrate,
 * not a simulation rule: no economy, guest motive, pathing, research or ride
 * behavior depends on district identity.
 */
export function districtForCell(x, z, gridSize = GRID_SIZE) {
  const size = Math.max(2, Number(gridSize) || GRID_SIZE);
  const center = (size - 1) / 2;
  const dx = Number(x) - center;
  const dz = Number(z) - center;
  if (Math.abs(dz) >= Math.abs(dx)) return dz < 0 ? "north" : "south";
  return dx >= 0 ? "east" : "west";
}

export function districtForEntity(entity) {
  if (!entity) return null;
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  const centerX = Number(entity.x) + (width - 1) / 2;
  const centerZ = Number(entity.z) + (depth - 1) / 2;
  return districtForCell(centerX, centerZ);
}

export function normalizeDistrictState(state) {
  state.districts ??= {};
  state.districts.schema = DISTRICT_SCHEMA;
  state.districts.themes ??= {};
  for (const districtId of DISTRICT_IDS) {
    state.districts.themes[districtId] = safeTheme(state.districts.themes[districtId]);
  }
  for (const key of Object.keys(state.districts.themes)) {
    if (!DISTRICT_IDS.includes(key)) delete state.districts.themes[key];
  }
  state.districts.revision = Math.max(0, Math.floor(Number(state.districts.revision) || 0));
  return state;
}

export function districtThemeForEntity(state, entity) {
  normalizeDistrictState(state);
  const districtId = districtForEntity(entity);
  const themeId = districtId ? state.districts.themes[districtId] : "neutral";
  return Object.freeze({
    districtId,
    districtLabel: DISTRICT_DEFINITIONS[districtId]?.label ?? "Unknown district",
    themeId,
    themeLabel: DISTRICT_THEMES[themeId]?.label ?? DISTRICT_THEMES.neutral.label
  });
}

export function districtView(state) {
  normalizeDistrictState(state);
  return Object.freeze({
    schema: DISTRICT_SCHEMA,
    revision: state.districts.revision,
    districts: Object.freeze(DISTRICT_IDS.map((districtId) => Object.freeze({
      ...DISTRICT_DEFINITIONS[districtId],
      themeId: state.districts.themes[districtId],
      theme: DISTRICT_THEMES[state.districts.themes[districtId]]
    })))
  });
}

function appendEvent(state, districtId, previousTheme, themeId) {
  state.eventLog ??= [];
  state.eventLog.push({
    sequence: (state.eventLog.at(-1)?.sequence ?? 0) + 1,
    tick: state.tick ?? 0,
    type: "district.theme.changed",
    subjectId: districtId,
    data: { previousTheme, themeId }
  });
  if (state.eventLog.length > 400) state.eventLog.splice(0, state.eventLog.length - 400);
}

function setDistrictTheme(state, districtId, themeId) {
  normalizeDistrictState(state);
  if (!DISTRICT_IDS.includes(districtId)) return { ok: false, reason: "That district does not exist." };
  if (!DISTRICT_THEME_IDS.includes(themeId)) return { ok: false, reason: "That district theme does not exist." };
  const previousTheme = state.districts.themes[districtId];
  if (previousTheme === themeId) {
    return {
      ok: false,
      reason: `${DISTRICT_DEFINITIONS[districtId].label} already uses ${DISTRICT_THEMES[themeId].label}.`
    };
  }
  state.districts.themes[districtId] = themeId;
  state.districts.revision += 1;
  appendEvent(state, districtId, previousTheme, themeId);
  return {
    ok: true,
    message: `${DISTRICT_DEFINITIONS[districtId].label} · ${DISTRICT_THEMES[themeId].label} style`,
    districtId,
    themeId
  };
}

export function applyDistrictAction(state, action = {}) {
  normalizeDistrictState(state);
  const entity = action.entityId
    ? state.world?.entities?.find((item) => item.id === action.entityId)
    : null;
  const districtId = action.districtId ?? districtForEntity(entity);

  if (action.type === "setDistrictTheme") {
    return setDistrictTheme(state, districtId, action.themeId);
  }
  if (action.type === "cycleDistrictTheme") {
    if (!DISTRICT_IDS.includes(districtId)) {
      return { ok: false, reason: "Select a park element inside a district first." };
    }
    const current = state.districts.themes[districtId];
    const next = DISTRICT_THEME_IDS[(DISTRICT_THEME_IDS.indexOf(current) + 1) % DISTRICT_THEME_IDS.length];
    return setDistrictTheme(state, districtId, next);
  }
  return { ok: false, reason: "Unknown district style action." };
}
