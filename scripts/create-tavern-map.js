#!/usr/bin/env node

// --- create-tavern-map.js ---
// Generates a Tiled-compatible JSON map for a cozy tavern interior using
// Walls_interior (structure/floor) and Interior_1st_floor (furniture/props).
//
// Usage: node scripts/create-tavern-map.js
// Output: client/public/maps/tavern.json
//
// AGENT: Tile GIDs are based on visual inspection of the tileset PNGs.
// If tiles look wrong in-game, adjust the wi() / iff() calls below.

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TILE = 16;
const MAP_W = 20;
const MAP_H = 16;

// --- Tileset Dimensions ---
// Walls_interior: 10 cols × 18 rows = 180 tiles
// Interior_1st_floor: 21 cols × 22 rows = 462 tiles

const WI_COLS = 10;
const WI_ROWS = 18;
const WI_COUNT = WI_COLS * WI_ROWS;
const WI_FIRST = 1;

const IF_COLS = 21;
const IF_ROWS = 22;
const IF_COUNT = IF_COLS * IF_ROWS;
const IF_FIRST = WI_COUNT + 1; // 181

// --- Tile Lookup Helpers ---
// Convert tileset-local (col, row) to Tiled GID

function wi(col, row) { return row * WI_COLS + col + WI_FIRST; }
function iff(col, row) { return row * IF_COLS + col + IF_FIRST; }
function idx(x, y) { return y * MAP_W + x; }

// --- Walls_interior Tile GIDs ---
// AGENT: Verified via tile analysis pipeline (scripts/analyze-tileset.js).

// Wall top beam (row 0, cols 3-9 — repeating horizontal beam/plaster pattern)
const WALL_TOP_M  = wi(4, 0);   // Wall top, repeating beam pattern

// Wall face (row 9 — smooth stone with decorative bracket trim at top)
const WALL_MID_L  = wi(4, 9);   // Wall face, left
const WALL_MID_M  = wi(5, 9);   // Wall face, middle (repeatable)
const WALL_MID_R  = wi(6, 9);   // Wall face, right

// Cobblestone floor (row 10 — large rounded flagstones with mortar)
const STONE_FLOOR  = wi(0, 10); // Primary floor tile
const STONE_FLOOR2 = wi(1, 10); // Floor variant for checkerboard

// Column / pillar (col 1, rows 2-3 — wooden pillar from group 7)
const COL_TOP = wi(1, 2);       // Pillar top
const COL_MID = wi(1, 3);       // Pillar middle

// --- Interior_1st_floor Tile GIDs ---

// Large table 4×2 (cols 0-3, rows 0-1)
const LTBL_TL  = iff(0, 0);
const LTBL_TM1 = iff(1, 0);
const LTBL_TM2 = iff(2, 0);
const LTBL_TR  = iff(3, 0);
const LTBL_BL  = iff(0, 1);
const LTBL_BM1 = iff(1, 1);
const LTBL_BM2 = iff(2, 1);
const LTBL_BR  = iff(3, 1);

// Medium table 2×2 (cols 4-5, rows 0-1)
const MTBL_TL = iff(4, 0);
const MTBL_TR = iff(5, 0);
const MTBL_BL = iff(4, 1);
const MTBL_BR = iff(5, 1);

// Bar shelf (cols 9-10, rows 0-1) — bottle display behind counter
const SHELF_TL = iff(9, 0);
const SHELF_TR = iff(10, 0);
const SHELF_BL = iff(9, 1);
const SHELF_BR = iff(10, 1);

// Bar counter (cols 11-14, rows 0-1)
const CTR_TL = iff(11, 0);
const CTR_TM = iff(12, 0);
const CTR_TR = iff(13, 0);
const CTR_BL = iff(11, 1);
const CTR_BM = iff(12, 1);
const CTR_BR = iff(13, 1);

// Barrels (row 3, cols 0-1)
const BARREL = iff(0, 3);

// Chairs / padded seats (row 2-3 area)
const CHAIR_RED_TL = iff(5, 2);
const CHAIR_RED_TR = iff(6, 2);
const CHAIR_RED_BL = iff(5, 3);
const CHAIR_RED_BR = iff(6, 3);

// Plants (row 7, cols 1-2)
const PLANT_1 = iff(1, 7);
const PLANT_2 = iff(2, 7);

// --- Furniture Placement Helpers ---

function placeLargeTable(data, x, y) {
  data[idx(x, y)]     = LTBL_TL;
  data[idx(x + 1, y)] = LTBL_TM1;
  data[idx(x + 2, y)] = LTBL_TM2;
  data[idx(x + 3, y)] = LTBL_TR;
  data[idx(x, y + 1)]     = LTBL_BL;
  data[idx(x + 1, y + 1)] = LTBL_BM1;
  data[idx(x + 2, y + 1)] = LTBL_BM2;
  data[idx(x + 3, y + 1)] = LTBL_BR;
}

function placeMedTable(data, x, y) {
  data[idx(x, y)]     = MTBL_TL;
  data[idx(x + 1, y)] = MTBL_TR;
  data[idx(x, y + 1)]     = MTBL_BL;
  data[idx(x + 1, y + 1)] = MTBL_BR;
}

function placeShelf(data, x, y) {
  data[idx(x, y)]     = SHELF_TL;
  data[idx(x + 1, y)] = SHELF_TR;
  data[idx(x, y + 1)]     = SHELF_BL;
  data[idx(x + 1, y + 1)] = SHELF_BR;
}

function placeChairPair(data, x, y) {
  data[idx(x, y)]     = CHAIR_RED_TL;
  data[idx(x + 1, y)] = CHAIR_RED_TR;
  data[idx(x, y + 1)]     = CHAIR_RED_BL;
  data[idx(x + 1, y + 1)] = CHAIR_RED_BR;
}

// --- Layer Helpers ---

function makeLayer(name, data) {
  return {
    id: 0,
    name,
    type: 'tilelayer',
    x: 0, y: 0,
    width: MAP_W,
    height: MAP_H,
    opacity: 1,
    visible: true,
    data,
  };
}

// --- Ground Layer ---
// Stone floor everywhere (renders under all other layers)
function generateGroundData() {
  const data = new Array(MAP_W * MAP_H).fill(0);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      data[idx(x, y)] = (x + y) % 2 === 0 ? STONE_FLOOR : STONE_FLOOR2;
    }
  }
  return data;
}

// --- Walls Layer ---
// Wall faces and furniture — converted to Y-sorted sprites by TileMapManager
function generateWallsData() {
  const data = new Array(MAP_W * MAP_H).fill(0);

  // --- North wall face (row 1) ---
  for (let x = 0; x < MAP_W; x++) {
    data[idx(x, 1)] = WALL_MID_M;
  }
  data[idx(0, 1)] = WALL_MID_L;
  data[idx(MAP_W - 1, 1)] = WALL_MID_R;

  // --- Bar area (against north wall) ---
  // Bottle shelves (rows 2-3, cols 3-12) — four 2×2 shelf units + gap
  placeShelf(data, 3, 2);
  placeShelf(data, 5, 2);
  placeShelf(data, 7, 2);
  placeShelf(data, 9, 2);

  // Bar counter (rows 4-5, cols 2-13) — long L-shaped counter
  // Left end
  data[idx(2, 4)]  = CTR_TL;
  data[idx(2, 5)]  = CTR_BL;
  // Middle sections
  for (let x = 3; x <= 12; x++) {
    data[idx(x, 4)] = CTR_TM;
    data[idx(x, 5)] = CTR_BM;
  }
  // Right end
  data[idx(13, 4)] = CTR_TR;
  data[idx(13, 5)] = CTR_BR;

  // --- Seating area ---
  // Table group 1: large table with chairs (left side)
  placeLargeTable(data, 2, 7);
  placeChairPair(data, 2, 9);
  placeChairPair(data, 4, 9);

  // Table group 2: medium table (center)
  placeMedTable(data, 9, 7);

  // Table group 3: medium table (right side)
  placeMedTable(data, 14, 7);
  placeMedTable(data, 14, 9);

  // Table group 4: large table near door (bottom-left)
  placeLargeTable(data, 2, 11);

  // --- Barrels (bottom-right corner) ---
  data[idx(17, 11)] = BARREL;
  data[idx(18, 11)] = BARREL;
  data[idx(17, 12)] = BARREL;

  // --- Decorative elements ---
  data[idx(15, 3)] = PLANT_1;
  data[idx(17, 3)] = PLANT_2;

  // Columns flanking the main area (between bar and seating)
  data[idx(1, 6)] = COL_MID;
  data[idx(MAP_W - 2, 6)] = COL_MID;

  return data;
}

// --- WallTops Layer ---
// Wall top surfaces (always render above player)
function generateWallTopsData() {
  const data = new Array(MAP_W * MAP_H).fill(0);

  // North wall top (row 0, above the wall face at row 1)
  for (let x = 0; x < MAP_W; x++) {
    data[idx(x, 0)] = WALL_TOP_M;
  }

  // Column tops (one row above column middles at row 6)
  data[idx(1, 5)] = COL_TOP;
  data[idx(MAP_W - 2, 5)] = COL_TOP;

  return data;
}

// --- Collision Layer ---
// Invisible layer — any non-zero tile blocks movement
function generateCollisionData() {
  const data = new Array(MAP_W * MAP_H).fill(0);
  const SOLID = 1; // Any non-zero value

  // North wall + wall tops (rows 0-1)
  for (let x = 0; x < MAP_W; x++) {
    data[idx(x, 0)] = SOLID;
    data[idx(x, 1)] = SOLID;
  }

  // Side walls
  for (let y = 0; y < MAP_H; y++) {
    data[idx(0, y)] = SOLID;
    data[idx(MAP_W - 1, y)] = SOLID;
  }

  // South boundary (row 15)
  for (let x = 0; x < MAP_W; x++) {
    data[idx(x, MAP_H - 1)] = SOLID;
  }

  // Bar shelves (rows 2-3, cols 3-10)
  for (let y = 2; y <= 3; y++) {
    for (let x = 3; x <= 10; x++) {
      data[idx(x, y)] = SOLID;
    }
  }

  // Bar counter (rows 4-5, cols 2-13)
  for (let y = 4; y <= 5; y++) {
    for (let x = 2; x <= 13; x++) {
      data[idx(x, y)] = SOLID;
    }
  }

  // Plants behind counter
  data[idx(15, 3)] = SOLID;
  data[idx(17, 3)] = SOLID;

  // Barrels
  data[idx(17, 11)] = SOLID;
  data[idx(18, 11)] = SOLID;
  data[idx(17, 12)] = SOLID;

  // Columns
  data[idx(1, 6)] = SOLID;
  data[idx(MAP_W - 2, 6)] = SOLID;

  return data;
}

// --- Objects Layer ---
function generateObjectLayer() {
  return {
    id: 0,
    name: 'Objects',
    type: 'objectgroup',
    x: 0, y: 0,
    visible: true,
    opacity: 1,
    objects: [
      {
        id: 1,
        name: 'spawn',
        type: 'spawn',
        x: 9 * TILE,
        y: 13 * TILE,
        width: TILE * 2,
        height: TILE,
        visible: true,
      },
    ],
    draworder: 'topdown',
  };
}

// --- Build Map JSON ---
function buildMap() {
  const layers = [
    makeLayer('Ground', generateGroundData()),
    makeLayer('GroundDecor', new Array(MAP_W * MAP_H).fill(0)),
    makeLayer('Walls', generateWallsData()),
    makeLayer('WallTops', generateWallTopsData()),
    makeLayer('Overlay', new Array(MAP_W * MAP_H).fill(0)),
    makeLayer('Collision', generateCollisionData()),
    generateObjectLayer(),
  ];

  layers.forEach((l, i) => { l.id = i + 1; });

  return {
    compressionlevel: -1,
    height: MAP_H,
    infinite: false,
    layers,
    nextlayerid: layers.length + 1,
    nextobjectid: 2,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width: MAP_W,
    tilesets: [
      {
        columns: WI_COLS,
        firstgid: WI_FIRST,
        image: '../tilesets/Walls_interior.png',
        imageheight: WI_ROWS * TILE,
        imagewidth: WI_COLS * TILE,
        margin: 0,
        name: 'Walls_interior',
        spacing: 0,
        tilecount: WI_COUNT,
        tileheight: TILE,
        tilewidth: TILE,
      },
      {
        columns: IF_COLS,
        firstgid: IF_FIRST,
        image: '../tilesets/Interior_1st_floor.png',
        imageheight: IF_ROWS * TILE,
        imagewidth: IF_COLS * TILE,
        margin: 0,
        name: 'Interior_1st_floor',
        spacing: 0,
        tilecount: IF_COUNT,
        tileheight: TILE,
        tilewidth: TILE,
      },
    ],
  };
}

// --- Write file ---
const mapsDir = join(ROOT, 'client/public/maps');
mkdirSync(mapsDir, { recursive: true });

const mapJson = JSON.stringify(buildMap(), null, 2);
writeFileSync(join(mapsDir, 'tavern.json'), mapJson);
console.log(`Wrote ${mapsDir}/tavern.json (${MAP_W}×${MAP_H} tiles, 2 tilesets)`);
