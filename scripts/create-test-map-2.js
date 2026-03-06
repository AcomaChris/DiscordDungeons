#!/usr/bin/env node

// --- create-test-map-2.js ---
// Generates a second test map for map transition testing.
// Reuses the same test-tiles tileset as the main test map.
//
// Usage: node scripts/create-test-map-2.js
// Output: client/public/maps/test2.json

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const TILE = 16;
const MAP_W = 20;
const MAP_H = 16;

const FLOOR = 9;
const WALL = 2;
const COLLISION = 4;

function makeLayer(name, data) {
  return {
    id: 0,
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
  return new Array(MAP_W * MAP_H).fill(FLOOR);
}

function generateWallsData() {
  const data = new Array(MAP_W * MAP_H).fill(0);
  // Small interior wall segment
  for (let x = 8; x <= 12; x++) {
    data[6 * MAP_W + x] = WALL;
  }
  return data;
}

function generateCollisionData() {
  const data = new Array(MAP_W * MAP_H).fill(0);
  // Border walls
  for (let x = 0; x < MAP_W; x++) {
    data[x] = COLLISION;
    data[(MAP_H - 1) * MAP_W + x] = COLLISION;
  }
  for (let y = 0; y < MAP_H; y++) {
    data[y * MAP_W] = COLLISION;
    data[y * MAP_W + (MAP_W - 1)] = COLLISION;
  }
  // Copy interior walls
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
      // Default spawn
      {
        id: 1,
        name: 'spawn',
        type: 'spawn',
        x: 10 * TILE,
        y: 10 * TILE,
        width: TILE,
        height: TILE,
        visible: true,
      },
      // Named spawn — arrival point from test map
      {
        id: 2,
        name: 'entrance',
        type: 'spawn',
        x: 3 * TILE,
        y: 8 * TILE,
        width: TILE,
        height: TILE,
        visible: true,
      },
      // Teleporter back to test map
      {
        id: 3,
        name: 'return_teleporter',
        type: 'teleporter',
        x: 3 * TILE,
        y: 7 * TILE,
        width: TILE,
        height: TILE,
        visible: true,
        properties: [
          { name: '__components', type: 'string', value: JSON.stringify([
            { id: 'teleporter', targetMap: 'test', targetSpawn: 'test2-return' },
          ]) },
        ],
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
    makeLayer('WallTops', new Array(MAP_W * MAP_H).fill(0)),
    makeLayer('Overlay', new Array(MAP_W * MAP_H).fill(0)),
    makeLayer('Collision', generateCollisionData()),
    makeLayer('Elevation', new Array(MAP_W * MAP_H).fill(0)),
    generateObjectLayer(),
  ];

  layers.forEach((l, i) => { l.id = i + 1; });

  return {
    compressionlevel: -1,
    height: MAP_H,
    infinite: false,
    layers,
    nextlayerid: layers.length + 1,
    nextobjectid: 4,
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
        columns: 9,
        firstgid: 1,
        image: '../tilesets/test-tiles.png',
        imageheight: TILE,
        imagewidth: TILE * 9,
        margin: 0,
        name: 'test-tiles',
        spacing: 0,
        tilecount: 9,
        tileheight: TILE,
        tilewidth: TILE,
      },
    ],
  };
}

const mapsDir = join(ROOT, 'client/public/maps');
mkdirSync(mapsDir, { recursive: true });

const mapJson = JSON.stringify(buildMap(), null, 2);
writeFileSync(join(mapsDir, 'test2.json'), mapJson);
console.log(`Wrote ${mapsDir}/test2.json (${MAP_W}×${MAP_H} tiles)`);
