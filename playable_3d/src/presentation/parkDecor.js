import { GRID_SIZE } from "../core/catalog.js";

export const PARK_DECOR_SCHEMA = "axm.themepark.park-decor/v1";
export const PARK_ANIMATED_PATH_TILE_STRIDE = 9;
export const PARK_NATURE_ACCENT_TILE_STRIDE = 7;
export const PARK_ANIMATED_PATH_TILE_BUDGET = Math.ceil(
  GRID_SIZE * GRID_SIZE / PARK_ANIMATED_PATH_TILE_STRIDE
);
export const PARK_NATURE_ACCENT_TILE_BUDGET = Math.ceil(
  GRID_SIZE * GRID_SIZE / PARK_NATURE_ACCENT_TILE_STRIDE
);

const safeCell = (value) => {
  const cell = Math.floor(Number(value) || 0);
  return ((cell % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
};

export function stableVisualPhase(value) {
  let hash = 2166136261;
  for (const char of String(value ?? "park-decor")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}

/** Stable decoration routing only; it never owns or changes a path cell. */
export function pathDecorDescriptor(x, z, type = "path") {
  const cellX = safeCell(x);
  const cellZ = safeCell(z);
  const cellIndex = cellZ * GRID_SIZE + cellX;
  const queue = type === "queue";
  return Object.freeze({
    schema: PARK_DECOR_SCHEMA,
    cellX,
    cellZ,
    cellIndex,
    queue,
    animatedAccent: cellIndex % PARK_ANIMATED_PATH_TILE_STRIDE === 0,
    natureAccent: !queue && cellIndex % PARK_NATURE_ACCENT_TILE_STRIDE === 0,
    variant: (cellX * 11 + cellZ * 17) % 4,
    phase: stableVisualPhase(`${cellX},${cellZ},${queue ? "queue" : "path"}`)
  });
}
