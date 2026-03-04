// --- SparseLayer ---
// Sparse tile storage for a single map layer. Uses a Map keyed by "x,y" strings.
// Supports infinite canvas — no fixed dimensions. Empty cells are simply absent.

export class SparseLayer {
  constructor(name) {
    this.name = name;
    this.tiles = new Map(); // "x,y" → GID (global tile ID)
  }

  get(x, y) {
    return this.tiles.get(`${x},${y}`) || 0;
  }

  set(x, y, gid) {
    if (gid === 0) {
      this.tiles.delete(`${x},${y}`);
    } else {
      this.tiles.set(`${x},${y}`, gid);
    }
  }

  delete(x, y) {
    this.tiles.delete(`${x},${y}`);
  }

  has(x, y) {
    return this.tiles.has(`${x},${y}`);
  }

  get size() {
    return this.tiles.size;
  }

  clear() {
    this.tiles.clear();
  }

  // Bounding box of all placed tiles. Returns null if empty.
  getBounds() {
    if (this.tiles.size === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const key of this.tiles.keys()) {
      const sep = key.indexOf(',');
      const x = parseInt(key.substring(0, sep), 10);
      const y = parseInt(key.substring(sep + 1), 10);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    return { minX, minY, maxX, maxY };
  }

  // Iterate all tiles: callback(x, y, gid)
  forEach(callback) {
    for (const [key, gid] of this.tiles) {
      const sep = key.indexOf(',');
      const x = parseInt(key.substring(0, sep), 10);
      const y = parseInt(key.substring(sep + 1), 10);
      callback(x, y, gid);
    }
  }

  // Create a dense 2D array from a given rectangle. Empty cells are 0.
  toDenseArray(startX, startY, width, height) {
    const data = new Array(width * height).fill(0);
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        data[dy * width + dx] = this.get(startX + dx, startY + dy);
      }
    }
    return data;
  }
}
