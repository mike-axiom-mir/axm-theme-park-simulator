export const COASTER_DESIGN_SCHEMA = "axm.themepark.coaster-design/v1";
export const COASTER_STUDIO_LIMITS = Object.freeze({
  gridSize: 24,
  minNodes: 4,
  maxNodes: 48,
  maxDecorations: 80,
  maxHeight: 18,
  maxBank: 60
});

export const COASTER_DECORATIONS = Object.freeze({
  tree: Object.freeze({ id: "tree", label: "Tree", icon: "♣", footprint: 1 }),
  lantern: Object.freeze({ id: "lantern", label: "Lantern", icon: "†", footprint: 1 }),
  rock: Object.freeze({ id: "rock", label: "Rock", icon: "◆", footprint: 1 }),
  flowers: Object.freeze({ id: "flowers", label: "Flowers", icon: "✿", footprint: 1 }),
  arch: Object.freeze({ id: "arch", label: "Track arch", icon: "⌒", footprint: 2 }),
  sign: Object.freeze({ id: "sign", label: "Theme sign", icon: "▰", footprint: 1 }),
  water: Object.freeze({ id: "water", label: "Water patch", icon: "≈", footprint: 2 })
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));

function cleanName(value, fallback = "Untitled Coaster") {
  const text = String(value ?? "").trim().replace(/[\u0000-\u001f]/g, "");
  return (text || fallback).slice(0, 48);
}

function cleanColor(value, fallback) {
  const text = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
}

function normalizeNode(node, index) {
  return {
    id: String(node?.id ?? `node-${index + 1}`).slice(0, 40),
    x: round(clamp(node?.x, 0, COASTER_STUDIO_LIMITS.gridSize), 2),
    z: round(clamp(node?.z, 0, COASTER_STUDIO_LIMITS.gridSize), 2),
    height: round(clamp(node?.height, 0, COASTER_STUDIO_LIMITS.maxHeight), 2),
    bank: round(clamp(node?.bank, -COASTER_STUDIO_LIMITS.maxBank, COASTER_STUDIO_LIMITS.maxBank), 1)
  };
}

function normalizeDecoration(item, index) {
  const type = Object.hasOwn(COASTER_DECORATIONS, item?.type) ? item.type : "tree";
  return {
    id: String(item?.id ?? `decor-${index + 1}`).slice(0, 40),
    type,
    x: round(clamp(item?.x, 0, COASTER_STUDIO_LIMITS.gridSize), 2),
    z: round(clamp(item?.z, 0, COASTER_STUDIO_LIMITS.gridSize), 2),
    rotation: round(((Number(item?.rotation) || 0) % 360 + 360) % 360, 1),
    scale: round(clamp(item?.scale ?? 1, 0.5, 2), 2)
  };
}

function defaultNodes() {
  return [
    { id: "node-1", x: 5, z: 6, height: 1.5, bank: 0 },
    { id: "node-2", x: 12, z: 4, height: 9, bank: 8 },
    { id: "node-3", x: 19, z: 7, height: 15, bank: -12 },
    { id: "node-4", x: 20, z: 15, height: 4, bank: -28 },
    { id: "node-5", x: 12, z: 20, height: 7, bank: 24 },
    { id: "node-6", x: 4, z: 15, height: 2, bank: 10 }
  ];
}

export function createCoasterDesign({ name = "Moonroot Custom", seed = "coaster-draft" } = {}) {
  return normalizeCoasterDesign({
    schema: COASTER_DESIGN_SCHEMA,
    name,
    seed: String(seed),
    closed: true,
    style: {
      trackColor: "#e35f68",
      supportColor: "#55646d",
      trainColor: "#f0c766",
      accentColor: "#65bed1"
    },
    nodes: defaultNodes(),
    decorations: [],
    nextNodeId: 7,
    nextDecorationId: 1
  });
}

export function normalizeCoasterDesign(input) {
  const nodes = (Array.isArray(input?.nodes) ? input.nodes : defaultNodes())
    .slice(0, COASTER_STUDIO_LIMITS.maxNodes)
    .map(normalizeNode);
  while (nodes.length < COASTER_STUDIO_LIMITS.minNodes) {
    const index = nodes.length;
    nodes.push(normalizeNode({ x: 4 + index * 4, z: 4 + (index % 2) * 8, height: 1 }, index));
  }

  const decorations = (Array.isArray(input?.decorations) ? input.decorations : [])
    .slice(0, COASTER_STUDIO_LIMITS.maxDecorations)
    .map(normalizeDecoration);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const decorIds = new Set(decorations.map((item) => item.id));
  const highestNodeId = nodes.reduce((max, node) => {
    const match = /(?:node-)?(\d+)$/.exec(node.id);
    return Math.max(max, Number(match?.[1]) || 0);
  }, 0);
  const highestDecorId = decorations.reduce((max, item) => {
    const match = /(?:decor-)?(\d+)$/.exec(item.id);
    return Math.max(max, Number(match?.[1]) || 0);
  }, 0);

  const result = {
    schema: COASTER_DESIGN_SCHEMA,
    name: cleanName(input?.name),
    seed: String(input?.seed ?? "coaster-draft").slice(0, 80),
    closed: true,
    style: {
      trackColor: cleanColor(input?.style?.trackColor, "#e35f68"),
      supportColor: cleanColor(input?.style?.supportColor, "#55646d"),
      trainColor: cleanColor(input?.style?.trainColor, "#f0c766"),
      accentColor: cleanColor(input?.style?.accentColor, "#65bed1")
    },
    nodes,
    decorations,
    nextNodeId: Math.max(highestNodeId + 1, Math.floor(Number(input?.nextNodeId) || 1)),
    nextDecorationId: Math.max(highestDecorId + 1, Math.floor(Number(input?.nextDecorationId) || 1))
  };
  if (nodeIds.size !== nodes.length) {
    result.nodes = nodes.map((node, index) => ({ ...node, id: `node-${index + 1}` }));
    result.nextNodeId = result.nodes.length + 1;
  }
  if (decorIds.size !== decorations.length) {
    result.decorations = decorations.map((item, index) => ({ ...item, id: `decor-${index + 1}` }));
    result.nextDecorationId = result.decorations.length + 1;
  }
  return result;
}

export function cloneCoasterDesign(design) {
  return normalizeCoasterDesign(structuredClone(design));
}

export function addTrackNode(design, point = {}, afterId = null) {
  const next = cloneCoasterDesign(design);
  if (next.nodes.length >= COASTER_STUDIO_LIMITS.maxNodes) return next;
  const node = normalizeNode({ ...point, id: `node-${next.nextNodeId++}` }, next.nodes.length);
  const index = afterId ? next.nodes.findIndex((item) => item.id === afterId) : -1;
  if (index >= 0) next.nodes.splice(index + 1, 0, node);
  else next.nodes.push(node);
  return next;
}

export function updateTrackNode(design, nodeId, patch = {}) {
  const next = cloneCoasterDesign(design);
  const index = next.nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return next;
  next.nodes[index] = normalizeNode({ ...next.nodes[index], ...patch, id: next.nodes[index].id }, index);
  return next;
}

export function removeTrackNode(design, nodeId) {
  const next = cloneCoasterDesign(design);
  if (next.nodes.length <= COASTER_STUDIO_LIMITS.minNodes) return next;
  next.nodes = next.nodes.filter((node) => node.id !== nodeId);
  return next;
}

export function setCoasterStyle(design, patch = {}) {
  const next = cloneCoasterDesign(design);
  next.style = {
    trackColor: cleanColor(patch.trackColor ?? next.style.trackColor, next.style.trackColor),
    supportColor: cleanColor(patch.supportColor ?? next.style.supportColor, next.style.supportColor),
    trainColor: cleanColor(patch.trainColor ?? next.style.trainColor, next.style.trainColor),
    accentColor: cleanColor(patch.accentColor ?? next.style.accentColor, next.style.accentColor)
  };
  if (patch.name !== undefined) next.name = cleanName(patch.name, next.name);
  return next;
}

export function addCoasterDecoration(design, type, point = {}) {
  const next = cloneCoasterDesign(design);
  if (!Object.hasOwn(COASTER_DECORATIONS, type)) return next;
  if (next.decorations.length >= COASTER_STUDIO_LIMITS.maxDecorations) return next;
  next.decorations.push(normalizeDecoration({
    ...point,
    id: `decor-${next.nextDecorationId++}`,
    type
  }, next.decorations.length));
  return next;
}

export function updateCoasterDecoration(design, decorationId, patch = {}) {
  const next = cloneCoasterDesign(design);
  const index = next.decorations.findIndex((item) => item.id === decorationId);
  if (index < 0) return next;
  next.decorations[index] = normalizeDecoration({
    ...next.decorations[index],
    ...patch,
    id: next.decorations[index].id,
    type: next.decorations[index].type
  }, index);
  return next;
}

export function removeCoasterDecoration(design, decorationId) {
  const next = cloneCoasterDesign(design);
  next.decorations = next.decorations.filter((item) => item.id !== decorationId);
  return next;
}

function segmentDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z, b.height - a.height);
}

export function coasterDesignMetrics(design) {
  const normalized = normalizeCoasterDesign(design);
  let trackLength = 0;
  let maxDrop = 0;
  let totalElevationChange = 0;
  let totalBank = 0;
  for (let index = 0; index < normalized.nodes.length; index += 1) {
    const current = normalized.nodes[index];
    const next = normalized.nodes[(index + 1) % normalized.nodes.length];
    trackLength += segmentDistance(current, next);
    maxDrop = Math.max(maxDrop, current.height - next.height);
    totalElevationChange += Math.abs(next.height - current.height);
    totalBank += Math.abs(current.bank);
  }
  const maxHeight = Math.max(...normalized.nodes.map((node) => node.height));
  const averageBank = totalBank / normalized.nodes.length;
  const intensityEstimate = clamp(
    0.18 + maxHeight / 32 + maxDrop / 24 + averageBank / 150 + totalElevationChange / Math.max(80, trackLength * 4),
    0.18,
    1
  );
  return Object.freeze({
    trackLength: round(trackLength, 1),
    maxHeight: round(maxHeight, 1),
    maxDrop: round(maxDrop, 1),
    averageBank: round(averageBank, 1),
    decorationCount: normalized.decorations.length,
    nodeCount: normalized.nodes.length,
    intensityEstimate: round(intensityEstimate, 2)
  });
}

export function validateCoasterDesign(design) {
  const normalized = normalizeCoasterDesign(design);
  const issues = [];
  if (normalized.nodes.length < COASTER_STUDIO_LIMITS.minNodes) issues.push("At least four track nodes are required.");
  if (normalized.nodes.length > COASTER_STUDIO_LIMITS.maxNodes) issues.push("Track node budget exceeded.");
  if (normalized.decorations.length > COASTER_STUDIO_LIMITS.maxDecorations) issues.push("Decoration budget exceeded.");
  const metrics = coasterDesignMetrics(normalized);
  if (metrics.trackLength < 18) issues.push("Track layout is too short for a closed coaster circuit.");
  const uniqueCells = new Set(normalized.nodes.map((node) => `${Math.round(node.x)},${Math.round(node.z)}`));
  if (uniqueCells.size < 4) issues.push("Track nodes need more spatial separation.");
  return Object.freeze({
    ok: issues.length === 0,
    issues: Object.freeze(issues),
    metrics,
    normalized
  });
}

export function serializeCoasterDesign(design) {
  const check = validateCoasterDesign(design);
  if (!check.ok) throw new Error(`Coaster design is not exportable: ${check.issues.join(" ")}`);
  return JSON.stringify({
    schema: COASTER_DESIGN_SCHEMA,
    version: 1,
    design: check.normalized
  }, null, 2);
}

export function deserializeCoasterDesign(text) {
  const payload = JSON.parse(String(text));
  if (payload?.schema !== COASTER_DESIGN_SCHEMA || payload?.version !== 1) {
    throw new Error("Not an AXM Coaster Studio v1 design.");
  }
  const check = validateCoasterDesign(payload.design);
  if (!check.ok) throw new Error(`Invalid coaster design: ${check.issues.join(" ")}`);
  return check.normalized;
}
