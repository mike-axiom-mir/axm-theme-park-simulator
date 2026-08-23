export const cellKey = (x, z) => `${x},${z}`;

export function parseCell(key) {
  return key.split(",").map(Number);
}

export function neighbors(x, z, size) {
  return [
    [x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]
  ].filter(([nx, nz]) => nx >= 0 && nz >= 0 && nx < size && nz < size);
}

export function findPath(pathKeys, start, targets, size) {
  const allowed = pathKeys instanceof Set ? pathKeys : new Set(pathKeys);
  const targetKeys = new Set(targets.map(([x, z]) => cellKey(x, z)));
  const startKey = cellKey(start[0], start[1]);
  if (targetKeys.has(startKey)) return [start];
  if (!allowed.has(startKey)) return [];

  const queue = [start];
  let cursor = 0;
  const parents = new Map([[startKey, null]]);

  while (cursor < queue.length) {
    const [x, z] = queue[cursor++];
    for (const [nx, nz] of neighbors(x, z, size)) {
      const key = cellKey(nx, nz);
      if (!allowed.has(key) || parents.has(key)) continue;
      parents.set(key, cellKey(x, z));
      if (targetKeys.has(key)) {
        const result = [[nx, nz]];
        let previous = parents.get(key);
        while (previous) {
          result.push(parseCell(previous));
          previous = parents.get(previous);
        }
        return result.reverse();
      }
      queue.push([nx, nz]);
    }
  }
  return [];
}

export function reachablePathKeys(pathKeys, entrance, size) {
  const allowed = pathKeys instanceof Set ? pathKeys : new Set(pathKeys);
  const reached = new Set();
  const startKey = cellKey(entrance[0], entrance[1]);
  if (!allowed.has(startKey)) return reached;
  const queue = [entrance];
  let cursor = 0;
  reached.add(startKey);
  while (cursor < queue.length) {
    const [x, z] = queue[cursor++];
    for (const [nx, nz] of neighbors(x, z, size)) {
      const key = cellKey(nx, nz);
      if (!allowed.has(key) || reached.has(key)) continue;
      reached.add(key);
      queue.push([nx, nz]);
    }
  }
  return reached;
}
