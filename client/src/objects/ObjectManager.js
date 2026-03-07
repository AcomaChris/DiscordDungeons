// --- ObjectManager ---
// Scene-level manager that owns all InteractiveObjects in the current map.
// Provides spatial queries, update loop, and object lifecycle management.
// AGENT: One instance per GameScene. Created after TileMapManager.create().

// @doc-creator-content 04:Objects > Object Manager
// Scene-level manager that owns all `InteractiveObject` instances for the current map.
// `createFromMapData(objectDataList)` parses the Objects layer output from TileMapManager.
// Spatial queries: `getObjectById(id)`, `getObjectsByType(type)`,
// `getObjectsInRadius(x, y, radius)` (sorted by distance),
// `getObjectsInTileRadius(tileX, tileY, tileRadius)`. Access all objects via `.all`.

import { InteractiveObject } from './InteractiveObject.js';
import { TILE_SIZE, DEPTH_ABOVE_PLAYER } from '../core/Constants.js';

// Self-registering component imports — each registers itself with componentRegistry
import './components/InteractableComponent.js';
import './components/DoorComponent.js';
import './components/ContainerComponent.js';
import './components/SwitchComponent.js';
import './components/TrapComponent.js';
import './components/DestructibleComponent.js';
import './components/TeleporterComponent.js';
import '../scripting/ScriptComponent.js';

// Debug colors per object type — distinct enough to tell apart at a glance
const TYPE_COLORS = {
  chest: 0xccaa44,
  door: 0x8866cc,
  sign: 0x44aacc,
  lever: 0xcc6644,
  switch: 0xcccc44,
  trap: 0xcc4444,
  destructible: 0xcc8844,
  teleporter: 0x44ffcc,
  npc: 0x44cc66,
  script: 0xcc44cc,
};
const DEFAULT_COLOR = 0x999999;

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

  // --- Debug Visuals ---
  // Creates colored rectangles for each object so they're visible in-game.
  // Call after createFromMapData() with the Phaser scene reference.
  // AGENT: These are placeholder visuals — real sprites come from tilesets later.
  createVisuals(scene) {
    this._sprites = [];
    for (const obj of this._objects.values()) {
      const color = TYPE_COLORS[obj.type] || DEFAULT_COLOR;
      const rect = scene.add.rectangle(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
        obj.width,
        obj.height,
        color,
        0.8,
      );
      rect.setStrokeStyle(1, 0xffffff, 0.6);
      rect.setDepth(obj.y + obj.height);
      this._sprites.push(rect);
      obj._debugSprite = rect;
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
    for (const sprite of this._sprites || []) {
      sprite.destroy();
    }
    this._sprites = [];
    for (const obj of this._objects.values()) {
      obj.destroy();
    }
    this._objects.clear();
  }
}
