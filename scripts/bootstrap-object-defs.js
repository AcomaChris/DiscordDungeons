#!/usr/bin/env node

// --- bootstrap-object-defs.js ---
// Generates initial object definition files from tile analysis data.
// Reads groups.json + identifications.json from the tile analysis pipeline
// and outputs tileset object definitions.
//
// Usage: node scripts/bootstrap-object-defs.js <tileset-name>
// Output: client/public/object-defs/<tileset>.objects.json

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- Category Mapping ---
// Maps tile analysis categories → object definition categories.
// AGENT: Keep in sync with object-def-schema.js OBJECT_CATEGORIES.
const CATEGORY_MAP = {
  obstacle: 'furniture',
  wall: 'structure',
  stairs: 'structure',
  decor: 'decoration',
  door: 'structure',
  ceiling: 'decoration',
  floor: null, // Skip — floors aren't objects
};

// --- Default WFC Edge Assignment ---
// AGENT: Keep socket names in sync with _sockets.json.
const DEFAULT_EDGES = {
  furniture: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  structure: { north: 'wall_face', south: 'open_floor', east: 'wall_face', west: 'wall_face' },
  container: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  decoration: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  lighting: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  nature: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  effect: null,
};

// --- Helpers ---

function readJSON(path, label) {
  if (!existsSync(path)) {
    console.error(`Missing ${label} file: ${path}`);
    console.error('Run the tile analysis pipeline first (scripts/analyze-tileset.js).');
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function toTitleCase(str) {
  return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Reconstruct 2D tile grid from flat tile indices and group metadata.
// The analysis pipeline stores tile indices as flat (global within tileset),
// so we need to convert to a 2D grid relative to the group's bounding box.
function buildTileGrid(group, tilesetCols) {
  const { cols, rows, topLeft, tiles } = group;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(null));

  // Build a set of tile indices in this group for lookup
  const tileSet = new Set(tiles);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const globalCol = topLeft.col + c;
      const globalRow = topLeft.row + r;
      const tileIndex = globalRow * tilesetCols + globalCol;
      if (tileSet.has(tileIndex)) {
        grid[r][c] = tileIndex;
      }
    }
  }

  return grid;
}

// --- Collider Generation ---

// AGENT: Colliders must cover only actual non-null tiles in the grid,
// not the full bounding box. Use computeTileBounds() for tight fit,
// decomposeToRowRuns() for sparse grids with gaps.

// Compute the tightest axis-aligned bounding box around non-null tiles.
// Returns { minCol, maxCol, minRow, maxRow } or null if grid is empty.
export function computeTileBounds(tileGrid) {
  let minCol = Infinity, maxCol = -Infinity;
  let minRow = Infinity, maxRow = -Infinity;
  let found = false;

  for (let r = 0; r < tileGrid.length; r++) {
    for (let c = 0; c < tileGrid[r].length; c++) {
      if (tileGrid[r][c] !== null) {
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        found = true;
      }
    }
  }

  return found ? { minCol, maxCol, minRow, maxRow } : null;
}

// Decompose non-null tiles into horizontal row-runs (greedy).
// Each run is { col, row, span } — a contiguous horizontal strip.
// Used to generate tight colliders for sparse groups with gaps.
export function decomposeToRowRuns(tileGrid) {
  const runs = [];

  for (let r = 0; r < tileGrid.length; r++) {
    let runStart = null;
    for (let c = 0; c < tileGrid[r].length; c++) {
      if (tileGrid[r][c] !== null) {
        if (runStart === null) runStart = c;
      } else {
        if (runStart !== null) {
          runs.push({ col: runStart, row: r, span: c - runStart });
          runStart = null;
        }
      }
    }
    // Close run at row end
    if (runStart !== null) {
      runs.push({ col: runStart, row: r, span: tileGrid[r].length - runStart });
    }
  }

  return runs;
}

// Compute fill rate: ratio of non-null tiles within the tight bounding box.
function fillRate(tileGrid, bounds) {
  if (!bounds) return 0;
  const bw = bounds.maxCol - bounds.minCol + 1;
  const bh = bounds.maxRow - bounds.minRow + 1;
  let count = 0;
  for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      if (tileGrid[r][c] !== null) count++;
    }
  }
  return count / (bw * bh);
}

// AGENT: Sparsity threshold — if fill rate is below this, decompose into
// row-run colliders instead of a single bounding rect.
const COLLIDER_FILL_THRESHOLD = 0.6;

// Generate default colliders based on category, collision type, and actual tile positions.
// For dense groups (>= 60% fill), uses a single tight-fit rect around non-null tiles.
// For sparse groups (< 60% fill), decomposes into row-run rects to avoid covering empty space.
function generateColliders(group, identification, tileSize, tileGrid) {
  const collision = identification.collision;
  if (collision === 'none') return [];

  const bounds = computeTileBounds(tileGrid);
  if (!bounds) return [];

  const tightX = bounds.minCol * tileSize;
  const tightY = bounds.minRow * tileSize;
  const tightW = (bounds.maxCol - bounds.minCol + 1) * tileSize;
  const tightH = (bounds.maxRow - bounds.minRow + 1) * tileSize;

  if (collision === 'platform') {
    // Platform uses the tight bounding box for both levels
    return [
      {
        id: 'base',
        shape: 'rect',
        x: tightX,
        y: tightY + Math.floor(tightH * 0.6),
        width: tightW,
        height: Math.floor(tightH * 0.4),
        elevation: 0,
        type: 'solid',
        stretchable: group.cols > 2,
      },
      {
        id: 'surface',
        shape: 'rect',
        x: tightX,
        y: tightY,
        width: tightW,
        height: tightH,
        elevation: 1,
        type: 'platform',
        stretchable: group.cols > 2,
      },
    ];
  }

  // --- Solid collision ---
  const fr = fillRate(tileGrid, bounds);

  // Dense: single tight-fit rect
  if (fr >= COLLIDER_FILL_THRESHOLD) {
    return [
      {
        id: 'body',
        shape: 'rect',
        x: tightX,
        y: tightY,
        width: tightW,
        height: tightH,
        elevation: 0,
        type: 'solid',
        stretchable: group.cols > 2,
      },
    ];
  }

  // Sparse: decompose into row-run colliders
  const runs = decomposeToRowRuns(tileGrid);
  return runs.map((run, i) => ({
    id: `body_${i}`,
    shape: 'rect',
    x: run.col * tileSize,
    y: run.row * tileSize,
    width: run.span * tileSize,
    height: tileSize,
    elevation: 0,
    type: 'solid',
    stretchable: false,
  }));
}

// Extract tags from identification name and description.
function extractTags(identification) {
  const tags = new Set();
  const words = `${identification.name} ${identification.description}`.toLowerCase();

  const tagWords = [
    'table', 'chair', 'stool', 'bench', 'barrel', 'shelf', 'counter', 'bar',
    'sofa', 'bookshelf', 'staircase', 'stairs', 'door', 'window', 'chest',
    'plant', 'candle', 'bottle', 'potion', 'weapon', 'sword', 'shield',
    'gem', 'coin', 'scroll', 'key', 'bone', 'rock', 'mushroom', 'food',
    'wood', 'stone', 'metal', 'water', 'tavern', 'dining',
  ];

  for (const tag of tagWords) {
    if (words.includes(tag)) tags.add(tag);
  }

  return [...tags];
}

// --- Main ---

function bootstrap(tilesetName) {
  const analysisDir = join(ROOT, 'tmp/tile-analysis', tilesetName);
  const step2Dir = join(analysisDir, 'step2');
  const step3Dir = join(analysisDir, 'step3');
  const step4Dir = join(analysisDir, 'step4');

  const info = readJSON(join(step2Dir, 'info.json'), 'step 2 info');
  const groups = readJSON(join(step3Dir, 'groups.json'), 'step 3 groups');
  const identifications = readJSON(join(step4Dir, 'identifications.json'), 'step 4 identifications');

  const tileSize = info.tileSize;
  const tilesetCols = info.columns;

  // Build identification lookup
  const idMap = new Map();
  for (const ident of identifications) {
    idMap.set(ident.groupId, ident);
  }

  const objects = {};
  let skipped = 0;

  for (const group of groups) {
    const ident = idMap.get(group.id);
    if (!ident) {
      skipped++;
      continue;
    }

    // Map tile analysis category to object category
    const category = CATEGORY_MAP[ident.category];
    if (category === null) {
      skipped++;
      continue;
    }

    const objCategory = category || 'decoration';
    const tileGrid = buildTileGrid(group, tilesetCols);
    const colliders = generateColliders(group, ident, tileSize, tileGrid);
    const tags = extractTags(ident);
    const edges = DEFAULT_EDGES[objCategory];

    const objectDef = {
      id: ident.name,
      sourceGroupId: group.id,
      name: toTitleCase(ident.name),
      description: ident.description,
      category: objCategory,
      tags,
      surface: ident.surface || 'stone',
      grid: {
        cols: group.cols,
        rows: group.rows,
        tiles: tileGrid,
      },
      colliders,
      nodes: [],
      rendering: {
        layer: 'Walls',
        depthMode: 'ysort',
      },
    };

    // Add WFC data if edges are defined for this category
    if (edges) {
      objectDef.wfc = {
        edges: { ...edges },
        clearance: { north: 1, south: 1, east: 1, west: 1 },
        allowedFloors: ['stone', 'wood', 'carpet'],
        weight: 1.0,
      };
    }

    // Deduplicate IDs — append group ID if name collision
    const key = objects[ident.name] ? `${ident.name}_g${group.id}` : ident.name;
    if (objects[ident.name]) {
      objectDef.id = key;
      objectDef.name = `${toTitleCase(ident.name)} (${group.id})`;
    }
    objects[key] = objectDef;
  }

  // --- Write output ---
  const outputDir = join(ROOT, 'client/public/object-defs');
  mkdirSync(outputDir, { recursive: true });

  const output = {
    version: 1,
    tileset: tilesetName,
    objects,
  };

  const outputPath = join(outputDir, `${tilesetName}.objects.json`);
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  const objectCount = Object.keys(objects).length;
  console.log(`Wrote ${outputPath}`);
  console.log(`  ${objectCount} objects generated, ${skipped} groups skipped`);
  console.log(`  Categories: ${summarizeCategories(objects)}`);
}

function summarizeCategories(objects) {
  const counts = {};
  for (const obj of Object.values(objects)) {
    counts[obj.category] = (counts[obj.category] || 0) + 1;
  }
  return Object.entries(counts).map(([k, v]) => `${k}(${v})`).join(', ');
}

// --- CLI ---
// Guard: only run when executed directly, not when imported by tests.

const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirectRun) {
  const tilesetName = process.argv[2];
  if (!tilesetName) {
    console.error('Usage: node scripts/bootstrap-object-defs.js <tileset-name>');
    console.error('Example: node scripts/bootstrap-object-defs.js Interior_1st_floor');
    process.exit(1);
  }
  bootstrap(tilesetName);
}
