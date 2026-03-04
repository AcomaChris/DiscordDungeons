#!/usr/bin/env node

// --- auto-setup-objects.js ---
// Batch script that generates .objects.json files for all tilesets.
// Loads each tileset PNG, runs pixel analysis, detects object groups,
// classifies categories, applies collision presets, and enriches with
// WFC edges/parts/nodes.
//
// For Animation_windows_doors: parses TMX animation data, restricts
// opaque set to bank-0 tiles, and builds animation frame mappings.
//
// Usage: node scripts/auto-setup-objects.js

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TILE_SIZE = 16;
const EDGE_THRESHOLD = 30;

// --- Tileset Definitions ---
// AGENT: Keep dimensions in sync with actual PNGs. Order doesn't matter.
const TILESETS = [
  { name: 'Interior_1st_floor',       cols: 21, rows: 22, tiles: 462 },
  { name: 'Exterior',                 cols: 28, rows: 26, tiles: 728 },
  { name: 'Walls_interior',           cols: 10, rows: 18, tiles: 180 },
  { name: 'Walls_street',             cols: 21, rows: 18, tiles: 378 },
  { name: 'Interior_2nd_floor',       cols: 23, rows:  8, tiles: 184 },
  { name: 'Animation_windows_doors',  cols: 40, rows: 20, tiles: 800 },
];

// --- Import Pure Functions ---
// These work with raw pixel data (Uint8ClampedArray) in both browser and Node.

import {
  isTileTransparent,
  buildAdjacencyGraph,
  buildGroups,
  computeColorProfile,
  classifyCategory,
} from '../client/src/tile-editor/TilesetAnalyzer.js';

import { enrichAll } from '../client/src/tile-editor/AutoEnricher.js';

import { OBJECT_DEFAULTS } from '../client/src/map/object-def-schema.js';

// --- TMX Animation Parser ---
// Extracts animation data from Tiled .tmx files for a specific tileset.
// Returns { animations: Map<tileId, [{tileid, duration}]>, bankWidth } or null.

function parseTMXAnimations(tmxPath, tilesetName) {
  if (!existsSync(tmxPath)) return null;

  const xml = readFileSync(tmxPath, 'utf-8');

  // Find the tileset block for the target tileset by matching image source
  const tilesetRegex = new RegExp(
    `<tileset[^>]*>\\s*<image[^>]*source="${tilesetName}\\.png"[^>]*/>([\\s\\S]*?)</tileset>`,
    'g',
  );
  const match = tilesetRegex.exec(xml);
  if (!match) return null;

  const block = match[1];
  const animations = new Map();

  // Parse each <tile id="N"> block with nested <animation>
  const tileRegex = /<tile id="(\d+)">\s*<animation>([\s\S]*?)<\/animation>\s*<\/tile>/g;
  let tileMatch;
  while ((tileMatch = tileRegex.exec(block)) !== null) {
    const baseTileId = parseInt(tileMatch[1], 10);
    const animBlock = tileMatch[2];

    const frames = [];
    const frameRegex = /<frame tileid="(\d+)" duration="(\d+)"\/>/g;
    let frameMatch;
    while ((frameMatch = frameRegex.exec(animBlock)) !== null) {
      frames.push({
        tileid: parseInt(frameMatch[1], 10),
        duration: parseInt(frameMatch[2], 10),
      });
    }

    if (frames.length > 0) {
      animations.set(baseTileId, frames);
    }
  }

  if (animations.size === 0) return null;

  // Deduplicate frames: consecutive frames with the same tileid are merged
  for (const [baseId, frames] of animations) {
    const deduped = [];
    for (const frame of frames) {
      const last = deduped[deduped.length - 1];
      if (last && last.tileid === frame.tileid) {
        last.duration += frame.duration;
      } else {
        deduped.push({ ...frame });
      }
    }
    animations.set(baseId, deduped);
  }

  // Detect bank width: the minimum column index among base tiles with animations
  // that have frame tiles in a different row tells us the bank boundary.
  // For Animation_windows_doors, bank width = 10 (cols 0-9 are bank 0).
  let bankWidth = null;
  const cols = 40; // Animation_windows_doors columns
  for (const [baseId, frames] of animations) {
    const baseCol = baseId % cols;
    const baseRow = Math.floor(baseId / cols);
    for (const frame of frames) {
      const frameCol = frame.tileid % cols;
      const frameRow = Math.floor(frame.tileid / cols);
      // If frame is in a different row but same column pattern, it's a vertical bank
      if (frameRow !== baseRow && frameCol === baseCol) {
        // bankWidth is determined by the repeating column pattern
        if (bankWidth === null || baseCol + 1 > bankWidth) {
          bankWidth = baseCol + 1;
        }
      }
    }
  }

  // If we couldn't detect bank width, assume the full width
  if (bankWidth === null) bankWidth = cols;

  return { animations, bankWidth };
}

// --- Collision Presets ---
// Mirrors TileEditor._applyCollisionPreset() logic.

function applyCollisionPreset(def) {
  const pixelW = def.grid.cols * TILE_SIZE;
  const pixelH = def.grid.rows * TILE_SIZE;

  switch (def.category) {
  case 'furniture':
  case 'container':
    // Bottom-half rect for furniture, full for container
    if (def.category === 'furniture') {
      def.colliders = [{
        id: 'main', shape: 'rect', type: 'solid',
        x: 0, y: Math.floor(pixelH / 2), width: pixelW, height: Math.ceil(pixelH / 2), elevation: 0,
      }];
    } else {
      def.colliders = [{
        id: 'main', shape: 'rect', type: 'solid',
        x: 0, y: 0, width: pixelW, height: pixelH, elevation: 0,
      }];
    }
    break;
  case 'structure':
    def.colliders = [{
      id: 'main', shape: 'rect', type: 'solid',
      x: 0, y: 0, width: pixelW, height: pixelH, elevation: 0,
    }];
    break;
  case 'nature':
    // Bottom-half rect — walkable top for Y-sorted objects
    def.colliders = [{
      id: 'main', shape: 'rect', type: 'solid',
      x: 0, y: Math.floor(pixelH / 2), width: pixelW, height: Math.ceil(pixelH / 2), elevation: 0,
    }];
    break;
  default:
    // decoration, lighting, effect — no collider
    break;
  }
}

// --- Animation Frame Builder ---
// For an animated object, builds the animation field with frame mappings.

function buildAnimationField(group, animData) {
  if (!animData) return null;

  // Collect all base tiles in this group that have animation sequences
  const animatedBaseTiles = [];
  for (const tileIdx of group.tiles) {
    if (animData.animations.has(tileIdx)) {
      animatedBaseTiles.push(tileIdx);
    }
  }

  if (animatedBaseTiles.length === 0) return null;

  // All animated tiles in the same object should have the same frame count
  // (they animate in lockstep). Use the first one's frame count.
  const referenceFrames = animData.animations.get(animatedBaseTiles[0]);
  const frameCount = referenceFrames.length;

  const frames = [];
  for (let f = 0; f < frameCount; f++) {
    const tileMap = {};
    for (const baseTile of animatedBaseTiles) {
      const seq = animData.animations.get(baseTile);
      if (seq && f < seq.length) {
        tileMap[String(baseTile)] = seq[f].tileid;
      }
    }
    frames.push({
      tiles: tileMap,
      duration: referenceFrames[f].duration,
    });
  }

  return {
    startFrame: 0,
    frames,
  };
}

// --- Main Processing ---

async function processTileset(tilesetDef) {
  const { name, cols, rows } = tilesetDef;

  // Step 1: Load PNG
  const pngPath = join(ROOT, 'client/public/tilesets', `${name}.png`);
  if (!existsSync(pngPath)) {
    // Try the assets source directory
    const assetPath = join(ROOT, 'assets/tilesets/tavern/Tiled_files', `${name}.png`);
    if (!existsSync(assetPath)) {
      console.error(`  SKIP: PNG not found at ${pngPath} or ${assetPath}`);
      return null;
    }
    // Copy to public tilesets directory
    const { copyFileSync } = await import('fs');
    mkdirSync(join(ROOT, 'client/public/tilesets'), { recursive: true });
    copyFileSync(assetPath, pngPath);
    console.log(`  Copied ${name}.png from assets to public/tilesets/`);
  }

  const img = await loadImage(pngPath);
  const imgWidth = img.width;
  const imgHeight = img.height;

  // Verify dimensions match expected cols/rows
  const actualCols = Math.floor(imgWidth / TILE_SIZE);
  const actualRows = Math.floor(imgHeight / TILE_SIZE);
  if (actualCols !== cols || actualRows !== rows) {
    console.warn(`  WARNING: Expected ${cols}x${rows}, got ${actualCols}x${actualRows}`);
  }

  // Step 2: Get pixel data via canvas
  const canvas = createCanvas(imgWidth, imgHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, imgWidth, imgHeight).data;

  // Step 3: Check for animation data
  let animData = null;
  const animJsonPath = join(ROOT, 'client/public/tile-metadata', `${name}.animations.json`);
  if (existsSync(animJsonPath)) {
    const raw = JSON.parse(readFileSync(animJsonPath, 'utf-8'));
    // Convert to Map format
    const animations = new Map();
    for (const [key, value] of Object.entries(raw.animations || {})) {
      animations.set(parseInt(key, 10), value);
    }
    animData = { animations, bankWidth: raw.bankWidth || cols };
    console.log(`  Loaded animation data from ${name}.animations.json (${animations.size} sequences)`);
  }

  // If no .animations.json, try parsing from TMX for Animation_windows_doors
  if (!animData && name === 'Animation_windows_doors') {
    const tmxFiles = [
      'Tavern_interior_1nd_floor.tmx',
      'Tavern_interior_2st_floor.tmx',
      'Tavern_exterior.tmx',
    ];
    for (const tmx of tmxFiles) {
      const tmxPath = join(ROOT, 'assets/tilesets/tavern/Tiled_files', tmx);
      animData = parseTMXAnimations(tmxPath, name);
      if (animData) {
        console.log(`  Parsed ${animData.animations.size} animation sequences from ${tmx}`);
        break;
      }
    }
  }

  // Step 4: Build opaque set — if animation data exists with banks,
  // only include bank-0 tiles (cols 0 to bankWidth-1) in the opaque set.
  let opaqueOverride = null;
  if (animData && animData.bankWidth < cols) {
    // Determine which tiles are frame-only (appear as animation frames but not as base tiles)
    const frameTiles = new Set();
    const baseTiles = new Set();
    for (const [baseId, frames] of animData.animations) {
      baseTiles.add(baseId);
      for (const frame of frames) {
        if (frame.tileid !== baseId) {
          frameTiles.add(frame.tileid);
        }
      }
    }

    // Build restricted opaque set: only bank-0 columns, excluding frame-only tiles
    opaqueOverride = new Set();
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < animData.bankWidth; col++) {
        const idx = row * cols + col;
        if (!isTileTransparent(pixels, imgWidth, col, row, TILE_SIZE)) {
          // Exclude tiles that only appear as non-base animation frames
          if (!frameTiles.has(idx) || baseTiles.has(idx)) {
            opaqueOverride.add(idx);
          }
        }
      }
    }
    console.log(`  Bank-0 restriction: ${opaqueOverride.size} opaque tiles (bankWidth=${animData.bankWidth})`);
  }

  // Step 5: Build adjacency graph
  const { connections, opaque } = buildAdjacencyGraph(
    pixels, imgWidth, cols, rows, TILE_SIZE, EDGE_THRESHOLD,
  );

  // Use restricted opaque set if we have animation bank data
  const effectiveOpaque = opaqueOverride || opaque;

  // If using bank restriction, also filter connections to only include bank-0 tiles
  let effectiveConnections = connections;
  if (opaqueOverride) {
    effectiveConnections = new Map();
    for (const [tileIdx, neighbors] of connections) {
      if (!opaqueOverride.has(tileIdx)) continue;
      const filteredNeighbors = new Set();
      for (const n of neighbors) {
        if (opaqueOverride.has(n)) filteredNeighbors.add(n);
      }
      if (filteredNeighbors.size > 0) {
        effectiveConnections.set(tileIdx, filteredNeighbors);
      }
    }
  }

  // Step 6: Add hard connections for animation family tiles
  if (animData) {
    for (const [baseId] of animData.animations) {
      // Only connect base tiles that are in our opaque set
      if (!effectiveOpaque.has(baseId)) continue;

      // Find other base tiles that are in the same animation family
      // (tiles that share animation frame rows)
      const baseCol = baseId % cols;
      const baseRow = Math.floor(baseId / cols);

      // Check if adjacent base tiles also animate — connect them
      const rightIdx = baseRow * cols + (baseCol + 1);
      if (effectiveOpaque.has(rightIdx) && animData.animations.has(rightIdx)) {
        if (!effectiveConnections.has(baseId)) effectiveConnections.set(baseId, new Set());
        if (!effectiveConnections.has(rightIdx)) effectiveConnections.set(rightIdx, new Set());
        effectiveConnections.get(baseId).add(rightIdx);
        effectiveConnections.get(rightIdx).add(baseId);
      }

      const belowIdx = (baseRow + 1) * cols + baseCol;
      if (effectiveOpaque.has(belowIdx) && animData.animations.has(belowIdx)) {
        if (!effectiveConnections.has(baseId)) effectiveConnections.set(baseId, new Set());
        if (!effectiveConnections.has(belowIdx)) effectiveConnections.set(belowIdx, new Set());
        effectiveConnections.get(baseId).add(belowIdx);
        effectiveConnections.get(belowIdx).add(baseId);
      }
    }
  }

  // Step 7: Build groups
  const groups = buildGroups(effectiveConnections, effectiveOpaque, cols);

  // Step 8: Compute color profiles and classify categories
  for (const group of groups) {
    group.colorProfile = computeColorProfile(pixels, group.tiles, cols, TILE_SIZE, imgWidth);
    group.category = classifyCategory(group.colorProfile, group.cols, group.rows);
  }

  // Step 9: Load existing .objects.json to preserve existing objects
  const outputDir = join(ROOT, 'client/public/object-defs');
  mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `${name}.objects.json`);

  let existingObjects = {};
  if (existsSync(outputPath)) {
    const existing = JSON.parse(readFileSync(outputPath, 'utf-8'));
    existingObjects = existing.objects || {};
    console.log(`  Loaded ${Object.keys(existingObjects).length} existing objects from ${name}.objects.json`);
  }

  // Build set of tiles already assigned to existing objects
  const assignedTiles = new Set();
  for (const def of Object.values(existingObjects)) {
    if (!def.grid || !def.grid.tiles) continue;
    for (const row of def.grid.tiles) {
      for (const tileIdx of row) {
        if (tileIdx !== null && tileIdx !== undefined) {
          assignedTiles.add(tileIdx);
        }
      }
    }
  }

  // Step 10: Create object defs from unassigned groups
  const newObjects = { ...existingObjects };
  let addedCount = 0;
  const categoryCounts = {};
  let animatedCount = 0;

  for (const group of groups) {
    // Skip groups where all tiles are already assigned
    const unassigned = group.tiles.filter(t => !assignedTiles.has(t));
    if (unassigned.length === 0) continue;

    const id = `obj_${group.topLeft.col}_${group.topLeft.row}`;
    if (newObjects[id]) continue;

    // Build tile grid (2D array relative to group's bounding box)
    const tileSet = new Set(group.tiles);
    const tileGrid = [];
    for (let r = 0; r < group.rows; r++) {
      const row = [];
      for (let c = 0; c < group.cols; c++) {
        const idx = (group.topLeft.row + r) * cols + (group.topLeft.col + c);
        row.push(tileSet.has(idx) ? idx : null);
      }
      tileGrid.push(row);
    }

    const category = group.category || 'decoration';

    // Create object def matching TileEditor._autoDetectObjects pattern
    const def = {
      ...structuredClone(OBJECT_DEFAULTS),
      id,
      name: id.replace(/_/g, ' '),
      category,
      grid: { cols: group.cols, rows: group.rows, tiles: tileGrid },
      wfc: {
        edges: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
        clearance: { north: 1, south: 1, east: 1, west: 1 },
        allowedFloors: ['stone', 'wood'],
        weight: 1,
      },
    };

    // Apply collision preset by category
    applyCollisionPreset(def);

    // Build animation field for animated objects
    if (animData) {
      const animField = buildAnimationField(group, animData);
      if (animField) {
        def.animation = animField;
        animatedCount++;
      }
    }

    newObjects[id] = def;
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    addedCount++;
  }

  // Step 11: Run auto-enrichment
  const enrichSummary = enrichAll(newObjects);

  // Step 12: Write output
  const output = {
    version: 1,
    tileset: name,
    objects: newObjects,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  return {
    name,
    totalObjects: Object.keys(newObjects).length,
    addedCount,
    categoryCounts,
    animatedCount,
    enrichSummary,
  };
}

// --- Summary Printing ---

function printSummary(result) {
  if (!result) return;

  console.log(`\n  === ${result.name} ===`);
  console.log(`  Total objects: ${result.totalObjects} (${result.addedCount} new)`);

  const categoryList = Object.entries(result.categoryCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, n]) => `${cat}: ${n}`)
    .join(', ');
  if (categoryList) {
    console.log(`  Categories: ${categoryList}`);
  }

  if (result.animatedCount > 0) {
    console.log(`  Animated objects: ${result.animatedCount}`);
  }

  const enrichParts = [];
  if (result.enrichSummary.edgeChanges) enrichParts.push(`${result.enrichSummary.edgeChanges} edges`);
  if (result.enrichSummary.partsChanges) enrichParts.push(`${result.enrichSummary.partsChanges} parts`);
  if (result.enrichSummary.nodeChanges) enrichParts.push(`${result.enrichSummary.nodeChanges} nodes`);
  if (enrichParts.length > 0) {
    console.log(`  Enriched: ${enrichParts.join(', ')}`);
  }
}

// --- Main ---

async function main() {
  console.log('Auto-setup objects for all tilesets\n');

  const results = [];

  for (const tilesetDef of TILESETS) {
    console.log(`Processing ${tilesetDef.name}...`);
    try {
      const result = await processTileset(tilesetDef);
      results.push(result);
    } catch (err) {
      console.error(`  ERROR processing ${tilesetDef.name}: ${err.message}`);
      console.error(err.stack);
      results.push(null);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));

  for (const result of results) {
    printSummary(result);
  }

  const totalNew = results.reduce((sum, r) => sum + (r?.addedCount || 0), 0);
  const totalObj = results.reduce((sum, r) => sum + (r?.totalObjects || 0), 0);
  console.log(`\nTotal: ${totalObj} objects across ${results.filter(Boolean).length} tilesets (${totalNew} new)`);
}

main();
