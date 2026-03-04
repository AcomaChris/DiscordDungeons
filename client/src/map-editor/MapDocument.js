// --- MapDocument ---
// Central document model for the map editor. Holds all tilesets, layers, objects,
// and the command stack. All components read from and write to this model.

import { SparseLayer } from './SparseLayer.js';
import { CommandStack } from './CommandStack.js';

// Fixed layer names matching TileMapManager convention
const TILE_LAYER_NAMES = ['Ground', 'GroundDecor', 'Walls', 'WallTops', 'Overlay', 'Collision', 'Elevation'];

// Layer groups for UI
export const LAYER_GROUPS = {
  Floor: ['Ground', 'GroundDecor'],
  Structures: ['Walls', 'WallTops', 'Overlay'],
  System: ['Collision', 'Elevation'],
};

export const ALL_LAYER_NAMES = TILE_LAYER_NAMES;

export class MapDocument {
  constructor() {
    this.tilesets = [];      // Array<TilesetEntry>
    this.layers = {};        // { layerName: SparseLayer }
    this.objects = [];       // Array<MapObject>
    this.metadata = {
      name: 'Untitled',
      tileWidth: 16,
      tileHeight: 16,
    };
    this.commandStack = new CommandStack();
    this._nextObjectId = 1;
    this._listeners = [];

    // Create all tile layers
    for (const name of TILE_LAYER_NAMES) {
      this.layers[name] = new SparseLayer(name);
    }
  }

  // --- Tilesets ---

  addTileset(entry) {
    // Compute firstgid: after the last tileset's tiles
    if (this.tilesets.length === 0) {
      entry.firstgid = 1;
    } else {
      const last = this.tilesets[this.tilesets.length - 1];
      entry.firstgid = last.firstgid + last.tileCount;
    }
    this.tilesets.push(entry);
    this._notify();
    return entry;
  }

  removeTileset(name) {
    const idx = this.tilesets.findIndex(ts => ts.name === name);
    if (idx < 0) return false;
    this.tilesets.splice(idx, 1);
    // Recompute firstgids
    this._recomputeFirstGids();
    this._notify();
    return true;
  }

  getTilesetByName(name) {
    return this.tilesets.find(ts => ts.name === name) || null;
  }

  // Resolve a GID to its tileset and local tile ID
  resolveGid(gid) {
    if (gid <= 0) return null;
    for (let i = this.tilesets.length - 1; i >= 0; i--) {
      if (gid >= this.tilesets[i].firstgid) {
        return {
          tileset: this.tilesets[i],
          localId: gid - this.tilesets[i].firstgid,
        };
      }
    }
    return null;
  }

  _recomputeFirstGids() {
    let nextGid = 1;
    for (const ts of this.tilesets) {
      ts.firstgid = nextGid;
      nextGid += ts.tileCount;
    }
  }

  // --- Objects ---

  addObject(obj) {
    if (!obj.id) obj.id = this._nextObjectId++;
    else if (obj.id >= this._nextObjectId) this._nextObjectId = obj.id + 1;
    this.objects.push(obj);
    this._notify();
    return obj;
  }

  removeObject(id) {
    const idx = this.objects.findIndex(o => o.id === id);
    if (idx >= 0) {
      this.objects.splice(idx, 1);
      this._notify();
      return true;
    }
    return false;
  }

  getObjectById(id) {
    return this.objects.find(o => o.id === id) || null;
  }

  // --- Layers ---

  getLayer(name) {
    return this.layers[name] || null;
  }

  // Compute bounding box across all layers + objects
  getGlobalBounds() {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const layer of Object.values(this.layers)) {
      const b = layer.getBounds();
      if (!b) continue;
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    }

    for (const obj of this.objects) {
      const tileX = Math.floor(obj.x / this.metadata.tileWidth);
      const tileY = Math.floor(obj.y / this.metadata.tileHeight);
      const endX = tileX + Math.ceil((obj.width || 16) / this.metadata.tileWidth);
      const endY = tileY + Math.ceil((obj.height || 16) / this.metadata.tileHeight);
      if (tileX < minX) minX = tileX;
      if (tileY < minY) minY = tileY;
      if (endX > maxX) maxX = endX;
      if (endY > maxY) maxY = endY;
    }

    if (minX === Infinity) return { minX: 0, minY: 0, width: 1, height: 1 };

    return {
      minX, minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  // --- Collision auto-populate ---
  // Scan all tile layers for tiles with collision: 'solid' metadata
  // and populate the Collision layer. Returns the number of tiles set.
  autoPopulateCollision() {
    const collisionLayer = this.getLayer('Collision');
    if (!collisionLayer) return 0;

    // Use GID 1 as the collision marker (any non-zero GID)
    const COLLISION_GID = 1;
    const tileLayers = ['Ground', 'GroundDecor', 'Walls', 'WallTops', 'Overlay'];
    let count = 0;

    // Clear existing collision data
    collisionLayer.clear();

    for (const layerName of tileLayers) {
      const layer = this.getLayer(layerName);
      if (!layer || layer.size === 0) continue;

      layer.forEach((x, y, gid) => {
        // Already marked as collision — skip
        if (collisionLayer.get(x, y) !== 0) return;

        const resolved = this.resolveGid(gid);
        if (!resolved) return;

        const { tileset, localId } = resolved;
        const meta = tileset.metadata?.tiles?.[String(localId)];
        if (meta && meta.collision === 'solid') {
          collisionLayer.set(x, y, COLLISION_GID);
          count++;
        }
      });
    }

    this._notify();
    return count;
  }

  // --- Reset ---

  reset() {
    this.tilesets = [];
    this.objects = [];
    this._nextObjectId = 1;
    for (const layer of Object.values(this.layers)) {
      layer.clear();
    }
    this.commandStack.clear();
    this.metadata.name = 'Untitled';
    this._notify();
  }

  // --- Change listeners ---

  addListener(fn) {
    this._listeners.push(fn);
  }

  removeListener(fn) {
    this._listeners = this._listeners.filter(l => l !== fn);
  }

  _notify() {
    for (const fn of this._listeners) fn();
  }
}
