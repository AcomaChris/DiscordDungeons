// --- groupTiles.js ---
// Step 3: Group multi-tile objects by analyzing edge pixel similarity.
// Adjacent tiles with similar touching edges are grouped together.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const GROUP_ZOOM = 8;
const EDGE_DEPTH = 2; // Pixels deep to sample from each edge

// --- Group Size & Sparsity Limits ---
// AGENT: These limits prevent transitive merges from creating oversized,
// sparse groups. Adjust thresholds cautiously — lower MAX_GROUP_DIM or
// higher MIN_FILL_RATE produces more but tighter groups.
export const MAX_GROUP_DIM = 6;      // Max tiles in any single dimension (cols or rows)
export const MIN_FILL_RATE = 0.6;    // Minimum ratio of filled tiles within bounding box

export async function groupTiles(ctx) {
  const outDir = join(ctx.outputBase, 'step3');
  const groupsDir = join(outDir, 'groups');
  mkdirSync(groupsDir, { recursive: true });

  const info = readInfo(ctx);
  const { tileSize, columns: cols, rows } = info;
  const threshold = ctx.threshold;

  const img = await loadImage(ctx.imagePath);
  const fullCanvas = createCanvas(img.width, img.height);
  const fc = fullCanvas.getContext('2d');
  fc.drawImage(img, 0, 0);
  const imageData = fc.getImageData(0, 0, img.width, img.height);
  const pixels = imageData.data;

  console.log(`Grid: ${cols}x${rows}, threshold: ${threshold}`);

  // --- Classify tiles as transparent or opaque ---
  const transparent = new Set();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (isTileTransparent(pixels, img.width, col, row, tileSize)) {
        transparent.add(row * cols + col);
      }
    }
  }
  console.log(`  ${transparent.size} transparent tiles, ${cols * rows - transparent.size} opaque`);

  // --- Build adjacency graph ---
  // connections[idx] = Set of connected neighbor indices
  const connections = new Map();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (transparent.has(idx)) continue;

      // Check right neighbor
      if (col + 1 < cols) {
        const rightIdx = row * cols + (col + 1);
        if (!transparent.has(rightIdx)) {
          const dist = horizontalEdgeDistance(
            pixels, img.width, col, row, col + 1, row, tileSize,
          );
          if (dist < threshold) {
            addConnection(connections, idx, rightIdx);
          }
        }
      }

      // Check bottom neighbor
      if (row + 1 < rows) {
        const bottomIdx = (row + 1) * cols + col;
        if (!transparent.has(bottomIdx)) {
          const dist = verticalEdgeDistance(
            pixels, img.width, col, row, col, row + 1, tileSize,
          );
          if (dist < threshold) {
            addConnection(connections, idx, bottomIdx);
          }
        }
      }
    }
  }

  // --- Build connected components with size/sparsity limits ---
  const visited = new Set();
  const groups = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (transparent.has(idx) || visited.has(idx)) continue;

      // BFS to find connected component, enforcing size/sparsity limits.
      // Tiles that fail the constraint check are left unvisited so they
      // can seed their own (smaller) group on a later iteration.
      // memberCount tracks all accepted tiles (queued + processed) for
      // accurate fill rate calculation.
      const component = [];
      let memberCount = 1; // seed tile is already accepted
      let cMinCol = col, cMaxCol = col;
      let cMinRow = row, cMaxRow = row;

      const queue = [idx];
      visited.add(idx);

      while (queue.length > 0) {
        const current = queue.shift();
        component.push(current);

        const neighbors = connections.get(current);
        if (!neighbors) continue;
        for (const n of neighbors) {
          if (visited.has(n)) continue;

          // Check if adding this neighbor would violate constraints
          const nc = n % cols;
          const nr = Math.floor(n / cols);
          const newMinCol = Math.min(cMinCol, nc);
          const newMaxCol = Math.max(cMaxCol, nc);
          const newMinRow = Math.min(cMinRow, nr);
          const newMaxRow = Math.max(cMaxRow, nr);
          const newW = newMaxCol - newMinCol + 1;
          const newH = newMaxRow - newMinRow + 1;

          // Reject if bounding box exceeds max dimension
          if (newW > MAX_GROUP_DIM || newH > MAX_GROUP_DIM) continue;

          // Reject if fill rate drops below threshold
          const newArea = newW * newH;
          if ((memberCount + 1) / newArea < MIN_FILL_RATE) continue;

          // Accept this tile into the group
          visited.add(n);
          queue.push(n);
          memberCount++;
          cMinCol = newMinCol;
          cMaxCol = newMaxCol;
          cMinRow = newMinRow;
          cMaxRow = newMaxRow;
        }
      }

      // Final bounding box from component
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
  }

  console.log(`  Found ${groups.length} groups`);

  // --- Render group composite images ---
  for (const group of groups) {
    const gw = group.cols * tileSize * GROUP_ZOOM;
    const gh = group.rows * tileSize * GROUP_ZOOM;
    const canvas = createCanvas(gw, gh);
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;

    // Transparent background (default)

    // Draw each tile in the group at its relative position
    for (const tIdx of group.tiles) {
      const tc = tIdx % cols;
      const tr = Math.floor(tIdx / cols);
      const relCol = tc - group.topLeft.col;
      const relRow = tr - group.topLeft.row;

      c.drawImage(
        img,
        tc * tileSize, tr * tileSize, tileSize, tileSize,
        relCol * tileSize * GROUP_ZOOM, relRow * tileSize * GROUP_ZOOM,
        tileSize * GROUP_ZOOM, tileSize * GROUP_ZOOM,
      );
    }

    const path = join(groupsDir, `group-${String(group.id).padStart(3, '0')}.png`);
    writeFileSync(path, canvas.toBuffer('image/png'));
  }
  console.log(`  Saved ${groups.length} group images to ${groupsDir}/`);

  // --- Save groups.json ---
  const groupsPath = join(outDir, 'groups.json');
  writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
  console.log(`  Saved ${groupsPath}`);

  // --- Summary ---
  const singles = groups.filter((g) => g.tiles.length === 1).length;
  const multis = groups.filter((g) => g.tiles.length > 1).length;
  console.log(`  Singles: ${singles}, Multi-tile groups: ${multis}`);

  // Show largest groups
  const sorted = [...groups].sort((a, b) => b.tiles.length - a.tiles.length);
  for (const g of sorted.slice(0, 5)) {
    console.log(`    Group ${g.id}: ${g.cols}x${g.rows} (${g.tiles.length} tiles) at (${g.topLeft.col}, ${g.topLeft.row})`);
  }
}

// --- Pixel Analysis Helpers ---

function isTileTransparent(pixels, imgWidth, col, row, tileSize) {
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

// Average color distance between rightmost EDGE_DEPTH columns of tile A
// and leftmost EDGE_DEPTH columns of tile B (horizontal neighbors)
function horizontalEdgeDistance(pixels, imgWidth, colA, rowA, colB, rowB, tileSize) {
  let totalDist = 0;
  let count = 0;

  for (let dy = 0; dy < tileSize; dy++) {
    for (let d = 0; d < EDGE_DEPTH; d++) {
      // Right edge of A
      const ax = colA * tileSize + (tileSize - 1 - d);
      const ay = rowA * tileSize + dy;
      // Left edge of B
      const bx = colB * tileSize + d;
      const by = rowB * tileSize + dy;

      const ai = (ay * imgWidth + ax) * 4;
      const bi = (by * imgWidth + bx) * 4;

      // Skip if either pixel is transparent
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

// Average color distance between bottommost EDGE_DEPTH rows of tile A
// and topmost EDGE_DEPTH rows of tile B (vertical neighbors)
function verticalEdgeDistance(pixels, imgWidth, colA, rowA, colB, rowB, tileSize) {
  let totalDist = 0;
  let count = 0;

  for (let dx = 0; dx < tileSize; dx++) {
    for (let d = 0; d < EDGE_DEPTH; d++) {
      // Bottom edge of A
      const ax = colA * tileSize + dx;
      const ay = rowA * tileSize + (tileSize - 1 - d);
      // Top edge of B
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

function addConnection(map, a, b) {
  if (!map.has(a)) map.set(a, new Set());
  if (!map.has(b)) map.set(b, new Set());
  map.get(a).add(b);
  map.get(b).add(a);
}

// --- Pure Grouping Logic (exported for testing) ---

// Build connected-component groups from an adjacency graph with size/sparsity limits.
// Parameters:
//   connections — Map<tileIdx, Set<neighborIdx>> adjacency graph
//   opaqueTiles — Set<tileIdx> of non-transparent tiles to group
//   cols — number of columns in the tile grid
//   opts — { maxGroupDim, minFillRate } optional overrides
// Returns: Array of { id, tiles, cols, rows, topLeft }
export function buildGroups(connections, opaqueTiles, cols, opts = {}) {
  const maxDim = opts.maxGroupDim ?? MAX_GROUP_DIM;
  const minFR = opts.minFillRate ?? MIN_FILL_RATE;

  const visited = new Set();
  const groups = [];

  // Process tiles in row-major order for deterministic results
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

function readInfo(ctx) {
  try {
    const infoPath = join(ctx.outputBase, 'step2', 'info.json');
    return JSON.parse(readFileSync(infoPath, 'utf-8'));
  } catch {
    // Fallback: calculate from image if step 2 hasn't run
    const resultPath = join(ctx.outputBase, 'step1', 'result.json');
    try {
      const result = JSON.parse(readFileSync(resultPath, 'utf-8'));
      const tileSize = ctx.forcedSize || result.detectedSize;
      return {
        tileSize,
        columns: Math.floor(result.imageWidth / tileSize),
        rows: Math.floor(result.imageHeight / tileSize),
      };
    } catch {
      if (ctx.forcedSize) {
        // Can still work with just the forced size and image dimensions
        return { tileSize: ctx.forcedSize, columns: 0, rows: 0 };
      }
      console.error('Run step 1 or 2 first, or use --size <px>.');
      process.exit(1);
    }
  }
}
