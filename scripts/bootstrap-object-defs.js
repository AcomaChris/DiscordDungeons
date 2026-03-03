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

// Generate default colliders based on category and collision type.
function generateColliders(group, identification, tileSize) {
  const pixelW = group.cols * tileSize;
  const pixelH = group.rows * tileSize;
  const collision = identification.collision;

  if (collision === 'none') return [];

  if (collision === 'platform') {
    // Two-level: legs at ground, surface at elevation 1
    return [
      {
        id: 'base',
        shape: 'rect',
        x: 0,
        y: Math.floor(pixelH * 0.6),
        width: pixelW,
        height: Math.floor(pixelH * 0.4),
        elevation: 0,
        type: 'solid',
        stretchable: group.cols > 2,
      },
      {
        id: 'surface',
        shape: 'rect',
        x: 0,
        y: 0,
        width: pixelW,
        height: pixelH,
        elevation: 1,
        type: 'platform',
        stretchable: group.cols > 2,
      },
    ];
  }

  // Solid — single full-size rect at ground level
  return [
    {
      id: 'body',
      shape: 'rect',
      x: 0,
      y: 0,
      width: pixelW,
      height: pixelH,
      elevation: 0,
      type: 'solid',
      stretchable: group.cols > 2,
    },
  ];
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
    const colliders = generateColliders(group, ident, tileSize);
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

const tilesetName = process.argv[2];
if (!tilesetName) {
  console.error('Usage: node scripts/bootstrap-object-defs.js <tileset-name>');
  console.error('Example: node scripts/bootstrap-object-defs.js Interior_1st_floor');
  process.exit(1);
}

bootstrap(tilesetName);
