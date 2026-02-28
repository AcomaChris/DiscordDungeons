#!/usr/bin/env node

// --- create-test-map.js ---
// Generates a minimal Tiled-compatible JSON map + tileset PNG for testing
// the tilemap pipeline without needing the Tiled GUI.
//
// Usage: node scripts/create-test-map.js
// Output: client/public/maps/test.json, client/public/tilesets/test-tiles.png

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TILE = 16;
const MAP_W = 30; // tiles
const MAP_H = 20; // tiles

// --- Tileset: 4 tiles in a 4×1 strip ---
// Tile 1: dark floor, Tile 2: wall base, Tile 3: wall top, Tile 4: collision marker
const TILE_COLORS = [
  '#3a3a4a', // floor (dark stone)
  '#6b5b3a', // wall (brown)
  '#8b7b5a', // wall top (lighter brown)
  '#ff00ff', // collision marker (magenta, never rendered)
];

function createTilesetPNG() {
  const canvas = createCanvas(TILE * TILE_COLORS.length, TILE);
  const ctx = canvas.getContext('2d');

  TILE_COLORS.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * TILE, 0, TILE, TILE);
    // Add subtle grid lines for visibility
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeRect(i * TILE + 0.5, 0.5, TILE - 1, TILE - 1);
  });

  return canvas.toBuffer('image/png');
}

// --- Map layers ---
// Tile IDs are 1-indexed in Tiled format (0 = empty)
const FLOOR = 1;
const WALL = 2;
const WALL_TOP = 3;
const COLLISION = 4;

function makeLayer(name, data) {
  return {
    id: 0, // filled below
    name,
    type: 'tilelayer',
    x: 0,
    y: 0,
    width: MAP_W,
    height: MAP_H,
    opacity: 1,
    visible: true,
    data,
  };
}

function generateGroundData() {
  // Floor tiles everywhere
  return new Array(MAP_W * MAP_H).fill(FLOOR);
}

function generateWallsData() {
  // Interior obstacles: a few wall blocks in the middle area
  const data = new Array(MAP_W * MAP_H).fill(0);
  // Horizontal wall segment
  for (let x = 10; x <= 18; x++) {
    data[8 * MAP_W + x] = WALL;
  }
  // Vertical wall segment
  for (let y = 8; y <= 14; y++) {
    data[y * MAP_W + 14] = WALL;
  }
  // Small room corner
  for (let x = 22; x <= 26; x++) {
    data[4 * MAP_W + x] = WALL;
    data[10 * MAP_W + x] = WALL;
  }
  for (let y = 4; y <= 10; y++) {
    data[y * MAP_W + 22] = WALL;
    data[y * MAP_W + 26] = WALL;
  }
  return data;
}

function generateWallTopsData() {
  // Wall top tiles one row above each wall tile
  const walls = generateWallsData();
  const data = new Array(MAP_W * MAP_H).fill(0);
  for (let y = 1; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (walls[y * MAP_W + x] === WALL && walls[(y - 1) * MAP_W + x] !== WALL) {
        data[(y - 1) * MAP_W + x] = WALL_TOP;
      }
    }
  }
  return data;
}

function generateCollisionData() {
  const data = new Array(MAP_W * MAP_H).fill(0);
  // Border walls
  for (let x = 0; x < MAP_W; x++) {
    data[x] = COLLISION;                        // top
    data[(MAP_H - 1) * MAP_W + x] = COLLISION;  // bottom
  }
  for (let y = 0; y < MAP_H; y++) {
    data[y * MAP_W] = COLLISION;                 // left
    data[y * MAP_W + (MAP_W - 1)] = COLLISION;   // right
  }
  // Copy wall positions as collision
  const walls = generateWallsData();
  for (let i = 0; i < data.length; i++) {
    if (walls[i] === WALL) data[i] = COLLISION;
  }
  return data;
}

function generateObjectLayer() {
  return {
    id: 0,
    name: 'Objects',
    type: 'objectgroup',
    x: 0,
    y: 0,
    visible: true,
    opacity: 1,
    objects: [
      {
        id: 1,
        name: 'spawn',
        type: 'spawn',
        x: (MAP_W * TILE - TILE) / 2,
        y: (MAP_H * TILE - TILE) / 2,
        width: TILE,
        height: TILE,
        visible: true,
      },
    ],
    draworder: 'topdown',
  };
}

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

  // Assign sequential IDs
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
        columns: TILE_COLORS.length,
        firstgid: 1,
        image: '../tilesets/test-tiles.png',
        imageheight: TILE,
        imagewidth: TILE * TILE_COLORS.length,
        margin: 0,
        name: 'test-tiles',
        spacing: 0,
        tilecount: TILE_COLORS.length,
        tileheight: TILE,
        tilewidth: TILE,
      },
    ],
  };
}

// --- Write files ---
const mapsDir = join(ROOT, 'client/public/maps');
const tilesetsDir = join(ROOT, 'client/public/tilesets');
mkdirSync(mapsDir, { recursive: true });
mkdirSync(tilesetsDir, { recursive: true });

const mapJson = JSON.stringify(buildMap(), null, 2);
writeFileSync(join(mapsDir, 'test.json'), mapJson);
console.log(`Wrote ${mapsDir}/test.json (${MAP_W}×${MAP_H} tiles)`);

const pngBuf = createTilesetPNG();
writeFileSync(join(tilesetsDir, 'test-tiles.png'), pngBuf);
console.log(`Wrote ${tilesetsDir}/test-tiles.png (${TILE_COLORS.length} tiles)`);
