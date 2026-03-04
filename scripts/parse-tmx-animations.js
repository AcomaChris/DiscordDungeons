#!/usr/bin/env node

// --- parse-tmx-animations.js ---
// Parses TMX files to extract per-tileset animation data and writes
// deduplicated JSON files for use by the game client's tile animation system.
//
// Usage: node scripts/parse-tmx-animations.js

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- Configuration ---
const TMX_DIR = join(ROOT, 'assets/tilesets/tavern/Tiled_files');
const OUTPUT_DIR = join(ROOT, 'client/public/tile-metadata');

const TMX_FILES = [
  'Characters.tmx',
  'Tavern_exterior.tmx',
  'Tavern_interior_1nd_floor.tmx',
  'Tavern_interior_2st_floor.tmx',
];

// --- XML regex parsing ---
// AGENT: TMX files have a simple, predictable structure — regex is sufficient here.
// No need for a full XML parser library.

function parseTilesets(xml) {
  const tilesets = [];
  // Match each <tileset ...>...</tileset> block (including self-closing tilesets with no children)
  const tilesetRegex = /<tileset\s([^>]+)>([\s\S]*?)<\/tileset>/g;
  let match;

  while ((match = tilesetRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const body = match[2];

    const name = extractAttr(attrs, 'name');
    const columns = parseInt(extractAttr(attrs, 'columns'), 10);
    const tilecount = parseInt(extractAttr(attrs, 'tilecount'), 10);

    // Extract source image filename for deduplication
    const imageMatch = body.match(/<image\s+source="([^"]+)"/);
    const source = imageMatch ? imageMatch[1] : null;
    // Strip path prefix (some sources have ../ paths)
    const sourceFile = source ? basename(source, '.png') : null;

    const animations = parseAnimations(body);
    if (Object.keys(animations).length === 0) continue;

    tilesets.push({ name, columns, tilecount, sourceFile, animations });
  }

  return tilesets;
}

function extractAttr(attrString, name) {
  const re = new RegExp(`${name}="([^"]+)"`);
  const m = attrString.match(re);
  return m ? m[1] : null;
}

function parseAnimations(tilesetBody) {
  const animations = {};
  // Match <tile id="N">...<animation>...</animation>...</tile>
  const tileRegex = /<tile\s+id="(\d+)">\s*<animation>([\s\S]*?)<\/animation>\s*<\/tile>/g;
  let match;

  while ((match = tileRegex.exec(tilesetBody)) !== null) {
    const baseTileId = parseInt(match[1], 10);
    const animBody = match[2];

    // Extract all <frame tileid="N" duration="N"/> entries
    const frames = [];
    const frameRegex = /<frame\s+tileid="(\d+)"\s+duration="(\d+)"\s*\/>/g;
    let fm;
    while ((fm = frameRegex.exec(animBody)) !== null) {
      frames.push({
        tileid: parseInt(fm[1], 10),
        duration: parseInt(fm[2], 10),
      });
    }

    // Deduplicate frames: each unique tileid appears once, first-occurrence duration wins
    const seen = new Set();
    const dedupedFrames = [];
    for (const f of frames) {
      if (!seen.has(f.tileid)) {
        seen.add(f.tileid);
        dedupedFrames.push(f);
      }
    }

    animations[baseTileId] = dedupedFrames;
  }

  return animations;
}

// --- Build animation families ---
// A family is the set of unique tile IDs used across an animation's frames
function buildFamilies(animations) {
  const families = [];
  for (const frames of Object.values(animations)) {
    const family = frames.map(f => f.tileid);
    families.push(family);
  }
  return families;
}

// --- Identify frame-only tiles ---
// Tiles that appear as frame targets but are never a base tile ID
function findFrameTiles(animations) {
  const baseTiles = new Set(Object.keys(animations).map(Number));

  // Also include first-frame tileids as "base" — they're the starting visual
  for (const frames of Object.values(animations)) {
    if (frames.length > 0) baseTiles.add(frames[0].tileid);
  }

  const allFrameTileIds = new Set();
  for (const frames of Object.values(animations)) {
    for (const f of frames) {
      allFrameTileIds.add(f.tileid);
    }
  }

  const frameTiles = [];
  for (const tid of allFrameTileIds) {
    if (!baseTiles.has(tid)) frameTiles.push(tid);
  }
  return frameTiles.sort((a, b) => a - b);
}

// --- Detect bank structure ---
// Banks are repeating column-offset groups within the tileset.
// For each animation, we compute the column offsets between base tile and frame tiles.
// The most common offset step = bank width.
function detectBanks(animations, columns) {
  if (columns === 0) return null;

  const offsetSteps = [];

  for (const [baseTileStr, frames] of Object.entries(animations)) {
    const baseTile = parseInt(baseTileStr, 10);
    const baseCol = baseTile % columns;

    for (const f of frames) {
      const frameCol = f.tileid % columns;
      const offset = frameCol - baseCol;
      if (offset !== 0) {
        offsetSteps.push(Math.abs(offset));
      }
    }
  }

  if (offsetSteps.length === 0) return null;

  // Find the most common offset step
  const freqs = {};
  for (const s of offsetSteps) {
    freqs[s] = (freqs[s] || 0) + 1;
  }

  let bestStep = null;
  let bestCount = 0;
  for (const [step, count] of Object.entries(freqs)) {
    if (count > bestCount) {
      bestCount = count;
      bestStep = parseInt(step, 10);
    }
  }

  if (!bestStep || bestStep <= 0) return null;

  // Verify: bank width should divide columns evenly
  if (columns % bestStep !== 0) return null;

  return {
    width: bestStep,
    count: columns / bestStep,
  };
}

// --- Main ---
// Keyed by sourceFile to deduplicate identical tilesets across TMX files
const allTilesets = new Map();

for (const tmxFile of TMX_FILES) {
  const filePath = join(TMX_DIR, tmxFile);
  const xml = readFileSync(filePath, 'utf-8');
  const tilesets = parseTilesets(xml);

  for (const ts of tilesets) {
    const key = ts.sourceFile || ts.name;
    if (allTilesets.has(key)) continue;
    allTilesets.set(key, ts);
  }
}

// --- Write output ---
mkdirSync(OUTPUT_DIR, { recursive: true });

let filesWritten = 0;
const summary = [];

for (const [key, ts] of allTilesets) {
  const families = buildFamilies(ts.animations);
  const frameTiles = findFrameTiles(ts.animations);
  const banks = detectBanks(ts.animations, ts.columns);

  const output = {
    tileset: ts.name,
    columns: ts.columns,
    banks,
    animations: ts.animations,
    families,
    frameTiles,
  };

  const outName = `${key}.animations.json`;
  const outPath = join(OUTPUT_DIR, outName);
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  filesWritten++;

  const animCount = Object.keys(ts.animations).length;
  const familyCount = families.length;
  summary.push(`  ${outName} — ${animCount} animations, ${familyCount} families, banks: ${banks ? `${banks.width}x${banks.count}` : 'none'}`);
}

console.log(`Parsed ${TMX_FILES.length} TMX files.`);
console.log(`Found ${allTilesets.size} unique animated tilesets.`);
console.log(`Wrote ${filesWritten} files to ${OUTPUT_DIR}/\n`);
summary.forEach(s => console.log(s));
