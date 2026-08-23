import { GRID_SIZE, catalogDefinition, rotatedFootprint } from "./catalog.js";
import {
  DISTRICT_DEFINITIONS, DISTRICT_THEME_IDS, DISTRICT_THEMES,
  districtForCell, districtForEntity
} from "./districts.js";

export const THEME_FIT_SCHEMA = "axm.themepark.theme-fit/v1";

export const THEME_FIT_STATES = Object.freeze({
  signature: Object.freeze({
    id: "signature", label: "Signature fit", tone: "good",
    summary: "This element naturally anchors the district identity."
  }),
  strong: Object.freeze({
    id: "strong", label: "Strong fit", tone: "good",
    summary: "Several parts of this element reinforce the district identity."
  }),
  compatible: Object.freeze({
    id: "compatible", label: "Compatible", tone: "info",
    summary: "This element supports part of the district identity without defining it."
  }),
  neutral: Object.freeze({
    id: "neutral", label: "Flexible fit", tone: "info",
    summary: "This element can sit here without forcing or fighting the district identity."
  }),
  contrast: Object.freeze({
    id: "contrast", label: "Style contrast", tone: "warning",
    summary: "This is allowed as a deliberate contrast; the game does not block or punish it."
  })
});

export const THEME_TAG_LABELS = Object.freeze({
  adventure: "adventure",
  care: "guest care",
  family: "family",
  fantasy: "fantasy",
  flexible: "flexible",
  food: "food & drink",
  future: "future",
  garden: "garden",
  indoor: "indoor",
  medieval: "medieval",
  retail: "retail",
  scenic: "scenic",
  storybook: "storybook",
  thrill: "thrill",
  water: "water",
  western: "western"
});

const TAG_ORDER = Object.freeze([
  "water", "garden", "adventure", "western", "medieval", "storybook", "fantasy", "future",
  "family", "thrill", "scenic", "indoor", "food", "retail", "care", "flexible"
]);

const THEME_FIELD_TAGS = Object.freeze({
  fairground: Object.freeze(["family", "storybook"]),
  neutral: Object.freeze(["flexible"]),
  nature: Object.freeze(["garden", "scenic"]),
  river: Object.freeze(["water", "adventure", "scenic"]),
  ocean: Object.freeze(["water", "future", "scenic"]),
  story: Object.freeze(["storybook", "indoor"]),
  clockwork: Object.freeze(["storybook", "future", "indoor"])
});

const VISUAL_FAMILY_TAGS = Object.freeze({
  cups: Object.freeze(["family", "garden", "storybook"]),
  bumpers: Object.freeze(["family", "future"]),
  bounceTower: Object.freeze(["family", "future", "thrill"]),
  swing: Object.freeze(["thrill", "scenic", "future"]),
  observation: Object.freeze(["scenic", "future", "family"]),
  dropTower: Object.freeze(["thrill", "future", "adventure"]),
  flume: Object.freeze(["water", "adventure", "family", "scenic"]),
  rapids: Object.freeze(["water", "adventure", "thrill", "scenic"]),
  darkride: Object.freeze(["storybook", "indoor", "family"]),
  train: Object.freeze(["storybook", "scenic", "family"]),
  monorail: Object.freeze(["future", "scenic", "family"]),
  boats: Object.freeze(["water", "garden", "scenic", "family"]),
  cinema: Object.freeze(["storybook", "indoor", "family"]),
  simulator: Object.freeze(["future", "indoor", "adventure"]),
  drivers: Object.freeze(["storybook", "family"]),
  play: Object.freeze(["garden", "adventure", "family"]),
  submarine: Object.freeze(["water", "future", "indoor", "storybook"]),
  refill: Object.freeze(["water", "care"]),
  quiet: Object.freeze(["garden", "care"]),
  care: Object.freeze(["care"]),
  family: Object.freeze(["family", "care"]),
  lockers: Object.freeze(["care"]),
  info: Object.freeze(["care", "scenic"]),
  stroller: Object.freeze(["family", "care"]),
  charging: Object.freeze(["garden", "care", "future"]),
  souvenir: Object.freeze(["retail", "family", "storybook"]),
  toy: Object.freeze(["retail", "family", "storybook"]),
  apparel: Object.freeze(["retail", "family"]),
  photo: Object.freeze(["retail", "scenic"]),
  custom: Object.freeze(["retail", "storybook"]),
  candy: Object.freeze(["food", "family", "storybook"]),
  icecream: Object.freeze(["food", "family", "garden"]),
  popcorn: Object.freeze(["food", "family"])
});

const INFLUENCE_TAGS = Object.freeze({
  shade: Object.freeze(["garden", "care"]),
  light: Object.freeze(["storybook", "future", "scenic"]),
  landmark: Object.freeze(["scenic"]),
  rest: Object.freeze(["care", "garden"]),
  retail: Object.freeze(["retail"]),
  care: Object.freeze(["care"])
});

function addTags(set, values) {
  for (const value of values ?? []) {
    const tag = String(value ?? "").trim().toLowerCase();
    if (THEME_TAG_LABELS[tag]) set.add(tag);
  }
}

export function themeTagLabel(tag) {
  return THEME_TAG_LABELS[tag] ?? String(tag ?? "");
}

/**
 * Build a stable, explainable style vocabulary from explicit content tags first,
 * then from existing catalog evidence. This is advisory only: it never mutates
 * simulation state and never changes build legality, prices, guests or rating.
 */
export function themeTagsForDefinition(definition) {
  const tags = new Set();
  addTags(tags, definition?.themeTags);
  addTags(tags, THEME_FIELD_TAGS[definition?.theme]);
  addTags(tags, VISUAL_FAMILY_TAGS[definition?.visualFamily]);
  addTags(tags, INFLUENCE_TAGS[definition?.influence]);

  if (definition?.kind === "ride") {
    if (Number(definition.familyFit) >= 0.72) tags.add("family");
    if (Number(definition.thrillFit) >= 0.72) tags.add("thrill");
    if (Number(definition.explorerFit) >= 0.78) tags.add("scenic");
  }
  if (definition?.kind === "service") {
    if (definition.need === "thirst") addTags(tags, ["water", "food", "care"]);
    if (definition.need === "hunger") addTags(tags, ["food", "family"]);
    if (definition.need === "rest") addTags(tags, ["care", "garden"]);
    if (definition.need === "toilet") tags.add("care");
  }
  if (definition?.category === "Stores") tags.add("retail");
  if (definition?.category === "Services") tags.add("care");
  if (definition?.category === "Scenery") tags.add("scenic");
  if (definition?.kind === "path") tags.add("flexible");

  // Fantasy is derived from combinations already present in the catalog rather
  // than invented as a second content taxonomy. Story + place, or enchanted
  // nature + adventure, is enough evidence to become a Fantasy anchor.
  if (tags.has("storybook") && ["scenic", "indoor", "garden", "adventure", "water"]
    .some((tag) => tags.has(tag))) tags.add("fantasy");
  if (tags.has("garden") && tags.has("adventure") && tags.has("scenic")) tags.add("fantasy");

  // Western uses grounded frontier evidence already present in rides: rail is a
  // direct signature, while river/adventure attractions qualify only when they
  // also have scenic family/thrill evidence. Food/retail can still be compatible
  // without becoming signature anchors by default.
  if (definition?.visualFamily === "train") tags.add("western");
  if (definition?.theme === "river"
    && tags.has("adventure") && tags.has("scenic")
    && (tags.has("family") || tags.has("thrill"))) tags.add("western");

  // Medieval deliberately overlaps some Storybook/Fantasy attractions because a
  // single dark/story ride can be framed as a keep, dungeon or market tale. The
  // signature still requires combined story evidence rather than any family ride.
  if (tags.has("storybook") && (tags.has("indoor") || tags.has("adventure"))) tags.add("medieval");

  if (!tags.size) tags.add("flexible");
  return Object.freeze(TAG_ORDER.filter((tag) => tags.has(tag)));
}

function themeProfile(themeId) {
  return DISTRICT_THEMES[themeId] ?? DISTRICT_THEMES.neutral;
}

function otherSignatureTags(themeId) {
  const tags = new Set();
  for (const candidateId of DISTRICT_THEME_IDS) {
    if (candidateId === "neutral" || candidateId === themeId) continue;
    addTags(tags, DISTRICT_THEMES[candidateId]?.signatureTags);
  }
  return tags;
}

export function evaluateThemeFit(definition, themeId = "neutral") {
  const theme = themeProfile(themeId);
  const tags = themeTagsForDefinition(definition);
  const preferred = new Set(theme.preferredTags ?? []);
  const signatureTags = new Set(theme.signatureTags ?? []);
  const matchedTags = tags.filter((tag) => preferred.has(tag));
  const matchedSignatureTags = tags.filter((tag) => signatureTags.has(tag));

  let status = "neutral";
  if (theme.id !== "neutral") {
    if (matchedSignatureTags.length && matchedTags.length >= 2) status = "signature";
    else if (matchedSignatureTags.length || matchedTags.length >= 3) status = "strong";
    else if (matchedTags.length >= 1) status = "compatible";
    else if (tags.some((tag) => otherSignatureTags(theme.id).has(tag))) status = "contrast";
  }

  const descriptor = THEME_FIT_STATES[status];
  const matchText = matchedTags.length
    ? matchedTags.slice(0, 3).map(themeTagLabel).join(" + ")
    : "no required match";
  const suggestion = status === "contrast"
    ? `Allowed contrast. Add matching scenery nearby or keep ${definition.label} as an intentional landmark.`
    : status === "neutral"
      ? `${definition.label} remains flexible here; no theme choice is forced.`
      : `${definition.label} reinforces ${theme.label} through ${matchText}.`;

  return Object.freeze({
    schema: THEME_FIT_SCHEMA,
    status,
    label: descriptor.label,
    tone: descriptor.tone,
    summary: descriptor.summary,
    score: status === "signature" ? 3 : status === "strong" ? 2 : status === "compatible" ? 1 : status === "contrast" ? -1 : 0,
    themeId: theme.id,
    themeLabel: theme.label,
    contentId: definition.id,
    contentLabel: definition.label,
    tags,
    matchedTags: Object.freeze(matchedTags),
    matchedSignatureTags: Object.freeze(matchedSignatureTags),
    suggestion
  });
}

function withDistrict(fit, districtId) {
  return Object.freeze({
    ...fit,
    districtId,
    districtLabel: DISTRICT_DEFINITIONS[districtId]?.label ?? "Unknown district"
  });
}

function themeIdForDistrict(state, districtId) {
  const candidate = state?.districts?.themes?.[districtId];
  return DISTRICT_THEME_IDS.includes(candidate) ? candidate : "neutral";
}

export function themeFitForEntity(state, entity) {
  if (!state || !entity) return null;
  const districtId = districtForEntity(entity);
  const themeId = themeIdForDistrict(state, districtId);
  return withDistrict(evaluateThemeFit(catalogDefinition(entity.catalogId), themeId), districtId);
}

export function themeFitForPlacement(state, catalogId, x, z, rotation = 0) {
  if (!state) return null;
  const definition = catalogDefinition(catalogId);
  const [width, depth] = rotatedFootprint(definition, rotation);
  const centerX = Number(x) + (width - 1) / 2;
  const centerZ = Number(z) + (depth - 1) / 2;
  const districtId = districtForCell(centerX, centerZ, GRID_SIZE);
  const themeId = themeIdForDistrict(state, districtId);
  return withDistrict(evaluateThemeFit(definition, themeId), districtId);
}

export function describeThemeFit(fit) {
  if (!fit) return "Theme fit unavailable.";
  const matches = fit.matchedTags.length
    ? ` · ${fit.matchedTags.slice(0, 3).map(themeTagLabel).join(" + ")}`
    : "";
  return `${fit.districtLabel} · ${fit.themeLabel} · ${fit.label}${matches}`;
}
