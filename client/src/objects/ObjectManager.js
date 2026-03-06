// --- ObjectManager ---
// Scene-level manager that owns all InteractiveObjects in the current map.
// Provides spatial queries, update loop, and object lifecycle management.
// AGENT: One instance per GameScene. Created after TileMapManager.create().

import { InteractiveObject } from './InteractiveObject.js';
import { TILE_SIZE } from '../core/Constants.js';

export class ObjectManager {
  constructor() {
    // Map<objectId, InteractiveObject>
    this._objects = new Map();
  }

  // Create InteractiveObjects from parsed map object layer data.
  // objectDataList: array of { id, name, type, x, y, width, height, properties }
  // from TileMapManager._parseObjects()
  createFromMapData(objectDataList) {
    for (const data of objectDataList) {
      // Skip spawn points — handled by TileMapManager
      if (data.type === 'spawn' || data.name === 'spawn') continue;

      // Parse component configs from __components property
      let components = [];
      if (data.properties?.__components) {
        try {
          components = JSON.parse(data.properties.__components);
        } catch { /* ignore malformed */ }
      }

      // Parse connections from __connections property
      let connections = [];
      if (data.properties?.__connections) {
        try {
          connections = JSON.parse(data.properties.__connections);
        } catch { /* ignore malformed */ }
      }

      const obj = new InteractiveObject({
        id: data.id || `obj_${this._objects.size}`,
        type: data.type || data.name || '',
        defId: data.properties?.defId || null,
        x: data.x,
        y: data.y,
        width: data.width || TILE_SIZE,
        height: data.height || TILE_SIZE,
        properties: data.properties || {},
        components,
        connections,
      });

      this._objects.set(obj.id, obj);
    }

    // Initialize all objects after creation (connections can resolve)
    for (const obj of this._objects.values()) {
      obj.init();
    }
  }

  update(delta) {
    for (const obj of this._objects.values()) {
      obj.update(delta);
    }
  }

  // --- Queries ---

  getObjectById(id) {
    return this._objects.get(id) || null;
  }

  getObjectsByType(type) {
    const result = [];
    for (const obj of this._objects.values()) {
      if (obj.type === type) result.push(obj);
    }
    return result;
  }

  // Returns objects within a pixel radius of (x, y), sorted by distance
  getObjectsInRadius(x, y, radius) {
    const result = [];
    for (const obj of this._objects.values()) {
      const dist = obj.distanceTo(x, y);
      if (dist <= radius) {
        result.push({ object: obj, distance: dist });
      }
    }
    result.sort((a, b) => a.distance - b.distance);
    return result.map(r => r.object);
  }

  // Returns objects within N tiles of (tileX, tileY)
  getObjectsInTileRadius(tileX, tileY, tileRadius) {
    return this.getObjectsInRadius(
      (tileX + 0.5) * TILE_SIZE,
      (tileY + 0.5) * TILE_SIZE,
      tileRadius * TILE_SIZE,
    );
  }

  get all() {
    return [...this._objects.values()];
  }

  get size() {
    return this._objects.size;
  }

  destroy() {
    for (const obj of this._objects.values()) {
      obj.destroy();
    }
    this._objects.clear();
  }
}
