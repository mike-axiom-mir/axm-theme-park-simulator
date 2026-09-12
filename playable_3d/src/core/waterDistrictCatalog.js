const freezeTags = (values = []) => Object.freeze([...values]);

const ride = (data) => Object.freeze({
  kind: "ride",
  ridePrice: 2,
  conditionLoss: 0.032,
  theme: "river",
  accessibility: "assisted transfer",
  ...data,
  themeTags: freezeTags(data.themeTags)
});

const activeService = (data) => Object.freeze({
  kind: "service",
  category: "Services",
  capacity: 6,
  serviceMinutes: 3,
  operatingCost: 2,
  itemPrice: 0,
  theme: "river",
  ...data,
  themeTags: freezeTags(data.themeTags)
});

const passiveStore = (data) => Object.freeze({
  kind: "scenery",
  category: "Stores",
  theme: "river",
  influence: "retail",
  retailNeed: "shopping",
  ...data,
  themeTags: freezeTags(data.themeTags)
});

const restFacility = (data) => Object.freeze({
  kind: "scenery",
  category: "Services",
  capacity: 4,
  serviceMinutes: 14,
  need: "rest",
  theme: "nature",
  influence: "rest",
  ...data,
  themeTags: freezeTags(data.themeTags)
});

const scenery = (data) => Object.freeze({
  kind: "scenery",
  category: "Scenery",
  theme: "nature",
  influence: "landmark",
  ...data,
  themeTags: freezeTags(data.themeTags)
});

/**
 * Original AXM water-district content. These definitions deliberately reuse the
 * existing ride/service/scenery contracts rather than creating a second water
 * simulation. Theme tags are advisory presentation evidence only.
 */
export const WATER_DISTRICT_CATALOG = Object.freeze({
  canalcruise: ride({
    id: "canalcruise", category: "Attractions", label: "Lantern Canal Cruise", icon: "⌁",
    description: "Slow canal boats curve through lanterns, reeds and small story scenes.",
    cost: 3500, footprint: [6, 3], capacity: 12, cycleMinutes: 12,
    operatingCost: 8, ridePrice: 2, firstValue: 0.78, repeatValue: 0.88,
    intensity: 0.08, comfort: 0.94, familyFit: 0.97, thrillFit: 0.12, explorerFit: 0.97,
    color: 0x67b7c9, visualFamily: "canalRide",
    themeTags: ["water", "garden", "storybook", "scenic", "family"]
  }),
  tidalturn: ride({
    id: "tidalturn", category: "Rides", label: "Tidal Turntable", icon: "◌",
    description: "Little wave pods orbit a shallow pool in a lively but approachable family spin.",
    cost: 3200, footprint: [4, 4], capacity: 12, cycleMinutes: 7,
    operatingCost: 9, ridePrice: 3, firstValue: 0.8, repeatValue: 0.83,
    intensity: 0.52, comfort: 0.7, familyFit: 0.85, thrillFit: 0.67, explorerFit: 0.72,
    theme: "ocean", color: 0x55a9c6, visualFamily: "waterSpinner",
    themeTags: ["water", "future", "family", "thrill"]
  }),
  mistgarden: ride({
    id: "mistgarden", category: "Attractions", label: "Mist Garden Play", icon: "✣",
    description: "A free splash-and-mist play garden gives families movement without another hard queue.",
    cost: 1900, footprint: [4, 3], capacity: 16, cycleMinutes: 8,
    operatingCost: 4, ridePrice: 0, firstValue: 0.74, repeatValue: 0.92,
    intensity: 0.15, comfort: 0.85, familyFit: 1, thrillFit: 0.18, explorerFit: 0.7,
    theme: "nature", color: 0x79c8b4, visualFamily: "splashPlay",
    themeTags: ["water", "garden", "family", "care"]
  }),
  lagoonshow: ride({
    id: "lagoonshow", category: "Attractions", label: "Moonlit Lagoon Show", icon: "≋",
    description: "Low fountains, mist and light choreography turn a calm pool into a shared evening attraction.",
    cost: 4100, footprint: [5, 4], capacity: 18, cycleMinutes: 10,
    operatingCost: 11, ridePrice: 2, firstValue: 0.86, repeatValue: 0.78,
    intensity: 0.12, comfort: 0.9, familyFit: 0.95, thrillFit: 0.18, explorerFit: 0.93,
    theme: "ocean", color: 0x6d8ed7, visualFamily: "lagoonShow",
    themeTags: ["water", "storybook", "future", "scenic", "family"]
  }),

  harbourfizz: activeService({
    id: "harbourfizz", label: "Harbour Fizz Deck", icon: "▤",
    description: "Cold drinks and fruit fizz served from a small deck beside the water.",
    cost: 780, footprint: [2, 2], capacity: 6, serviceMinutes: 2,
    operatingCost: 3, itemPrice: 4, need: "thirst",
    theme: "ocean", color: 0x69bdd1, visualFamily: "harbourDrinks",
    themeTags: ["water", "food", "family", "scenic"]
  }),
  watersidegazebo: restFacility({
    id: "watersidegazebo", label: "Waterside Gazebo", icon: "⌂",
    description: "A shaded rest deck where tired guests can sit beside a small reflective pool.",
    cost: 850, footprint: [3, 2], color: 0x78b69a, visualFamily: "watersideRest",
    themeTags: ["water", "garden", "care", "scenic", "family"]
  }),
  ponchopier: passiveStore({
    id: "ponchopier", label: "Poncho Pier", icon: "▱",
    description: "Rain gear, towels and water-ride keepsakes displayed along a timber pier.",
    cost: 1100, footprint: [2, 2], color: 0x5fa8c7, visualFamily: "poncho",
    themeTags: ["water", "retail", "adventure", "care"]
  }),

  lilypond: scenery({
    id: "lilypond", label: "Lily Pond", icon: "◉",
    description: "A shallow pond with low-poly lilies, ripples and a calm reflective centre.",
    cost: 320, footprint: [2, 2], color: 0x63b79f, visualFamily: "pond",
    themeTags: ["water", "garden", "scenic"]
  }),
  cascadegarden: scenery({
    id: "cascadegarden", label: "Cascade Garden", icon: "≈",
    description: "A small rocky waterfall gives nearby paths and attractions a stronger water edge.",
    cost: 620, footprint: [3, 2], color: 0x69b7ca, visualFamily: "waterfall",
    themeTags: ["water", "garden", "adventure", "scenic"]
  }),
  reedbank: scenery({
    id: "reedbank", label: "Reed Bank", icon: "♧",
    description: "Reeds, stones and a tiny water patch soften hard edges around rides and paths.",
    cost: 110, footprint: [1, 1], color: 0x7dad68, visualFamily: "reeds",
    themeTags: ["water", "garden", "scenic"]
  }),
  boardwalkdeck: scenery({
    id: "boardwalkdeck", label: "Boardwalk Deck", icon: "═",
    description: "Decorative timber decking for waterfront edges; it does not replace authoritative paths.",
    cost: 140, footprint: [2, 1], theme: "river", color: 0xa06d48, visualFamily: "boardwalk",
    themeTags: ["water", "adventure", "scenic"]
  }),
  harbourlight: scenery({
    id: "harbourlight", label: "Harbour Light", icon: "†",
    description: "A compact lighthouse marker with a slow rotating evening beam.",
    cost: 540, footprint: [1, 1], theme: "ocean", color: 0xe7cf79, visualFamily: "lighthouse",
    themeTags: ["water", "adventure", "storybook", "future", "scenic"]
  })
});

export const WATER_DISTRICT_CONTENT_IDS = Object.freeze(Object.keys(WATER_DISTRICT_CATALOG));
export const WATER_DISTRICT_RIDE_IDS = Object.freeze(
  WATER_DISTRICT_CONTENT_IDS.filter((id) => WATER_DISTRICT_CATALOG[id].kind === "ride")
);
