import { DEPTH_ABOVE_PLAYER } from '../core/Constants.js';

// --- TileMapManager ---
// Loads a Tiled JSON map and creates Phaser tilemap layers following our
// standard layer convention. Handles collision, object parsing, and cleanup.
//
// Layer convention (depth):
//   Ground(0), GroundDecor(1), Walls(2),
//   WallTops(DEPTH_ABOVE_PLAYER), Overlay(DEPTH_ABOVE_PLAYER+1),
//   Collision(not rendered), Objects(parsed, not rendered).

// AGENT: layer names are case-sensitive and must match the Tiled export.

const LAYER_CONFIG = [
  { name: 'Ground', depth: 0 },
  { name: 'GroundDecor', depth: 1 },
  { name: 'Walls', depth: 2 },
  { name: 'WallTops', depth: DEPTH_ABOVE_PLAYER },
  { name: 'Overlay', depth: DEPTH_ABOVE_PLAYER + 1 },
];

export class TileMapManager {
  constructor(scene) {
    this.scene = scene;
    this.tilemap = null;
    this.layers = {};
    this.collisionLayer = null;
    this.spawnPoint = null;
  }

  // --- Preload ---
  // Call from scene.preload(). Loads the JSON map and all tileset images.
  preload(mapKey, jsonPath, tilesetEntries) {
    this.scene.load.tilemapTiledJSON(mapKey, jsonPath);
    for (const { key, path } of tilesetEntries) {
      this.scene.load.image(key, path);
    }
    this._mapKey = mapKey;
    this._tilesetEntries = tilesetEntries;
  }

  // --- Create ---
  // Call from scene.create(). Builds the tilemap, layers, collision, and
  // parses the Objects layer for spawn points and other markers.
  create(mapKey) {
    const key = mapKey || this._mapKey;
    this.tilemap = this.scene.make.tilemap({ key });

    // Add all tilesets
    const tilesets = this._tilesetEntries.map(({ key: tsKey, tiledName }) =>
      this.tilemap.addTilesetImage(tiledName, tsKey),
    );

    // Create visible tile layers
    for (const { name, depth } of LAYER_CONFIG) {
      const layer = this.tilemap.createLayer(name, tilesets);
      if (layer) {
        layer.setDepth(depth);
        this.layers[name] = layer;
      }
    }

    // Collision layer — invisible, any non-empty tile blocks
    const collisionLayer = this.tilemap.createLayer('Collision', tilesets);
    if (collisionLayer) {
      collisionLayer.setVisible(false);
      collisionLayer.setCollisionByExclusion([-1]);
      this.collisionLayer = collisionLayer;
    }

    // Parse object layer for spawn point and other objects
    this._parseObjects();

    return this.tilemap;
  }

  _parseObjects() {
    const objectLayer = this.tilemap.getObjectLayer('Objects');
    if (!objectLayer) {
      // Fallback spawn: center of map
      this.spawnPoint = {
        x: (this.tilemap.widthInPixels / 2),
        y: (this.tilemap.heightInPixels / 2),
      };
      return;
    }

    for (const obj of objectLayer.objects) {
      if (obj.type === 'spawn' || obj.name === 'spawn') {
        this.spawnPoint = { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
      }
    }

    // Fallback if no spawn object found
    if (!this.spawnPoint) {
      this.spawnPoint = {
        x: (this.tilemap.widthInPixels / 2),
        y: (this.tilemap.heightInPixels / 2),
      };
    }
  }

  getWorldBounds() {
    if (!this.tilemap) return { width: 0, height: 0 };
    return {
      width: this.tilemap.widthInPixels,
      height: this.tilemap.heightInPixels,
    };
  }

  destroy() {
    if (this.tilemap) {
      this.tilemap.destroy();
      this.tilemap = null;
    }
    this.layers = {};
    this.collisionLayer = null;
    this.spawnPoint = null;
  }
}
