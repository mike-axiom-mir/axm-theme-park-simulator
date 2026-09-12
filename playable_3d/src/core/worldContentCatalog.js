const ride = (data) => Object.freeze({
  kind: "ride",
  ridePrice: 2,
  conditionLoss: 0.032,
  theme: "fairground",
  accessibility: "assisted transfer",
  ...data
});

const activeService = (data) => Object.freeze({
  kind: "service",
  category: "Services",
  capacity: 6,
  serviceMinutes: 3,
  operatingCost: 2,
  itemPrice: 0,
  theme: "neutral",
  ...data
});

const passiveFacility = (data) => Object.freeze({
  kind: "scenery",
  category: "Services",
  theme: "neutral",
  influence: "care",
  ...data
});

const passiveStore = (data) => Object.freeze({
  kind: "scenery",
  category: "Stores",
  theme: "fairground",
  influence: "retail",
  ...data
});

const foodStore = (data) => Object.freeze({
  kind: "service",
  category: "Stores",
  capacity: 5,
  serviceMinutes: 3,
  operatingCost: 3,
  itemPrice: 4,
  theme: "fairground",
  ...data
});

/**
 * Original AXM adaptations of common world-theme-park attraction/service families.
 * Names, themes and visuals are original; no branded attraction is reproduced.
 * `visualFamily` selects a bounded shared model family in worldContentModels.js.
 */
export const WORLD_CONTENT_CATALOG = Object.freeze({
  twirlcups: ride({
    id: "twirlcups", category: "Rides", label: "Twirly Tea Garden", icon: "◌",
    description: "A cheerful family cup ride: easy to understand, fun to watch, and lively at low intensity.",
    cost: 1850, footprint: [3, 3], capacity: 12, cycleMinutes: 6,
    operatingCost: 6, ridePrice: 2, firstValue: 0.66, repeatValue: 0.86,
    intensity: 0.28, comfort: 0.82, familyFit: 0.98, thrillFit: 0.27, explorerFit: 0.55,
    color: 0xe8a5c5, visualFamily: "cups"
  }),
  bumpers: ride({
    id: "bumpers", category: "Attractions", label: "Bumble Buggies", icon: "▱",
    description: "Tiny electric cars bonk, dodge and spin in a friendly free-driving arena.",
    cost: 2500, footprint: [4, 4], capacity: 12, cycleMinutes: 7,
    operatingCost: 8, ridePrice: 2, firstValue: 0.74, repeatValue: 0.9,
    intensity: 0.38, comfort: 0.76, familyFit: 0.96, thrillFit: 0.42, explorerFit: 0.58,
    color: 0xf2c45e, visualFamily: "bumpers"
  }),
  cloudhop: ride({
    id: "cloudhop", category: "Rides", label: "Cloud Hop", icon: "↕",
    description: "A compact bounce tower that lifts, drops and giggles instead of trying to terrify everyone.",
    cost: 2300, footprint: [2, 2], capacity: 8, cycleMinutes: 6,
    operatingCost: 7, ridePrice: 2, firstValue: 0.72, repeatValue: 0.82,
    intensity: 0.46, comfort: 0.74, familyFit: 0.9, thrillFit: 0.58, explorerFit: 0.55,
    color: 0x86c7ef, visualFamily: "bounceTower"
  }),
  starflyers: ride({
    id: "starflyers", category: "Rides", label: "Star Flyers", icon: "✣",
    description: "Swing chairs rise into a glowing orbit for a breezy medium-thrill panorama.",
    cost: 3900, footprint: [4, 4], capacity: 16, cycleMinutes: 8,
    operatingCost: 12, ridePrice: 3, firstValue: 0.82, repeatValue: 0.73,
    intensity: 0.62, comfort: 0.64, familyFit: 0.7, thrillFit: 0.82, explorerFit: 0.75,
    color: 0xb88adf, visualFamily: "swing"
  }),
  sunbeam: ride({
    id: "sunbeam", category: "Attractions", label: "Sunbeam Lookout", icon: "↥",
    description: "A slow observation tower for guests who want the view without the scream.",
    cost: 3300, footprint: [3, 3], capacity: 12, cycleMinutes: 10,
    operatingCost: 8, ridePrice: 2, firstValue: 0.76, repeatValue: 0.66,
    intensity: 0.2, comfort: 0.9, familyFit: 0.86, thrillFit: 0.3, explorerFit: 0.96,
    color: 0xf0d16d, visualFamily: "observation"
  }),
  cometdrop: ride({
    id: "cometdrop", category: "Rides", label: "Comet Drop", icon: "⇣",
    description: "A compact true drop tower: short queue, short cycle, very obvious bravery test.",
    cost: 5200, footprint: [3, 3], capacity: 10, cycleMinutes: 6,
    operatingCost: 15, ridePrice: 4, firstValue: 0.93, repeatValue: 0.62,
    intensity: 0.94, comfort: 0.5, familyFit: 0.34, thrillFit: 0.99, explorerFit: 0.7,
    color: 0xe96570, visualFamily: "dropTower"
  }),
  logdash: ride({
    id: "logdash", category: "Rides", label: "Timber Tumble", icon: "≋",
    description: "Classic log boats climb a timber hill, drift through scenery, then splash home.",
    cost: 4800, footprint: [6, 4], capacity: 8, cycleMinutes: 10,
    operatingCost: 14, ridePrice: 3, firstValue: 0.86, repeatValue: 0.76,
    intensity: 0.58, comfort: 0.65, familyFit: 0.88, thrillFit: 0.63, explorerFit: 0.83,
    theme: "river", color: 0x63a9d8, visualFamily: "flume"
  }),
  rapids: ride({
    id: "rapids", category: "Rides", label: "Rumble Rapids", icon: "◍",
    description: "Round rafts wobble through a busy white-water loop where every trip feels slightly different.",
    cost: 6100, footprint: [6, 5], capacity: 10, cycleMinutes: 11,
    operatingCost: 18, ridePrice: 4, firstValue: 0.91, repeatValue: 0.8,
    intensity: 0.69, comfort: 0.58, familyFit: 0.77, thrillFit: 0.77, explorerFit: 0.9,
    theme: "river", color: 0x4f9fc9, visualFamily: "rapids"
  }),
  lanternmaze: ride({
    id: "lanternmaze", category: "Attractions", label: "Lantern Labyrinth", icon: "◇",
    description: "A gentle indoor story ride through glowing rooms, tiny surprises and moving scenery.",
    cost: 4450, footprint: [5, 4], capacity: 12, cycleMinutes: 10,
    operatingCost: 11, ridePrice: 3, firstValue: 0.88, repeatValue: 0.72,
    intensity: 0.25, comfort: 0.86, familyFit: 0.95, thrillFit: 0.32, explorerFit: 0.98,
    theme: "story", color: 0xe6bb65, visualFamily: "darkride"
  }),
  littleloop: ride({
    id: "littleloop", category: "Attractions", label: "Little Loop Railway", icon: "▰",
    description: "A tiny park railway turns transport into an attraction with bells, steam and sightseeing.",
    cost: 3000, footprint: [5, 2], capacity: 18, cycleMinutes: 12,
    operatingCost: 8, ridePrice: 1, firstValue: 0.67, repeatValue: 0.82,
    intensity: 0.1, comfort: 0.94, familyFit: 0.98, thrillFit: 0.15, explorerFit: 0.86,
    color: 0x9d5b4e, visualFamily: "train"
  }),
  skyribbon: ride({
    id: "skyribbon", category: "Attractions", label: "Sky Ribbon", icon: "━",
    description: "A slow elevated monorail gives tired explorers a moving park panorama.",
    cost: 4200, footprint: [5, 2], capacity: 16, cycleMinutes: 12,
    operatingCost: 10, ridePrice: 2, firstValue: 0.73, repeatValue: 0.75,
    intensity: 0.12, comfort: 0.92, familyFit: 0.9, thrillFit: 0.18, explorerFit: 0.94,
    color: 0x82d1ca, visualFamily: "monorail"
  }),
  gardendrift: ride({
    id: "gardendrift", category: "Attractions", label: "Garden Drift Boats", icon: "⌣",
    description: "Slow boats glide past flowers and lanterns: low pressure, high atmosphere.",
    cost: 2800, footprint: [5, 3], capacity: 10, cycleMinutes: 12,
    operatingCost: 7, ridePrice: 2, firstValue: 0.7, repeatValue: 0.84,
    intensity: 0.08, comfort: 0.95, familyFit: 0.97, thrillFit: 0.12, explorerFit: 0.9,
    theme: "nature", color: 0x6bb7b1, visualFamily: "boats"
  }),
  cloudcinema: ride({
    id: "cloudcinema", category: "Attractions", label: "Cloud Cinema 4D", icon: "▣",
    description: "A short indoor effects show mixes moving seats, wind and silly visual surprises.",
    cost: 3500, footprint: [4, 3], capacity: 16, cycleMinutes: 9,
    operatingCost: 9, ridePrice: 2, firstValue: 0.77, repeatValue: 0.68,
    intensity: 0.3, comfort: 0.82, familyFit: 0.93, thrillFit: 0.38, explorerFit: 0.82,
    theme: "story", color: 0x8399dd, visualFamily: "cinema"
  }),
  skysail: ride({
    id: "skysail", category: "Attractions", label: "Sky Sailor", icon: "◫",
    description: "A compact flying-theatre simulator makes a tiny building feel like a huge journey.",
    cost: 5900, footprint: [4, 4], capacity: 14, cycleMinutes: 9,
    operatingCost: 16, ridePrice: 4, firstValue: 0.92, repeatValue: 0.69,
    intensity: 0.57, comfort: 0.7, familyFit: 0.7, thrillFit: 0.7, explorerFit: 0.97,
    theme: "story", color: 0x5f7fd9, visualFamily: "simulator"
  }),
  tinytown: ride({
    id: "tinytown", category: "Attractions", label: "Tiny Town Drivers", icon: "▤",
    description: "Guests steer little cars around a miniature town instead of following a visible rail.",
    cost: 3200, footprint: [5, 4], capacity: 12, cycleMinutes: 8,
    operatingCost: 8, ridePrice: 2, firstValue: 0.8, repeatValue: 0.88,
    intensity: 0.2, comfort: 0.8, familyFit: 0.99, thrillFit: 0.28, explorerFit: 0.7,
    color: 0x78b866, visualFamily: "drivers"
  }),
  acornplay: ride({
    id: "acornplay", category: "Attractions", label: "Acorn Adventure Play", icon: "♧",
    description: "A free climbing-and-slide garden gives families something fun that is not another queue machine.",
    cost: 1600, footprint: [4, 3], capacity: 14, cycleMinutes: 9,
    operatingCost: 3, ridePrice: 0, firstValue: 0.7, repeatValue: 0.91,
    intensity: 0.18, comfort: 0.82, familyFit: 1, thrillFit: 0.2, explorerFit: 0.62,
    theme: "nature", color: 0x77ae65, visualFamily: "play"
  }),
  bubblesub: ride({
    id: "bubblesub", category: "Attractions", label: "Bubble Submarine", icon: "◉",
    description: "A slow indoor submarine fantasy with portholes, bubbles and tiny underwater scenes.",
    cost: 5350, footprint: [5, 4], capacity: 12, cycleMinutes: 11,
    operatingCost: 13, ridePrice: 3, firstValue: 0.9, repeatValue: 0.72,
    intensity: 0.18, comfort: 0.88, familyFit: 0.9, thrillFit: 0.25, explorerFit: 0.99,
    theme: "ocean", color: 0x4aa4bf, visualFamily: "submarine"
  }),

  refill: activeService({
    id: "refill", label: "Free Refill Fountain", icon: "◔",
    description: "A free water refill point: simple, useful and especially valuable in warm weather.",
    cost: 420, footprint: [1, 1], capacity: 5, serviceMinutes: 1,
    operatingCost: 1, itemPrice: 0, need: "thirst", color: 0x65c7e8, visualFamily: "refill"
  }),
  quietcove: {
    id: "quietcove", kind: "scenery", category: "Services", label: "Quiet Cove", icon: "◐",
    description: "A low-stimulation sheltered rest space for guests who want a calmer corner of the park.",
    cost: 720, footprint: [2, 2], capacity: 3, serviceMinutes: 14, need: "rest",
    theme: "nature", influence: "rest", color: 0x7bb6a3, visualFamily: "quiet"
  },
  firstaid: passiveFacility({
    id: "firstaid", label: "Care Cabin", icon: "+",
    description: "Visible first-aid support makes the park feel cared for without turning health into micromanagement.",
    cost: 1100, footprint: [2, 2], color: 0xe57373, visualFamily: "care"
  }),
  familynest: passiveFacility({
    id: "familynest", label: "Family Nest", icon: "⌂",
    description: "A family-care room with changing space, feeding corner and a quiet place to regroup.",
    cost: 900, footprint: [2, 2], color: 0xf0b8c7, visualFamily: "family"
  }),
  stash: passiveFacility({
    id: "stash", label: "Stash Station", icon: "▦",
    description: "Lockers for bags and loose items, styled as a cheerful wall of tiny doors.",
    cost: 650, footprint: [2, 1], color: 0x7895b2, visualFamily: "lockers"
  }),
  hellohub: passiveFacility({
    id: "hellohub", label: "Hello Hub", icon: "?",
    description: "Information, maps and lost-and-found in one friendly little booth.",
    cost: 520, footprint: [1, 1], color: 0xf1c765, visualFamily: "info"
  }),
  wagonwheels: passiveFacility({
    id: "wagonwheels", label: "Wagon Wheels", icon: "◉",
    description: "Stroller and little-wagon rental turns a practical service into part of the park character.",
    cost: 560, footprint: [2, 1], color: 0xd99961, visualFamily: "stroller"
  }),
  chargegrove: passiveFacility({
    id: "chargegrove", label: "Charge Grove", icon: "⚡",
    description: "A shaded charging corner where devices recharge while guests sit down for a moment.",
    cost: 680, footprint: [2, 2], theme: "nature", influence: "rest", color: 0x7dd4a2, visualFamily: "charging"
  }),

  memorymarket: passiveStore({
    id: "memorymarket", label: "Memory Market", icon: "★",
    description: "General souvenirs, postcards and small park keepsakes in a compact colourful shop.",
    cost: 1250, footprint: [2, 2], color: 0xf0c766, visualFamily: "souvenir", retailNeed: "shopping"
  }),
  toytinker: passiveStore({
    id: "toytinker", label: "Toy Tinker", icon: "◆",
    description: "A toy-and-plush shop with moving window displays instead of another static cash box.",
    cost: 1450, footprint: [2, 2], color: 0x76c6cf, visualFamily: "toy", retailNeed: "shopping"
  }),
  parkthreads: passiveStore({
    id: "parkthreads", label: "Park Threads", icon: "▱",
    description: "Hats, shirts and rain gear displayed outside like part of the street scenery.",
    cost: 1350, footprint: [2, 2], color: 0xb693df, visualFamily: "apparel", retailNeed: "shopping"
  }),
  snapshotshop: passiveStore({
    id: "snapshotshop", label: "Snapshot Shop", icon: "▣",
    description: "A photo counter with spinning preview frames and space for future ride-photo integration.",
    cost: 1500, footprint: [2, 2], color: 0x6db9d7, visualFamily: "photo", retailNeed: "shopping"
  }),
  nameit: passiveStore({
    id: "nameit", label: "Name-It Workshop", icon: "✎",
    description: "A tiny personalisation workshop for badges, tags and silly named souvenirs.",
    cost: 1600, footprint: [2, 2], color: 0xe59a74, visualFamily: "custom", retailNeed: "shopping"
  }),
  sugarcloud: foodStore({
    id: "sugarcloud", label: "Sugar Cloud", icon: "☁",
    description: "Candy, fruit chews and colourful little treats in a bright confectionery kiosk.",
    cost: 950, footprint: [2, 2], itemPrice: 4, need: "hunger", color: 0xf2a8c4, visualFamily: "candy"
  }),
  swirlcart: foodStore({
    id: "swirlcart", label: "Swirl Cart", icon: "♢",
    description: "Ice cream and frozen fruit swirls from a tiny animated cart.",
    cost: 780, footprint: [1, 1], capacity: 4, itemPrice: 4, need: "hunger", color: 0x9ed8e0, visualFamily: "icecream"
  }),
  popcornplanet: foodStore({
    id: "popcornplanet", label: "Popcorn Planet", icon: "✦",
    description: "A popcorn cart with a visible popping drum and fast family-friendly service.",
    cost: 720, footprint: [1, 1], capacity: 4, serviceMinutes: 2, itemPrice: 3, need: "hunger",
    color: 0xf0c766, visualFamily: "popcorn"
  })
});

export const WORLD_CONTENT_IDS = Object.freeze(Object.keys(WORLD_CONTENT_CATALOG));
