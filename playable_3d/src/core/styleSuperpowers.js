import { GRID_SIZE, catalogDefinition, rotatedFootprint } from "./catalog.js";
import {
  DISTRICT_DEFINITIONS, DISTRICT_IDS, DISTRICT_THEMES, districtForEntity
} from "./districts.js";
import { themeFitForEntity, themeTagLabel } from "./themeFit.js";

export const STYLE_SUPERPOWER_SCHEMA = "axm.themepark.style-superpowers/v1";
export const STYLE_SUPERPOWER_VISUAL_BUDGET = 4;
export const STYLE_SUPERPOWER_ANCHOR_BUDGET = 6;

export const STYLE_SUPERPOWER_STAGES = Object.freeze({
  passive: Object.freeze({ id: "passive", label: "Passive", intensity: 0 }),
  dormant: Object.freeze({ id: "dormant", label: "Dormant", intensity: 0 }),
  awakening: Object.freeze({ id: "awakening", label: "Awakening", intensity: 0.48 }),
  charged: Object.freeze({ id: "charged", label: "Charged", intensity: 0.76 }),
  unleashed: Object.freeze({ id: "unleashed", label: "Unleashed", intensity: 1 })
});

const power = (data) => Object.freeze({
  visualMode: "none",
  moment: "",
  ...data
});

export const STYLE_SUPERPOWERS = Object.freeze({
  neutral: power({
    id: "open-canvas",
    themeId: "neutral",
    label: "Open Canvas",
    summary: "Neutral keeps every attraction visually independent instead of forcing a district spectacle.",
    visualMode: "none",
    moment: "Its strength is restraint: no automatic district effect is layered over the park."
  }),
  garden: power({
    id: "bloomwake",
    themeId: "garden",
    label: "Bloomwake",
    summary: "Matching garden, scenic, family and water content wakes a shared bloom-and-pollen rhythm.",
    visualMode: "bloom",
    moment: "Rain makes Bloomwake breathe harder without changing simulation values."
  }),
  adventure: power({
    id: "trailblaze",
    themeId: "adventure",
    label: "Trailblaze",
    summary: "Adventure, thrill, water and scenic anchors form a moving expedition beacon line.",
    visualMode: "trail",
    moment: "Bright weather gives the trail markers a slightly stronger presentation pulse."
  }),
  storybook: power({
    id: "lantern-chorus",
    themeId: "storybook",
    label: "Lantern Chorus",
    summary: "Family, story, indoor and scenic anchors join into a floating lantern chorus.",
    visualMode: "lanterns",
    moment: "The chorus becomes more luminous in the evening and at night."
  }),
  cartoon: power({
    id: "toonburst",
    themeId: "cartoon",
    label: "Toonburst",
    summary: "Family, playful thrill, food and toy-like anchors synchronize squash, stretch and comic pop motion.",
    visualMode: "toon",
    moment: "Busy daytime hours make Toonburst feel bouncier; the effect remains presentation-only."
  }),
  fantasy: power({
    id: "aetherveil",
    themeId: "fantasy",
    label: "Aetherveil",
    summary: "Fantasy, scenic, story and enchanted-nature anchors wake crystals, floating runes and arcane wisps.",
    visualMode: "arcana",
    moment: "Dusk, night and rain make Aetherveil glow more strongly without changing simulation values."
  }),
  western: power({
    id: "frontier-rush",
    themeId: "western",
    label: "Frontier Rush",
    summary: "Rail, river, adventure and family anchors wake wagon-wheel motion, lantern lines and drifting dust signals.",
    visualMode: "frontier",
    moment: "Late afternoon and dry bright weather make Frontier Rush feel warmer and dustier without changing simulation values."
  }),
  medieval: power({
    id: "bannerwake",
    themeId: "medieval",
    label: "Bannerwake",
    summary: "Story, indoor and adventure anchors wake stone keep silhouettes, banners, courtyard rings and torchlight.",
    visualMode: "keep",
    moment: "Evening and night strengthen Bannerwake's torch-and-banner presentation only."
  }),
  halloween: power({
    id: "hauntfall",
    themeId: "halloween",
    label: "Hauntfall",
    summary: "Dark-ride, indoor story and thrill anchors wake pumpkins, crooked lanterns, bats and rolling purple fog.",
    visualMode: "haunt",
    moment: "Dusk, night and rain make Hauntfall denser and brighter without changing guest or ride simulation."
  }),
  christmas: power({
    id: "snowglow",
    themeId: "christmas",
    label: "Snowglow",
    summary: "Family, story, rail, food and scenic anchors wake evergreen lights, ornaments and a shared winter-market glow.",
    visualMode: "snowglow",
    moment: "Evening and night make Snowglow sparkle more strongly; the snow language remains presentation-only."
  }),
  newyear: power({
    id: "countdown-burst",
    themeId: "newyear",
    label: "Countdown Burst",
    summary: "Future, scenic and thrill anchors synchronize gold rings, countdown markers, confetti and midnight firework shapes.",
    visualMode: "countdown",
    moment: "Late evening and the park's midnight boundary intensify Countdown Burst without changing time progression."
  }),
  future: power({
    id: "pulse-grid",
    themeId: "future",
    label: "Pulse Grid",
    summary: "Future, indoor, thrill and scenic anchors synchronize restrained rings and signal nodes.",
    visualMode: "grid",
    moment: "The signal grid becomes more legible after dusk when luminous accents matter most."
  }),
  robotica: power({
    id: "servo-surge",
    themeId: "robotica",
    label: "Servo Surge",
    summary: "Mechanical ride anchors synchronize gear rings, piston strokes, servo nodes and industrial signal lights.",
    visualMode: "servo",
    moment: "Active daytime operation makes Servo Surge look busier, while all effects remain render-only."
  }),
  software: power({
    id: "codewave",
    themeId: "software",
    label: "Codewave",
    summary: "Simulator, information and network-like anchors form a moving lattice of data nodes, code glyphs and logic pulses.",
    visualMode: "codewave",
    moment: "Night and indoor-oriented content make Codewave more luminous without implying any hidden AI control."
  }),
  waterfront: power({
    id: "tidecall",
    themeId: "waterfront",
    label: "Tidecall",
    summary: "Water, scenic and family anchors wake a shared ripple, mist and harbour-light rhythm.",
    visualMode: "tide",
    moment: "Rain and evening conditions strengthen Tidecall's presentation without creating a gameplay bonus."
  })
});

const FIT_POINTS = Object.freeze({ signature: 3, strong: 2, compatible: 1, neutral: 0, contrast: 0 });

function centerForEntity(entity) {
  const definition = catalogDefinition(entity.catalogId);
  const [width, depth] = rotatedFootprint(definition, entity.rotation ?? 0);
  return Object.freeze({
    x: Number(entity.x) + (width - 1) / 2,
    z: Number(entity.z) + (depth - 1) / 2
  });
}

function stageFor(themeId, score, eligibleCount) {
  if (themeId === "neutral") return STYLE_SUPERPOWER_STAGES.passive;
  if (!eligibleCount || score <= 0) return STYLE_SUPERPOWER_STAGES.dormant;
  if (score >= 6 && eligibleCount >= 2) return STYLE_SUPERPOWER_STAGES.unleashed;
  if (score >= 3) return STYLE_SUPERPOWER_STAGES.charged;
  return STYLE_SUPERPOWER_STAGES.awakening;
}

function topMatchedTags(anchors) {
  const counts = new Map();
  for (const anchor of anchors) {
    for (const tag of anchor.matchedTags) counts.set(tag, (counts.get(tag) ?? 0) + anchor.points);
  }
  return Object.freeze([...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([tag]) => tag));
}

function centroid(anchors, districtId) {
  if (!anchors.length) {
    const center = (GRID_SIZE - 1) / 2;
    const offset = GRID_SIZE * 0.24;
    const fallbacks = {
      north: { x: center, z: center - offset },
      east: { x: center + offset, z: center },
      south: { x: center, z: center + offset },
      west: { x: center - offset, z: center }
    };
    return Object.freeze(fallbacks[districtId] ?? { x: center, z: center });
  }
  const weight = anchors.reduce((sum, anchor) => sum + Math.max(1, anchor.points), 0);
  return Object.freeze({
    x: anchors.reduce((sum, anchor) => sum + anchor.x * Math.max(1, anchor.points), 0) / weight,
    z: anchors.reduce((sum, anchor) => sum + anchor.z * Math.max(1, anchor.points), 0) / weight
  });
}

function nextHint(themeId, stage, topTags, eligibleCount) {
  const theme = DISTRICT_THEMES[themeId] ?? DISTRICT_THEMES.neutral;
  if (themeId === "neutral") return "Open Canvas is intentionally always passive; choose a styled district to build a spectacle.";
  if (stage.id === "unleashed") return "This district is already unleashed. Add variety inside the same style instead of chasing a larger multiplier.";
  const missing = (theme.preferredTags ?? []).filter((tag) => !topTags.includes(tag)).slice(0, 2);
  const suggestion = missing.length ? missing.map(themeTagLabel).join(" or ") : "another fitting attraction or scenery element";
  return eligibleCount
    ? `Add ${suggestion} to strengthen the district's shared spectacle.`
    : `Add a fitting ${suggestion} anchor to wake this style.`;
}

/**
 * Read-only district identity plan. Style charge is presentation evidence only:
 * it never changes economy, guest motives, rating, research, pathing or build legality.
 */
export function styleSuperpowerForDistrict(state, districtId) {
  const themeId = state?.districts?.themes?.[districtId] ?? "neutral";
  const definition = STYLE_SUPERPOWERS[themeId] ?? STYLE_SUPERPOWERS.neutral;
  const anchors = [];

  for (const entity of state?.world?.entities ?? []) {
    if (districtForEntity(entity) !== districtId) continue;
    const fit = themeFitForEntity(state, entity);
    const points = FIT_POINTS[fit?.status] ?? 0;
    if (points <= 0) continue;
    const center = centerForEntity(entity);
    anchors.push(Object.freeze({
      entityId: entity.id,
      catalogId: entity.catalogId,
      contentLabel: fit.contentLabel,
      fitStatus: fit.status,
      points,
      x: center.x,
      z: center.z,
      matchedTags: Object.freeze([...fit.matchedTags])
    }));
  }

  anchors.sort((left, right) => right.points - left.points || left.entityId.localeCompare(right.entityId));
  const score = anchors.reduce((sum, anchor) => sum + anchor.points, 0);
  const stage = stageFor(themeId, score, anchors.length);
  const topTags = topMatchedTags(anchors);
  const visualAnchors = Object.freeze(anchors.slice(0, STYLE_SUPERPOWER_ANCHOR_BUDGET));
  const center = centroid(visualAnchors, districtId);

  return Object.freeze({
    schema: STYLE_SUPERPOWER_SCHEMA,
    districtId,
    districtLabel: DISTRICT_DEFINITIONS[districtId]?.label ?? "Unknown district",
    themeId,
    themeLabel: DISTRICT_THEMES[themeId]?.label ?? "Neutral",
    id: definition.id,
    label: definition.label,
    summary: definition.summary,
    moment: definition.moment,
    visualMode: definition.visualMode,
    stage: stage.id,
    stageLabel: stage.label,
    intensity: stage.intensity,
    score,
    eligibleCount: anchors.length,
    topTags,
    anchors: visualAnchors,
    center,
    nextHint: nextHint(themeId, stage, topTags, anchors.length),
    active: stage.intensity > 0
  });
}

export function styleSuperpowerPlan(state) {
  return Object.freeze(DISTRICT_IDS.map((districtId) => styleSuperpowerForDistrict(state, districtId)));
}

export function describeStyleSuperpower(powerState) {
  if (!powerState) return "Style power unavailable.";
  const tags = powerState.topTags.length
    ? ` · ${powerState.topTags.map(themeTagLabel).join(" + ")}`
    : "";
  return `${powerState.districtLabel} · ${powerState.themeLabel} · ${powerState.label} · ${powerState.stageLabel} · charge ${powerState.score}${tags}`;
}
