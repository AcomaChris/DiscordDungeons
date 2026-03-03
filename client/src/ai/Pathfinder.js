// --- Pathfinder ---
// Grid-based A* pathfinding on the collision layer. Pure functions, no Phaser
// dependency — testable with plain 2D arrays.
// 4-directional movement (no diagonal) to match the game's movement style.

// --- Collision Grid ---
// Reads the Phaser collision layer and builds a boolean 2D grid.
// true = blocked, false = walkable.

export function buildCollisionGrid(collisionLayer, mapWidth, mapHeight) {
  const grid = [];
  for (let y = 0; y < mapHeight; y++) {
    const row = [];
    for (let x = 0; x < mapWidth; x++) {
      const tile = collisionLayer.getTileAt(x, y);
      row.push(tile !== null && tile.index > 0);
    }
    grid.push(row);
  }
  return grid;
}

// --- A* Search ---
// Returns array of { tx, ty } tile coordinates from start to end (inclusive),
// or null if no path exists. Start tile is excluded from the result.

const DIRS = [
  { dx: 0, dy: -1 }, // north
  { dx: 0, dy: 1 },  // south
  { dx: 1, dy: 0 },  // east
  { dx: -1, dy: 0 }, // west
];

export function findPath(grid, start, end) {
  const height = grid.length;
  if (height === 0) return null;
  const width = grid[0].length;

  // Bounds check
  if (start.tx < 0 || start.tx >= width || start.ty < 0 || start.ty >= height) return null;
  if (end.tx < 0 || end.tx >= width || end.ty < 0 || end.ty >= height) return null;

  // Target is blocked
  if (grid[end.ty][end.tx]) return null;

  // Start = end
  if (start.tx === end.tx && start.ty === end.ty) return [];

  // A* with Manhattan heuristic
  const key = (x, y) => y * width + x;
  const h = (x, y) => Math.abs(x - end.tx) + Math.abs(y - end.ty);

  const open = new Map(); // key → { x, y, g, f }
  const closed = new Set();
  const cameFrom = new Map(); // key → parentKey

  const startKey = key(start.tx, start.ty);
  const startG = 0;
  open.set(startKey, { x: start.tx, y: start.ty, g: startG, f: startG + h(start.tx, start.ty) });

  while (open.size > 0) {
    // Find node with lowest f score
    let bestKey = null;
    let bestF = Infinity;
    for (const [k, node] of open) {
      if (node.f < bestF) {
        bestF = node.f;
        bestKey = k;
      }
    }

    const current = open.get(bestKey);
    open.delete(bestKey);
    closed.add(bestKey);

    // Goal reached — reconstruct path
    if (current.x === end.tx && current.y === end.ty) {
      const path = [];
      let k = bestKey;
      while (k !== undefined && k !== startKey) {
        const x = k % width;
        const y = Math.floor(k / width);
        path.push({ tx: x, ty: y });
        k = cameFrom.get(k);
      }
      path.reverse();
      return path;
    }

    // Expand neighbors
    for (const { dx, dy } of DIRS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (grid[ny][nx]) continue; // blocked

      const nKey = key(nx, ny);
      if (closed.has(nKey)) continue;

      const g = current.g + 1;
      const existing = open.get(nKey);
      if (existing && g >= existing.g) continue;

      open.set(nKey, { x: nx, y: ny, g, f: g + h(nx, ny) });
      cameFrom.set(nKey, bestKey);
    }
  }

  return null; // no path
}
