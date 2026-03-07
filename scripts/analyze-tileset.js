#!/usr/bin/env node

// --- analyze-tileset.js ---
// Multi-step tile analysis pipeline for identifying tileset contents.
//
// Usage:
//   node scripts/analyze-tileset.js <tileset-name> [--step <1-5>] [--size <px>] [--threshold <n>]
//
// Steps:
//   1. Detect tile size (renders top row at multiple zooms + automated grid-line analysis)
//   2. Extract individual tiles as PNGs + labeled catalog image
//   3. Group multi-tile objects by edge pixel similarity
//   4. Generate catalog sheets for AI identification
//   5. Generate tile metadata JSON from AI identifications
//
// Output goes to tmp/tile-analysis/<tileset>/

// @doc-creator-tools 03:Scripts > analyze-tileset
// Multi-step tileset analysis pipeline. Detects tile size, extracts individual
// tiles, groups multi-tile objects, and generates catalog sheets.
// Usage: `node scripts/analyze-tileset.js <tileset-name> [--step <1-5>]`.
// Output: `tmp/tile-analysis/<tileset>/`.

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { detectSize } from './tile-analyzer/detectSize.js';
import { extractTiles } from './tile-analyzer/extractTiles.js';
import { groupTiles } from './tile-analyzer/groupTiles.js';
import { identifyTiles } from './tile-analyzer/identifyTiles.js';
import { generateMetadata } from './tile-analyzer/generateMetadata.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TILESETS_DIR = join(ROOT, 'client/public/tilesets');
const OUTPUT_DIR = join(ROOT, 'tmp/tile-analysis');

// --- Parse CLI args ---

const args = process.argv.slice(2);
const tilesetName = args.find((a) => !a.startsWith('--'));

if (!tilesetName) {
  console.error('Usage: node scripts/analyze-tileset.js <tileset-name> [--step <1-5>] [--size <px>]');
  console.error('\nAvailable tilesets:');
  const { readdirSync } = await import('fs');
  for (const f of readdirSync(TILESETS_DIR)) {
    if (f.endsWith('.png')) console.error(`  ${f.replace('.png', '')}`);
  }
  process.exit(1);
}

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const stepArg = getFlag('step');
const sizeArg = getFlag('size');
const thresholdArg = getFlag('threshold');

const step = stepArg ? parseInt(stepArg, 10) : null;
const forcedSize = sizeArg ? parseInt(sizeArg, 10) : null;
const threshold = thresholdArg ? parseInt(thresholdArg, 10) : 30;

// Validate tileset exists
const imagePath = join(TILESETS_DIR, `${tilesetName}.png`);
if (!existsSync(imagePath)) {
  console.error(`Tileset not found: ${imagePath}`);
  process.exit(1);
}

const outputBase = join(OUTPUT_DIR, tilesetName);

const ctx = { tilesetName, imagePath, outputBase, forcedSize, threshold, ROOT };

// --- Run steps ---

const steps = [
  { num: 1, name: 'Detect tile size', fn: detectSize },
  { num: 2, name: 'Extract tiles', fn: extractTiles },
  { num: 3, name: 'Group tiles', fn: groupTiles },
  { num: 4, name: 'AI identification catalog', fn: identifyTiles },
  { num: 5, name: 'Generate metadata', fn: generateMetadata },
];

const toRun = step ? steps.filter((s) => s.num === step) : steps;

if (toRun.length === 0) {
  console.error(`Invalid step: ${step}. Must be 1-5.`);
  process.exit(1);
}

for (const s of toRun) {
  console.log(`\n--- Step ${s.num}: ${s.name} ---`);
  await s.fn(ctx);
}

console.log('\nDone.');
