export const GRID_SIZE = 30;
export const TILE_SIZE = 2;
export const PARK_OPEN_MINUTE = 9 * 60;
export const PARK_CLOSE_MINUTE = 22 * 60;

const ride = (data) => ({
  kind: "ride",
  ridePrice: 2,
  conditionLoss: 0.035,
  theme: "fairground",
  accessibility: "assisted transfer",
  ...data
});

export const CATALOG = {
  path: {
    id: "path", kind: "path", category: "Paths", label: "Stone path",
    description: "Connects people to every part of the park.", cost: 12,
    footprint: [1, 1], icon: "▦", color: 0xb9a37c
  },
  queue: {
    id: "queue", kind: "path", category: "Paths", label: "Queue path",
    description: "Connect beside an attraction to expand its queue capacity and reduce crowding.",
    cost: 18, footprint: [1, 1], icon: "≋", color: 0x79a9b8
  },
  carousel: ride({
    id: "carousel", category: "Rides", label: "Moonlight Carousel", icon: "◉",
    description: "A reliable family classic with unusually strong repeat value.",
    cost: 2200, footprint: [3, 3], capacity: 10, cycleMinutes: 8,
    operatingCost: 7, ridePrice: 2, firstValue: 0.63, repeatValue: 0.86,
    intensity: 0.22, comfort: 0.88, familyFit: 0.96, thrillFit: 0.28,
    explorerFit: 0.62, color: 0xf0b45b
  }),
  wheel: ride({
    id: "wheel", category: "Rides", label: "Sky Wheel", icon: "✺",
    description: "A landmark view ride that strengthens park identity and atmosphere.",
    cost: 3600, footprint: [4, 2], capacity: 12, cycleMinutes: 12,
    operatingCost: 10, firstValue: 0.79, repeatValue: 0.68, intensity: 0.34,
    comfort: 0.81, familyFit: 0.88, thrillFit: 0.44, explorerFit: 0.9,
    color: 0x63c7d5
  }),
  galleon: ride({
    id: "galleon", category: "Rides", label: "Moonwake Galleon", icon: "◒",
    description: "A swinging ship that bridges family spectacle and real thrill without consuming coaster-scale land.",
    cost: 4300, footprint: [5, 3], capacity: 12, cycleMinutes: 8,
    operatingCost: 12, ridePrice: 3, firstValue: 0.84, repeatValue: 0.75,
    intensity: 0.72, comfort: 0.64, familyFit: 0.72, thrillFit: 0.86,
    explorerFit: 0.74, color: 0xd8894f
  }),
  coaster: ride({
    id: "coaster", category: "Rides", label: "Comet Coaster", icon: "⌁",
    description: "A compact steel coaster: high first-experience value and destination draw.",
    cost: 6900, footprint: [7, 5], capacity: 8, cycleMinutes: 9,
    operatingCost: 22, ridePrice: 4, firstValue: 0.96, repeatValue: 0.71,
    intensity: 0.9, comfort: 0.61, familyFit: 0.42, thrillFit: 0.98,
    explorerFit: 0.82, color: 0xe35f68
  }),
  splash: ride({
    id: "splash", category: "Rides", label: "River Rascals", icon: "≈",
    description: "A playful water circuit with weather-dependent appeal.",
    cost: 4700, footprint: [5, 4], capacity: 8, cycleMinutes: 10,
    operatingCost: 14, ridePrice: 3, firstValue: 0.84, repeatValue: 0.76,
    intensity: 0.48, comfort: 0.67, familyFit: 0.91, thrillFit: 0.55,
    explorerFit: 0.8, theme: "river", color: 0x4d9de0
  }),
  haunted: ride({
    id: "haunted", category: "Rides", label: "Clockwork Manor", icon: "◆",
    description: "A story attraction whose atmosphere matters as much as its machinery.",
    cost: 5200, footprint: [4, 3], capacity: 10, cycleMinutes: 11,
    operatingCost: 13, ridePrice: 3, firstValue: 0.91, repeatValue: 0.64,
    intensity: 0.58, comfort: 0.73, familyFit: 0.65, thrillFit: 0.72,
    explorerFit: 0.96, theme: "clockwork", color: 0x8167a9
  }),
  spinner: ride({
    id: "spinner", category: "Rides", label: "Star Spinner", icon: "✦",
    description: "A compact thrill ride with low land pressure and fast cycles.",
    cost: 3100, footprint: [3, 3], capacity: 8, cycleMinutes: 7,
    operatingCost: 9, ridePrice: 3, firstValue: 0.8, repeatValue: 0.78,
    intensity: 0.76, comfort: 0.59, familyFit: 0.48, thrillFit: 0.9,
    explorerFit: 0.68, color: 0xf08dc0
  }),
  snacks: {
    id: "snacks", kind: "service", category: "Services", label: "Snack Rocket",
    icon: "▣", description: "Quick food. Extends visits but creates litter when overloaded.",
    cost: 850, footprint: [2, 2], capacity: 5, serviceMinutes: 3,
    operatingCost: 4, itemPrice: 5, need: "hunger", theme: "fairground", color: 0xf28f3b
  },
  drinks: {
    id: "drinks", kind: "service", category: "Services", label: "Fizz Station",
    icon: "▤", description: "Reduces thirst, especially valuable on warm days.",
    cost: 650, footprint: [2, 2], capacity: 6, serviceMinutes: 2,
    operatingCost: 3, itemPrice: 4, need: "thirst", theme: "fairground", color: 0x67b7dc
  },
  toilets: {
    id: "toilets", kind: "service", category: "Services", label: "Comfort Cabin",
    icon: "▥", description: "A free essential service that protects visit duration.",
    cost: 900, footprint: [2, 2], capacity: 8, serviceMinutes: 3,
    operatingCost: 4, itemPrice: 0, need: "toilet", theme: "neutral", color: 0x8fd19e
  },
  tree: {
    id: "tree", kind: "scenery", category: "Scenery", label: "Shade tree",
    icon: "♣", description: "Provides shade and visual coverage; strongest near paths and queues.",
    cost: 90, footprint: [1, 1], theme: "nature", influence: "shade", color: 0x3f8f55
  },
  lantern: {
    id: "lantern", kind: "scenery", category: "Scenery", label: "Festival lantern",
    icon: "†", description: "Adds night lighting and fairground coherence without changing ride physics.",
    cost: 120, footprint: [1, 1], theme: "fairground", influence: "light", color: 0xf6d365
  },
  fountain: {
    id: "fountain", kind: "scenery", category: "Scenery", label: "Star fountain",
    icon: "✧", description: "A memorable central landmark with comfort and identity value.",
    cost: 420, footprint: [2, 2], theme: "fairground", influence: "landmark", color: 0x65c7e8
  },
  bench: {
    id: "bench", kind: "scenery", category: "Scenery", label: "Rest bench",
    icon: "═", description: "Rest support that helps families and tired guests stay longer.",
    cost: 65, footprint: [1, 1], capacity: 2, serviceMinutes: 14, need: "rest",
    theme: "neutral", influence: "rest", color: 0x8b5e3c
  }
};

export const BUILD_CATEGORIES = ["Paths", "Rides", "Services", "Scenery"];

export const CAMPAIGN_LEVELS = Object.freeze([
  {
    level: 1,
    label: "Local fairground",
    requirement: "Inherited with the park",
    unlocks: ["path", "queue", "carousel", "spinner", "snacks", "toilets", "tree", "lantern", "fountain", "bench"]
  },
  {
    level: 2,
    label: "Neighbourhood favourite",
    requirement: "Welcome 20 guests and hold rating 55",
    unlocks: ["wheel", "galleon", "drinks"]
  },
  {
    level: 3,
    label: "Regional adventure",
    requirement: "Welcome 55 guests and hold rating 62",
    unlocks: ["splash", "haunted"]
  },
  {
    level: 4,
    label: "Living Globe landmark",
    requirement: "Welcome 90 guests and hold rating 70",
    unlocks: ["coaster"]
  }
]);

export function campaignLevelForCatalog(id) {
  return CAMPAIGN_LEVELS.find((tier) => tier.unlocks.includes(id))?.level ?? 1;
}

export function catalogIdsThroughLevel(level) {
  return CAMPAIGN_LEVELS
    .filter((tier) => tier.level <= level)
    .flatMap((tier) => tier.unlocks);
}

export function rotatedFootprint(definition, rotation = 0) {
  const [width, depth] = definition.footprint;
  return rotation % 2 === 0 ? [width, depth] : [depth, width];
}

export function catalogDefinition(id) {
  const definition = CATALOG[id];
  if (!definition) throw new Error(`Unknown catalog item: ${id}`);
  return definition;
}
