#!/usr/bin/env node

// --- import-tilesets.js ---
// Copies tavern tileset PNGs to client/public/tilesets/ and generates
// scaffold tile-metadata JSON files for the tile editor.
//
// Usage: node scripts/import-tilesets.js
// Idempotent: skips existing metadata files, overwrites PNGs.

import { loadImage } from '@napi-rs/canvas';
import { copyFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TILE_SIZE = 16;
const SOURCE_DIR = join(ROOT, 'assets/tilesets/tavern/Tiled_files');
const DEST_TILESETS = join(ROOT, 'client/public/tilesets');
const DEST_METADATA = join(ROOT, 'client/public/tile-metadata');

const TILESETS = [
  'Interior_1st_floor.png',
  'Exterior.png',
  'Walls_interior.png',
  'Walls_street.png',
  'Interior_2nd_floor.png',
];

async function main() {
  mkdirSync(DEST_TILESETS, { recursive: true });
  mkdirSync(DEST_METADATA, { recursive: true });

  for (const filename of TILESETS) {
    const src = join(SOURCE_DIR, filename);
    const dest = join(DEST_TILESETS, filename);

    // Copy PNG
    copyFileSync(src, dest);
    console.log(`Copied ${filename} -> tilesets/`);

    // Read dimensions to calculate grid
    const img = await loadImage(src);
    const columns = img.width / TILE_SIZE;
    const rows = img.height / TILE_SIZE;
    const tileCount = columns * rows;

    // Generate scaffold JSON (skip if already exists)
    const name = basename(filename, '.png');
    const metadataPath = join(DEST_METADATA, `${name}.json`);

    if (existsSync(metadataPath)) {
      console.log(`Skipped ${name}.json (already exists)`);
      continue;
    }

    const scaffold = {
      tileset: name,
      image: `tilesets/${filename}`,
      tileSize: TILE_SIZE,
      columns,
      rows,
      tileCount,
      version: 1,
      tiles: {},
    };

    writeFileSync(metadataPath, JSON.stringify(scaffold, null, 2) + '\n');
    console.log(`Created ${name}.json (${columns}x${rows} = ${tileCount} tiles)`);
  }
}

main();
