// --- extractTiles.js ---
// Step 2: Extract individual tiles from a tileset image.
// Saves each tile as a zoomed PNG and generates a labeled catalog image.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const TILE_ZOOM = 8;    // Individual tile export zoom
const CATALOG_ZOOM = 4; // Catalog overview zoom
const LABEL_HEIGHT = 14; // Pixels reserved for index label per tile in catalog

export async function extractTiles(ctx) {
  const outDir = join(ctx.outputBase, 'step2');
  const tilesDir = join(outDir, 'tiles');
  mkdirSync(tilesDir, { recursive: true });

  // Read tile size from step 1 result or CLI flag
  const tileSize = ctx.forcedSize || readTileSize(ctx);
  const img = await loadImage(ctx.imagePath);
  const { width, height } = img;

  const cols = Math.floor(width / tileSize);
  const rows = Math.floor(height / tileSize);
  const tileCount = cols * rows;

  console.log(`Tile size: ${tileSize}px, grid: ${cols}x${rows} = ${tileCount} tiles`);

  // --- Extract individual tiles ---
  const zoomed = tileSize * TILE_ZOOM;
  let extracted = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const canvas = createCanvas(zoomed, zoomed);
      const c = canvas.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(
        img,
        col * tileSize, row * tileSize, tileSize, tileSize,
        0, 0, zoomed, zoomed,
      );

      const path = join(tilesDir, `tile-${String(idx).padStart(3, '0')}.png`);
      writeFileSync(path, canvas.toBuffer('image/png'));
      extracted++;
    }
  }
  console.log(`  Extracted ${extracted} tiles (${TILE_ZOOM}x zoom) to ${tilesDir}/`);

  // --- Generate labeled catalog ---
  const cellW = tileSize * CATALOG_ZOOM;
  const cellH = tileSize * CATALOG_ZOOM + LABEL_HEIGHT;
  const catalogW = cols * cellW;
  const catalogH = rows * cellH;

  const catalog = createCanvas(catalogW, catalogH);
  const cc = catalog.getContext('2d');
  cc.imageSmoothingEnabled = false;

  // Dark background
  cc.fillStyle = '#1a1a2e';
  cc.fillRect(0, 0, catalogW, catalogH);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const dx = col * cellW;
      const dy = row * cellH;

      // Draw tile at zoom
      cc.drawImage(
        img,
        col * tileSize, row * tileSize, tileSize, tileSize,
        dx, dy, cellW, tileSize * CATALOG_ZOOM,
      );

      // Draw thin border
      cc.strokeStyle = 'rgba(100, 100, 100, 0.5)';
      cc.lineWidth = 1;
      cc.strokeRect(dx, dy, cellW, tileSize * CATALOG_ZOOM);

      // Draw index label below tile
      cc.fillStyle = '#000000';
      cc.fillRect(dx, dy + tileSize * CATALOG_ZOOM, cellW, LABEL_HEIGHT);
      cc.fillStyle = '#ffffff';
      cc.font = '10px monospace';
      cc.textAlign = 'center';
      cc.fillText(String(idx), dx + cellW / 2, dy + tileSize * CATALOG_ZOOM + 11);
    }
  }

  const catalogPath = join(outDir, 'catalog.png');
  writeFileSync(catalogPath, catalog.toBuffer('image/png'));
  console.log(`  Saved catalog: ${catalogPath}`);

  // Save info
  const info = { tileSize, columns: cols, rows, tileCount };
  const infoPath = join(outDir, 'info.json');
  writeFileSync(infoPath, JSON.stringify(info, null, 2));
  console.log(`  Saved ${infoPath}`);
}

// --- Helpers ---

function readTileSize(ctx) {
  try {
    const resultPath = join(ctx.outputBase, 'step1', 'result.json');
    const result = JSON.parse(readFileSync(resultPath, 'utf-8'));
    return result.detectedSize;
  } catch {
    console.error('No step 1 result found. Use --size <px> to specify tile size.');
    process.exit(1);
  }
}
