// --- identifyTiles.js ---
// Step 4: Generate catalog sheets suitable for AI vision analysis.
// Arranges tile groups on composite images with labels.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const CATALOG_ZOOM = 4;
const PADDING = 8;
const LABEL_HEIGHT = 16;
const MAX_SHEET_WIDTH = 900;
const MAX_SHEET_HEIGHT = 1200;

export async function identifyTiles(ctx) {
  const outDir = join(ctx.outputBase, 'step4');
  mkdirSync(outDir, { recursive: true });

  const groups = readGroups(ctx);
  const info = readInfo(ctx);
  const img = await loadImage(ctx.imagePath);
  const { tileSize, columns: cols } = info;

  console.log(`  ${groups.length} groups to catalog`);

  // --- Layout groups onto catalog sheets ---
  const sheets = [];
  let currentSheet = { groups: [], width: 0, height: 0 };
  let cursorX = PADDING;
  let cursorY = PADDING;
  let rowMaxH = 0;

  for (const group of groups) {
    const gw = group.cols * tileSize * CATALOG_ZOOM;
    const gh = group.rows * tileSize * CATALOG_ZOOM + LABEL_HEIGHT;
    const cellW = gw + PADDING;
    const cellH = gh + PADDING;

    // Wrap to next row if exceeding width
    if (cursorX + cellW > MAX_SHEET_WIDTH && cursorX > PADDING) {
      cursorX = PADDING;
      cursorY += rowMaxH + PADDING;
      rowMaxH = 0;
    }

    // New sheet if exceeding height
    if (cursorY + cellH > MAX_SHEET_HEIGHT && currentSheet.groups.length > 0) {
      sheets.push(currentSheet);
      currentSheet = { groups: [], width: 0, height: 0 };
      cursorX = PADDING;
      cursorY = PADDING;
      rowMaxH = 0;
    }

    currentSheet.groups.push({
      ...group,
      renderX: cursorX,
      renderY: cursorY,
      renderW: gw,
      renderH: gh,
    });

    currentSheet.width = Math.max(currentSheet.width, cursorX + cellW);
    currentSheet.height = Math.max(currentSheet.height, cursorY + cellH);

    cursorX += cellW;
    rowMaxH = Math.max(rowMaxH, cellH);
  }

  if (currentSheet.groups.length > 0) {
    sheets.push(currentSheet);
  }

  // --- Render catalog sheets ---
  for (let si = 0; si < sheets.length; si++) {
    const sheet = sheets[si];
    const canvas = createCanvas(sheet.width, sheet.height);
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;

    // Dark background
    c.fillStyle = '#1a1a2e';
    c.fillRect(0, 0, sheet.width, sheet.height);

    for (const g of sheet.groups) {
      // Label background
      c.fillStyle = '#000000';
      c.fillRect(g.renderX, g.renderY, g.renderW, LABEL_HEIGHT);

      // Label text
      c.fillStyle = '#00ccff';
      c.font = 'bold 11px monospace';
      c.textAlign = 'left';
      const label = `#${g.id} (${g.cols}x${g.rows})`;
      c.fillText(label, g.renderX + 2, g.renderY + 12);

      // Tile indices as secondary label
      c.fillStyle = '#888888';
      c.font = '9px monospace';
      const tileLabel = g.tiles.length <= 4
        ? g.tiles.join(',')
        : `${g.tiles[0]}..${g.tiles[g.tiles.length - 1]}`;
      c.textAlign = 'right';
      c.fillText(tileLabel, g.renderX + g.renderW - 2, g.renderY + 12);

      // Draw group tiles
      const tileY = g.renderY + LABEL_HEIGHT;
      for (const tIdx of g.tiles) {
        const tc = tIdx % cols;
        const tr = Math.floor(tIdx / cols);
        const relCol = tc - g.topLeft.col;
        const relRow = tr - g.topLeft.row;

        c.drawImage(
          img,
          tc * tileSize, tr * tileSize, tileSize, tileSize,
          g.renderX + relCol * tileSize * CATALOG_ZOOM,
          tileY + relRow * tileSize * CATALOG_ZOOM,
          tileSize * CATALOG_ZOOM,
          tileSize * CATALOG_ZOOM,
        );
      }

      // Thin border around the group
      c.strokeStyle = 'rgba(0, 204, 255, 0.3)';
      c.lineWidth = 1;
      c.strokeRect(
        g.renderX, tileY,
        g.cols * tileSize * CATALOG_ZOOM,
        g.rows * tileSize * CATALOG_ZOOM,
      );
    }

    const path = join(outDir, `catalog-sheet-${si + 1}.png`);
    writeFileSync(path, canvas.toBuffer('image/png'));
    console.log(`  Sheet ${si + 1}: ${sheet.groups.length} groups → ${path}`);
  }

  // --- Generate prompt.md ---
  const prompt = generatePrompt(ctx.tilesetName, groups);
  const promptPath = join(outDir, 'prompt.md');
  writeFileSync(promptPath, prompt);
  console.log(`  Saved prompt: ${promptPath}`);

  console.log(`\n  Next: Have Claude read the catalog sheet images and fill in identifications.`);
  console.log(`  Save results to: ${join(outDir, 'identifications.json')}`);
}

// --- Prompt Generation ---

function generatePrompt(tilesetName, groups) {
  const lines = [
    `# Tile Identification: ${tilesetName}`,
    '',
    'Look at the catalog sheet images. Each numbered tile group shows a set of',
    'connected tiles from the tileset, zoomed 4x for visibility.',
    '',
    'For each group, identify:',
    '1. **name**: Short identifier (e.g., "wooden_table_large", "stone_wall_top")',
    '2. **description**: What the tile(s) depict',
    '3. **category**: One of: floor, wall, decor, obstacle, ceiling, door, stairs',
    '4. **collision**: One of: none (walkable), solid (blocks movement), platform (blocks from above)',
    '5. **surface**: One of: stone, wood, water, grass, carpet, metal, dirt',
    '',
    'Return as a JSON array:',
    '```json',
    '[',
    '  {',
    '    "groupId": 0,',
    '    "name": "example_name",',
    '    "description": "What this tile/group looks like",',
    '    "category": "floor",',
    '    "collision": "none",',
    '    "surface": "stone"',
    '  }',
    ']',
    '```',
    '',
    `Total groups to identify: ${groups.length}`,
    '',
    '## Group Summary',
    '',
  ];

  for (const g of groups) {
    lines.push(`- **#${g.id}** — ${g.cols}x${g.rows} tiles [${g.tiles.join(', ')}]`);
  }

  return lines.join('\n');
}

// --- Helpers ---

function readGroups(ctx) {
  try {
    const path = join(ctx.outputBase, 'step3', 'groups.json');
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.error('Run step 3 first.');
    process.exit(1);
  }
}

function readInfo(ctx) {
  try {
    const path = join(ctx.outputBase, 'step2', 'info.json');
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.error('Run step 2 first.');
    process.exit(1);
  }
}
