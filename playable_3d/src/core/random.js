export function hashString(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function nextRandom(state) {
  let x = state.rngState >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x >>> 0;
  return state.rngState / 4294967296;
}

export function randomInt(state, min, max) {
  return Math.floor(nextRandom(state) * (max - min + 1)) + min;
}

export function pick(state, items) {
  return items[Math.floor(nextRandom(state) * items.length)];
}

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function stateHash(state) {
  const clone = structuredClone(state);
  delete clone.stateHash;
  delete clone.notifications;
  return hashString(JSON.stringify(canonicalize(clone))).toString(16).padStart(8, "0");
}
