import { DEPTH_ABOVE_PLAYER, ELEVATION_STEP } from '../core/Constants.js';
import { TileAnimator } from './TileAnimator.js';

// --- TileMapManager ---
// Loads a Tiled JSON map and creates Phaser tilemap layers following our
// standard layer convention. Handles collision, object parsing, and cleanup.
//
// Layer convention (depth):
//   Ground(0), GroundDecor(1), Walls(2),
//   WallTops(DEPTH_ABOVE_PLAYER), Overlay(DEPTH_ABOVE_PLAYER+1),
//   Collision(not rendered), Elevation(not rendered), Objects(parsed, not rendered).

// AGENT: layer names are case-sensitive and must match the Tiled export.

const LAYER_CONFIG = [
  { name: 'Ground', depth: 0 },
  { name: 'GroundDecor', depth: 1 },
  { name: 'Walls', depth: 2 },
  { name: 'Furniture', depth: 2 },
  { name: 'Characters', depth: 2 },
  { name: 'WallTops', depth: DEPTH_ABOVE_PLAYER },
  { name: 'Overlay', depth: DEPTH_ABOVE_PLAYER + 1 },
];

export class TileMapManager {
  constructor(scene) {
    this.scene = scene;
    this.tilemap = null;
    this.layers = {};
    this.collisionLayer = null;
    this.elevationData = null;
    this.spawnPoint = null;
    this.spawnPoints = new Map();
    this.tileAnimator = null;
    this.objectData = [];
  }

  // --- Preload ---
  // Call from scene.preload(). Loads the JSON map and all tileset images.
  preload(mapKey, jsonPath, tilesetEntries) {
    // AGENT: Static files in public/ don't get Vite content hashes, so browsers
    // may serve stale versions after deploys. Append version to bust cache.
    const cacheBust = typeof __APP_VERSION__ !== 'undefined' ? `?v=${__APP_VERSION__}` : '';

    this.scene.load.tilemapTiledJSON(mapKey, jsonPath + cacheBust);
    for (const { key, path, tileSize, tiledName, hasAnimationJson } of tilesetEntries) {
      if (tileSize) {
        // Spritesheet loading creates numbered frames (0, 1, 2...) so individual
        // tiles can be used as sprite textures for Y-sorted wall rendering.
        this.scene.load.spritesheet(key, path + cacheBust, { frameWidth: tileSize, frameHeight: tileSize });
      } else {
        this.scene.load.image(key, path + cacheBust);
      }
      // Load external animation data only if tileset opts in via hasAnimationJson flag.
      // Tiled-embedded animations (in the map JSON) are always used regardless.
      if (tiledName && hasAnimationJson) {
        this.scene.load.json(`anim-${tiledName}`, `tile-metadata/${tiledName}.animations.json` + cacheBust);
      }
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

    // Convert Walls/WallTops tiles to individual Y-sorted sprites
    this._ySortWallLayers();

    // Collision layer — invisible, any non-empty tile blocks
    const collisionLayer = this.tilemap.createLayer('Collision', tilesets);
    if (collisionLayer) {
      collisionLayer.setVisible(false);
      collisionLayer.setCollisionByExclusion([-1]);
      this.collisionLayer = collisionLayer;
    }

    // Elevation layer — optional, stores per-tile height for platform system.
    // Tile index = elevation level (0 = ground). Hidden, not rendered.
    this._parseElevation(tilesets);

    // Parse object layer for spawn point and other objects
    this._parseObjects();

    // Inject animation data from .animations.json files into tileset tileData
    // so TileAnimator can pick them up without embedding data in map JSONs
    this._injectAnimationData();

    // Tile animations — index-swapping engine driven by Tiled animation data
    this.tileAnimator = new TileAnimator();
    this.tileAnimator.init(this.tilemap, this.layers, this.wallSprites);

    return this.tilemap;
  }

  // --- Y-Sorted Wall Sprites ---
  // Tile layers have a single depth for all tiles, which breaks 3/4 view
  // depth sorting. We convert wall tiles to individual sprites so each can
  // have depth = bottom Y, enabling proper Y-sorting with player sprites.
  _ySortWallLayers() {
    this.wallSprites = [];
    const tileHeight = this.tilemap.tileHeight;

    for (const layerName of ['Walls', 'Furniture', 'Characters', 'WallTops']) {
      const layer = this.layers[layerName];
      if (!layer) continue;

      layer.forEachTile((tile) => {
        if (tile.index <= 0) return;

        const { tilesetKey, frame, firstgid } = this._resolveTile(tile.index);

        // Guard: skip tiles whose tileset texture doesn't exist or frame is invalid
        const tex = this.scene.textures.get(tilesetKey);
        if (!tex || tex.key === '__MISSING') {
          console.warn(`[TileMapManager] Missing texture "${tilesetKey}" for tile GID ${tile.index} on layer "${layerName}"`);
          return;
        }

        const sprite = this.scene.add.sprite(
          tile.pixelX + tile.width / 2,
          tile.pixelY + tile.height / 2,
          tilesetKey,
          frame,
        );

        // Guard: verify the sprite's frame source is valid (prevents glTexture null crash)
        if (!sprite.frame || !sprite.frame.source) {
          console.warn(`[TileMapManager] Invalid frame ${frame} in "${tilesetKey}" for tile GID ${tile.index}`);
          sprite.destroy();
          return;
        }

        sprite.setDepth(tile.pixelY + tileHeight);
        // AGENT: TileAnimator reads _tileFirstgid to reconstruct GID from local frame
        sprite._tileFirstgid = firstgid;
        this.wallSprites.push(sprite);
      });

      layer.setVisible(false);
    }
  }

  // --- Resolve Tile GID ---
  // Given a global tile ID, returns the tileset key, local frame index,
  // and firstgid. Iterates tilesets in reverse to find the highest
  // firstgid that is <= the GID.
  _resolveTile(gid) {
    for (let i = this.tilemap.tilesets.length - 1; i >= 0; i--) {
      const ts = this.tilemap.tilesets[i];
      if (gid >= ts.firstgid) {
        return {
          tilesetKey: this._tilesetEntries[i].key,
          frame: gid - ts.firstgid,
          firstgid: ts.firstgid,
        };
      }
    }
    return {
      tilesetKey: this._tilesetEntries[0].key,
      frame: gid - this.tilemap.tilesets[0].firstgid,
      firstgid: this.tilemap.tilesets[0].firstgid,
    };
  }

  // --- Inject Animation Data ---
  // Populates tileset.tileData with animation definitions loaded from
  // .animations.json files. This bridges the extracted TMX animation data
  // into Phaser's tileset format so TileAnimator can use it.
  _injectAnimationData() {
    const cache = this.scene.cache.json;
    for (const tileset of this.tilemap.tilesets) {
      const animKey = `anim-${tileset.name}`;
      if (!cache.has(animKey)) continue;

      const animData = cache.get(animKey);
      if (!animData || !animData.animations) continue;

      if (!tileset.tileData) tileset.tileData = {};

      for (const [localIdStr, frames] of Object.entries(animData.animations)) {
        if (!tileset.tileData[localIdStr]) {
          tileset.tileData[localIdStr] = {};
        }
        // Only inject if the tileset doesn't already have animation data for this tile
        if (!tileset.tileData[localIdStr].animation) {
          tileset.tileData[localIdStr].animation = frames;
        }
      }
    }
  }

  _parseElevation(tilesets) {
    const elevationLayer = this.tilemap.createLayer('Elevation', tilesets);
    if (!elevationLayer) return;

    elevationLayer.setVisible(false);
    this.elevationData = [];
    const w = this.tilemap.width;
    const h = this.tilemap.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = elevationLayer.getTileAt(x, y);
        // Tile index encodes elevation level; empty tiles = ground (0)
        this.elevationData.push(tile && tile.index > 0 ? tile.index : 0);
      }
    }
  }

  // Returns the elevation in world pixels at a given world coordinate.
  getElevationAt(worldX, worldY) {
    if (!this.elevationData) return 0;
    const tileX = Math.floor(worldX / this.tilemap.tileWidth);
    const tileY = Math.floor(worldY / this.tilemap.tileHeight);
    if (tileX < 0 || tileX >= this.tilemap.width || tileY < 0 || tileY >= this.tilemap.height) return 0;
    return (this.elevationData[tileY * this.tilemap.width + tileX] || 0) * ELEVATION_STEP;
  }

  _parseObjects() {
    const objectLayer = this.tilemap.getObjectLayer('Objects');
    if (!objectLayer) {
      // Fallback spawn: center of map
      this.spawnPoint = {
        x: (this.tilemap.widthInPixels / 2),
        y: (this.tilemap.heightInPixels / 2),
      };
      this.objectData = [];
      return;
    }

    this.objectData = [];
    for (const obj of objectLayer.objects) {
      if (obj.type === 'spawn' || obj.name === 'spawn') {
        const pos = { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 };
        if (!this.spawnPoint) this.spawnPoint = pos;
        this.spawnPoints.set(obj.name || 'default', pos);
        continue;
      }

      // Convert Tiled property array [{name, value}] to flat object
      const properties = {};
      if (Array.isArray(obj.properties)) {
        for (const prop of obj.properties) {
          properties[prop.name] = prop.value;
        }
      } else if (obj.properties) {
        Object.assign(properties, obj.properties);
      }

      this.objectData.push({
        id: obj.id,
        name: obj.name || '',
        type: obj.type || '',
        x: obj.x,
        y: obj.y,
        width: obj.width || 0,
        height: obj.height || 0,
        properties,
      });
    }

    // Fallback if no spawn object found
    if (!this.spawnPoint) {
      this.spawnPoint = {
        x: (this.tilemap.widthInPixels / 2),
        y: (this.tilemap.heightInPixels / 2),
      };
    }
  }

  update(delta) {
    if (this.tileAnimator) this.tileAnimator.update(delta);
  }

  // Resolve a spawn target to {x, y} coordinates.
  // Accepts: string (named spawn lookup), {x, y} (pass-through), or null (default spawn).
  getSpawnTarget(target) {
    if (!target) return this.spawnPoint;
    if (typeof target === 'string') {
      return this.spawnPoints.get(target) || this.spawnPoint;
    }
    if (typeof target.x === 'number' && typeof target.y === 'number') return target;
    return this.spawnPoint;
  }

  getWorldBounds() {
    if (!this.tilemap) return { width: 0, height: 0 };
    return {
      width: this.tilemap.widthInPixels,
      height: this.tilemap.heightInPixels,
    };
  }

  destroy() {
    for (const s of this.wallSprites || []) {
      s.destroy();
    }
    this.wallSprites = [];

    if (this.tileAnimator) {
      this.tileAnimator.destroy();
      this.tileAnimator = null;
    }

    if (this.tilemap) {
      this.tilemap.destroy();
      this.tilemap = null;
    }
    this.layers = {};
    this.collisionLayer = null;
    this.elevationData = null;
    this.spawnPoint = null;
    this.spawnPoints.clear();
    this.objectData = [];
  }
}
