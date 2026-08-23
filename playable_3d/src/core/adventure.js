export const ADVENTURE_STAMP_DEFINITIONS = Object.freeze([
  { id: "gate-spark", label: "Gate Spark", x: 15, z: 27 },
  { id: "carousel-memory", label: "Carousel Memory", x: 14, z: 17 },
  { id: "fountain-star", label: "Fountain Star", x: 16, z: 22 },
  { id: "grove-whisper", label: "Grove Whisper", x: 10, z: 19 },
  { id: "horizon-token", label: "Horizon Token", x: 21, z: 22 }
]);

export function createAdventureState(existing = null) {
  const foundIds = new Set((existing?.stamps ?? [])
    .filter((stamp) => stamp.found)
    .map((stamp) => stamp.id));
  return {
    title: "Living Globe Discovery Trail",
    stamps: ADVENTURE_STAMP_DEFINITIONS.map((stamp) => ({
      ...stamp,
      found: foundIds.has(stamp.id)
    })),
    completed: existing?.completed === true || foundIds.size === ADVENTURE_STAMP_DEFINITIONS.length
  };
}

export function adventureProgress(adventure) {
  const total = adventure?.stamps?.length ?? ADVENTURE_STAMP_DEFINITIONS.length;
  const found = adventure?.stamps?.filter((stamp) => stamp.found).length ?? 0;
  return { found, total, completed: total > 0 && found === total };
}
