#!/usr/bin/env node
// --- TMX → Tiled JSON Converter ---
// Converts a Tiled .tmx file (infinite/chunk format) into a finite Tiled JSON
// that Phaser can load. Merges TMX layers into standard game layer names.
//
// Usage: node scripts/convert-tmx.js

import { readFileSync, writeFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Config ---
const INPUT = resolve(__dirname, '../assets/tilesets/tavern/Tiled_files/Tavern_interior_1nd_floor.tmx');
const OUTPUT = resolve(__dirname, '../client/public/maps/tavern.json');

// TMX layer name → output layer name. Layers mapping to the same target get merged.
const LAYER_MAP = {
  'floor': 'Ground',
  'Stairs': 'GroundDecor',
  'Walls': 'Walls',
  'Furniture1': 'Furniture',
  'Furniture2': 'Furniture',
  'Furniture3': 'Furniture',
  'Stuff_on_tables': 'Furniture',
  'Walls_top1': 'WallTops',
  'Walls_top2': 'WallTops',
  'Characters1': 'Characters',
  'Characters2': 'Characters',
  'Charactes3': 'Characters',  // typo in TMX source
  'Tile Layer 13': 'Overlay',
};

// Order matters for merging — later entries overwrite earlier at same cell
const MERGE_ORDER = [
  'floor', 'Stairs', 'Walls',
  'Furniture1', 'Furniture2', 'Furniture3', 'Stuff_on_tables',
  'Walls_top1', 'Walls_top2',
  'Characters1', 'Characters2', 'Charactes3',
  'Tile Layer 13',
];

// --- Parse TMX ---

const xml = readFileSync(INPUT, 'utf-8');
const dom = new JSDOM(xml, { contentType: 'text/xml' });
const doc = dom.window.document;
const mapEl = doc.querySelector('map');

const tileWidth = parseInt(mapEl.getAttribute('tilewidth'));
const tileHeight = parseInt(mapEl.getAttribute('tileheight'));

// --- Parse tilesets ---
// Use PNG filename (without extension) as tileset name to avoid duplicates
// in the TMX source and match animation JSON file naming convention.
const tilesets = [];
for (const ts of doc.querySelectorAll('map > tileset')) {
  const imageEl = ts.querySelector('image');
  const imageSource = imageEl.getAttribute('source');
  const nameFromImage = imageSource.replace(/\.png$/, '');
  tilesets.push({
    firstgid: parseInt(ts.getAttribute('firstgid')),
    name: nameFromImage,
    tilewidth: tileWidth,
    tileheight: tileHeight,
    tilecount: parseInt(ts.getAttribute('tilecount')),
    columns: parseInt(ts.getAttribute('columns')),
    imagewidth: parseInt(imageEl.getAttribute('width')),
    imageheight: parseInt(imageEl.getAttribute('height')),
    image: imageSource,
  });
}

// --- Parse chunks from each layer, compute bounding box ---
let minChunkX = Infinity, minChunkY = Infinity;
let maxChunkX = -Infinity, maxChunkY = -Infinity;

const rawLayers = {};
for (const layerEl of doc.querySelectorAll('map > layer')) {
  const name = layerEl.getAttribute('name');
  const chunks = [];
  for (const chunkEl of layerEl.querySelectorAll('chunk')) {
    const cx = parseInt(chunkEl.getAttribute('x'));
    const cy = parseInt(chunkEl.getAttribute('y'));
    const cw = parseInt(chunkEl.getAttribute('width'));
    const ch = parseInt(chunkEl.getAttribute('height'));

    minChunkX = Math.min(minChunkX, cx);
    minChunkY = Math.min(minChunkY, cy);
    maxChunkX = Math.max(maxChunkX, cx + cw);
    maxChunkY = Math.max(maxChunkY, cy + ch);

    // Parse CSV tile data
    const text = chunkEl.textContent.trim();
    const tiles = text.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    chunks.push({ x: cx, y: cy, width: cw, height: ch, tiles });
  }
  rawLayers[name] = chunks;
}

// Map origin offset — shift everything so top-left is (0,0)
const offsetX = -minChunkX;
const offsetY = -minChunkY;
const mapWidth = maxChunkX - minChunkX;
const mapHeight = maxChunkY - minChunkY;

console.log(`Map bounds: (${minChunkX},${minChunkY}) to (${maxChunkX},${maxChunkY}) = ${mapWidth}×${mapHeight} tiles`);

// --- Merge layers ---
// Build flat data arrays per output layer
const outputData = {};

for (const tmxName of MERGE_ORDER) {
  const targetName = LAYER_MAP[tmxName];
  if (!targetName) continue;

  const chunks = rawLayers[tmxName];
  if (!chunks) continue;

  if (!outputData[targetName]) {
    outputData[targetName] = new Array(mapWidth * mapHeight).fill(0);
  }

  const data = outputData[targetName];
  for (const chunk of chunks) {
    for (let row = 0; row < chunk.height; row++) {
      for (let col = 0; col < chunk.width; col++) {
        const gid = chunk.tiles[row * chunk.width + col];
        if (gid === 0) continue; // empty tile, don't overwrite

        const mapCol = chunk.x + offsetX + col;
        const mapRow = chunk.y + offsetY + row;
        data[mapRow * mapWidth + mapCol] = gid;
      }
    }
  }
}

// --- Build output JSON ---
// Ordered output layers (matching game convention)
const OUTPUT_LAYER_ORDER = ['Ground', 'GroundDecor', 'Walls', 'Furniture', 'WallTops', 'Characters', 'Overlay'];

let layerId = 1;
const layers = [];

for (const name of OUTPUT_LAYER_ORDER) {
  const data = outputData[name];
  if (!data) continue;

  layers.push({
    id: layerId++,
    name,
    type: 'tilelayer',
    x: 0,
    y: 0,
    width: mapWidth,
    height: mapHeight,
    opacity: 1,
    visible: true,
    data,
  });
}

// Add empty Collision layer
layers.push({
  id: layerId++,
  name: 'Collision',
  type: 'tilelayer',
  x: 0,
  y: 0,
  width: mapWidth,
  height: mapHeight,
  opacity: 1,
  visible: true,
  data: new Array(mapWidth * mapHeight).fill(0),
});

// Add Objects layer with default spawn point at center
layers.push({
  id: layerId++,
  name: 'Objects',
  type: 'objectgroup',
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  objects: [
    {
      id: 1,
      name: 'spawn',
      type: 'spawn',
      x: Math.floor(mapWidth / 2) * tileWidth,
      y: Math.floor(mapHeight / 2) * tileHeight,
      width: tileWidth,
      height: tileHeight,
      visible: true,
    },
  ],
});

// Build tileset references for JSON (Tiled JSON format)
const jsonTilesets = tilesets.map(ts => ({
  firstgid: ts.firstgid,
  name: ts.name,
  tilewidth: ts.tilewidth,
  tileheight: ts.tileheight,
  tilecount: ts.tilecount,
  columns: ts.columns,
  image: `../tilesets/${ts.image}`,
  imagewidth: ts.imagewidth,
  imageheight: ts.imageheight,
  margin: 0,
  spacing: 0,
}));

const output = {
  compressionlevel: -1,
  width: mapWidth,
  height: mapHeight,
  tilewidth: tileWidth,
  tileheight: tileHeight,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  layers,
  tilesets: jsonTilesets,
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  nextlayerid: layerId,
  nextobjectid: 2,
};

writeFileSync(OUTPUT, JSON.stringify(output, null, 2));

// --- Summary ---
const tileCount = Object.values(outputData).reduce((sum, d) => sum + d.filter(v => v > 0).length, 0);
console.log(`\nOutput: ${OUTPUT}`);
console.log(`Size: ${mapWidth}×${mapHeight} tiles`);
console.log(`Layers: ${layers.map(l => l.name).join(', ')}`);
console.log(`Tilesets: ${tilesets.length}`);
console.log(`Non-empty tiles: ${tileCount}`);
