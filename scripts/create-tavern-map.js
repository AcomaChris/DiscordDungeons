#!/usr/bin/env node

// --- create-tavern-map.js ---
// Generates a Tiled-compatible JSON map for a cozy tavern interior using
// Walls_interior (structure/floor) and Interior_1st_floor (furniture/props).
//
// Usage: node scripts/create-tavern-map.js
// Output: client/public/maps/tavern.json
//
// AGENT: Furniture placement uses ObjectPlacer with object definitions.
// Structural elements (walls, columns) and decorations (plants) use direct GIDs.

import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ObjectPlacer } from './lib/ObjectPlacer.js';

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

function wi(col, row) { return row * WI_COLS + col + WI_FIRST; }
function iff(col, row) { return row * IF_COLS + col + IF_FIRST; }
function idx(x, y) { return y * MAP_W + x; }

// --- ObjectPlacer setup ---
// Furniture placement uses object definitions instead of hardcoded GIDs.
const ifDefs = JSON.parse(readFileSync(
  join(ROOT, 'client/public/object-defs/Interior_1st_floor.objects.json'), 'utf-8',
));
const placer = new ObjectPlacer(
  { Interior_1st_floor: ifDefs },
  [{ name: 'Interior_1st_floor', firstgid: IF_FIRST, columns: IF_COLS }],
);

// --- Walls_interior Tile GIDs ---
// AGENT: Structural tiles without object defs — verified via tile analysis pipeline.

const WALL_TOP_M  = wi(4, 0);   // Wall top, repeating beam pattern
const WALL_MID_L  = wi(4, 9);   // Wall face, left
const WALL_MID_M  = wi(5, 9);   // Wall face, middle (repeatable)
const WALL_MID_R  = wi(6, 9);   // Wall face, right
const STONE_FLOOR  = wi(0, 10); // Primary floor tile
const STONE_FLOOR2 = wi(1, 10); // Floor variant for checkerboard
const COL_TOP = wi(1, 2);       // Pillar top
const COL_MID = wi(1, 3);       // Pillar middle

// --- Decorative tiles without object defs ---
const PLANT_1 = iff(1, 7);
const PLANT_2 = iff(2, 7);

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
// Wall faces and furniture — converted to Y-sorted sprites by TileMapManager.
// Furniture uses ObjectPlacer; structural elements use direct GIDs.
function generateWallsData() {
  const data = new Array(MAP_W * MAP_H).fill(0);

  // --- North wall face (row 1) ---
  for (let x = 0; x < MAP_W; x++) {
    data[idx(x, 1)] = WALL_MID_M;
  }
  data[idx(0, 1)] = WALL_MID_L;
  data[idx(MAP_W - 1, 1)] = WALL_MID_R;

  // --- Bar area (against north wall) ---
  // Bottle shelves (rows 2-3) — four 2×2 shelf units
  placer.place('shelf_unit_2x2', 3, 2).applyTo(data, null, MAP_W);
  placer.place('shelf_unit_2x2', 5, 2).applyTo(data, null, MAP_W);
  placer.place('shelf_unit_2x2', 7, 2).applyTo(data, null, MAP_W);
  placer.place('shelf_unit_2x2', 9, 2).applyTo(data, null, MAP_W);

  // Bar counter (rows 4-5, cols 2-13) — stretched: left + 10×middle + right
  placer.place('bar_counter_3x2', 2, 4, { stretch: 10 }).applyTo(data, null, MAP_W);

  // --- Seating area ---
  // Table group 1: large table with chairs (left side)
  placer.place('large_table_4x2', 2, 7).applyTo(data, null, MAP_W);
  placer.place('chair_red_2x2', 2, 9).applyTo(data, null, MAP_W);
  placer.place('chair_red_2x2', 4, 9).applyTo(data, null, MAP_W);

  // Table group 2: medium table (center)
  placer.place('small_table_2x2', 9, 7).applyTo(data, null, MAP_W);

  // Table group 3: medium table (right side)
  placer.place('small_table_2x2', 14, 7).applyTo(data, null, MAP_W);
  placer.place('small_table_2x2', 14, 9).applyTo(data, null, MAP_W);

  // Table group 4: large table near door (bottom-left)
  placer.place('large_table_4x2', 2, 11).applyTo(data, null, MAP_W);

  // --- Barrels (bottom-right corner) ---
  placer.place('barrel_single', 17, 11).applyTo(data, null, MAP_W);
  placer.place('barrel_single', 18, 11).applyTo(data, null, MAP_W);
  placer.place('barrel_single', 17, 12).applyTo(data, null, MAP_W);

  // --- Decorative elements (no object defs) ---
  data[idx(15, 3)] = PLANT_1;
  data[idx(17, 3)] = PLANT_2;

  // Columns flanking the main area
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
