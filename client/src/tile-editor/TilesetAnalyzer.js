// --- TilesetAnalyzer ---
// Browser-side pixel analysis engine for tileset images.
// Ports the pure analysis functions from scripts/tile-analyzer/groupTiles.js
// to work with browser Canvas API instead of @napi-rs/canvas.
// All functions are pure — no DOM side effects.

const EDGE_DEPTH = 2; // Pixels deep to sample from each edge
const MAX_GROUP_DIM = 6;
const MIN_FILL_RATE = 0.6;

// --- Pixel Analysis ---

// A tile is transparent if its average alpha is < 10/255.
export function isTileTransparent(pixels, imgWidth, col, row, tileSize) {
  let totalAlpha = 0;
  const count = tileSize * tileSize;
  for (let dy = 0; dy < tileSize; dy++) {
    for (let dx = 0; dx < tileSize; dx++) {
      const px = col * tileSize + dx;
      const py = row * tileSize + dy;
      const i = (py * imgWidth + px) * 4;
      totalAlpha += pixels[i + 3];
    }
  }
  return (totalAlpha / count) < 10;
}

// Average color distance between right edge of tile A and left edge of tile B.
export function horizontalEdgeDistance(pixels, imgWidth, colA, rowA, colB, rowB, tileSize) {
  let totalDist = 0;
  let count = 0;

  for (let dy = 0; dy < tileSize; dy++) {
    for (let d = 0; d < EDGE_DEPTH; d++) {
      const ax = colA * tileSize + (tileSize - 1 - d);
      const ay = rowA * tileSize + dy;
      const bx = colB * tileSize + d;
      const by = rowB * tileSize + dy;

      const ai = (ay * imgWidth + ax) * 4;
      const bi = (by * imgWidth + bx) * 4;

      if (pixels[ai + 3] < 10 || pixels[bi + 3] < 10) continue;

      const dr = pixels[ai] - pixels[bi];
      const dg = pixels[ai + 1] - pixels[bi + 1];
      const db = pixels[ai + 2] - pixels[bi + 2];
      totalDist += Math.sqrt(dr * dr + dg * dg + db * db);
      count++;
    }
  }

  return count > 0 ? totalDist / count : 999;
}

// Average color distance between bottom edge of tile A and top edge of tile B.
export function verticalEdgeDistance(pixels, imgWidth, colA, rowA, colB, rowB, tileSize) {
  let totalDist = 0;
  let count = 0;

  for (let dx = 0; dx < tileSize; dx++) {
    for (let d = 0; d < EDGE_DEPTH; d++) {
      const ax = colA * tileSize + dx;
      const ay = rowA * tileSize + (tileSize - 1 - d);
      const bx = colB * tileSize + dx;
      const by = rowB * tileSize + d;

      const ai = (ay * imgWidth + ax) * 4;
      const bi = (by * imgWidth + bx) * 4;

      if (pixels[ai + 3] < 10 || pixels[bi + 3] < 10) continue;

      const dr = pixels[ai] - pixels[bi];
      const dg = pixels[ai + 1] - pixels[bi + 1];
      const db = pixels[ai + 2] - pixels[bi + 2];
      totalDist += Math.sqrt(dr * dr + dg * dg + db * db);
      count++;
    }
  }

  return count > 0 ? totalDist / count : 999;
}

// --- Adjacency Graph ---

function addConnection(map, a, b) {
  if (!map.has(a)) map.set(a, new Set());
  if (!map.has(b)) map.set(b, new Set());
  map.get(a).add(b);
  map.get(b).add(a);
}

// Build adjacency graph from pixel data. Returns { connections, transparent, opaque }.
export function buildAdjacencyGraph(pixels, imgWidth, cols, rows, tileSize, threshold) {
  const transparent = new Set();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (isTileTransparent(pixels, imgWidth, col, row, tileSize)) {
        transparent.add(row * cols + col);
      }
    }
  }

  const connections = new Map();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (transparent.has(idx)) continue;

      // Check right neighbor
      if (col + 1 < cols) {
        const rightIdx = row * cols + (col + 1);
        if (!transparent.has(rightIdx)) {
          const dist = horizontalEdgeDistance(pixels, imgWidth, col, row, col + 1, row, tileSize);
          if (dist < threshold) addConnection(connections, idx, rightIdx);
        }
      }

      // Check bottom neighbor
      if (row + 1 < rows) {
        const bottomIdx = (row + 1) * cols + col;
        if (!transparent.has(bottomIdx)) {
          const dist = verticalEdgeDistance(pixels, imgWidth, col, row, col, row + 1, tileSize);
          if (dist < threshold) addConnection(connections, idx, bottomIdx);
        }
      }
    }
  }

  const opaque = new Set();
  const total = cols * rows;
  for (let i = 0; i < total; i++) {
    if (!transparent.has(i)) opaque.add(i);
  }

  return { connections, transparent, opaque };
}

// --- Group Building (direct port from groupTiles.js buildGroups) ---

// Build connected-component groups from an adjacency graph with size/sparsity limits.
export function buildGroups(connections, opaqueTiles, cols, opts = {}) {
  const maxDim = opts.maxGroupDim ?? MAX_GROUP_DIM;
  const minFR = opts.minFillRate ?? MIN_FILL_RATE;

  const visited = new Set();
  const groups = [];

  const sortedTiles = [...opaqueTiles].sort((a, b) => a - b);

  for (const idx of sortedTiles) {
    if (visited.has(idx)) continue;

    const seedCol = idx % cols;
    const seedRow = Math.floor(idx / cols);

    const component = [];
    let memberCount = 1;
    let cMinCol = seedCol, cMaxCol = seedCol;
    let cMinRow = seedRow, cMaxRow = seedRow;

    const queue = [idx];
    visited.add(idx);

    while (queue.length > 0) {
      const current = queue.shift();
      component.push(current);

      const neighbors = connections.get(current);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (visited.has(n)) continue;

        const nc = n % cols;
        const nr = Math.floor(n / cols);
        const newMinCol = Math.min(cMinCol, nc);
        const newMaxCol = Math.max(cMaxCol, nc);
        const newMinRow = Math.min(cMinRow, nr);
        const newMaxRow = Math.max(cMaxRow, nr);
        const newW = newMaxCol - newMinCol + 1;
        const newH = newMaxRow - newMinRow + 1;

        if (newW > maxDim || newH > maxDim) continue;
        const newArea = newW * newH;
        if ((memberCount + 1) / newArea < minFR) continue;

        visited.add(n);
        queue.push(n);
        memberCount++;
        cMinCol = newMinCol;
        cMaxCol = newMaxCol;
        cMinRow = newMinRow;
        cMaxRow = newMaxRow;
      }
    }

    let minCol = Infinity, maxCol = -Infinity;
    let minRow = Infinity, maxRow = -Infinity;
    for (const tIdx of component) {
      const tc = tIdx % cols;
      const tr = Math.floor(tIdx / cols);
      minCol = Math.min(minCol, tc);
      maxCol = Math.max(maxCol, tc);
      minRow = Math.min(minRow, tr);
      maxRow = Math.max(maxRow, tr);
    }

    groups.push({
      id: groups.length,
      tiles: component.sort((a, b) => a - b),
      cols: maxCol - minCol + 1,
      rows: maxRow - minRow + 1,
      topLeft: { col: minCol, row: minRow },
    });
  }

  return groups;
}

// --- Color Profile ---

// Compute average color in HSL for a group of tiles.
export function computeColorProfile(pixels, tileIndices, cols, tileSize, imgWidth) {
  let totalR = 0, totalG = 0, totalB = 0, count = 0;

  for (const idx of tileIndices) {
    const tileCol = idx % cols;
    const tileRow = Math.floor(idx / cols);

    for (let dy = 0; dy < tileSize; dy++) {
      for (let dx = 0; dx < tileSize; dx++) {
        const px = tileCol * tileSize + dx;
        const py = tileRow * tileSize + dy;
        const i = (py * imgWidth + px) * 4;

        if (pixels[i + 3] < 10) continue; // skip transparent

        totalR += pixels[i];
        totalG += pixels[i + 1];
        totalB += pixels[i + 2];
        count++;
      }
    }
  }

  if (count === 0) return { hue: 0, sat: 0, light: 0 };

  const r = totalR / count / 255;
  const g = totalG / count / 255;
  const b = totalB / count / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  const delta = max - min;

  let hue = 0;
  let sat = 0;

  if (delta > 0.001) {
    sat = light > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) hue = ((b - r) / delta + 2) / 6;
    else hue = ((r - g) / delta + 4) / 6;
  }

  return { hue: hue * 360, sat, light };
}

// --- Category Classification ---

// Guess object category from color profile and grid dimensions.
export function classifyCategory(colorProfile, groupCols, groupRows) {
  const { hue, sat, light } = colorProfile;

  // 1×1 tiles are likely decorations
  if (groupCols === 1 && groupRows === 1) return 'decoration';

  // Green and saturated → nature
  if (hue >= 80 && hue <= 160 && sat > 0.2) return 'nature';

  // Warm and bright → lighting
  if (hue >= 20 && hue <= 60 && light > 0.6 && sat > 0.3) return 'lighting';

  // Grey (low saturation) → structure
  if (sat < 0.15) return 'structure';

  // Brown/orange (warm, medium saturation) → furniture for small, structure for large
  if (hue >= 10 && hue <= 45 && sat >= 0.15) {
    const area = groupCols * groupRows;
    if (area <= 6) return 'furniture';
    return 'structure';
  }

  // Long/thin → structure (walls, counters)
  if (groupCols >= 4 && groupRows === 1) return 'structure';
  if (groupRows >= 4 && groupCols === 1) return 'structure';

  return 'decoration';
}

// --- Main Analysis Entry Point ---

// Analyze a tileset image. Returns { groups, transparent }.
// imageEl: an HTMLImageElement or any CanvasImageSource
// tileSize: tile size in pixels (usually 16)
// threshold: edge similarity threshold (lower = stricter grouping)
export function analyzeTileset(imageEl, tileSize, threshold = 30) {
  const width = imageEl.naturalWidth || imageEl.width;
  const height = imageEl.naturalHeight || imageEl.height;
  const cols = Math.floor(width / tileSize);
  const rows = Math.floor(height / tileSize);

  // Extract pixel data via offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageEl, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height).data;

  const { connections, transparent, opaque } = buildAdjacencyGraph(
    pixels, width, cols, rows, tileSize, threshold,
  );

  const groups = buildGroups(connections, opaque, cols);

  // Add color profiles and category guesses to each group
  for (const group of groups) {
    group.colorProfile = computeColorProfile(pixels, group.tiles, cols, tileSize, width);
    group.category = classifyCategory(group.colorProfile, group.cols, group.rows);
  }

  return { groups, transparent, cols, rows };
}
