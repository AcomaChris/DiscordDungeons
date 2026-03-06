// --- ObjectEventRouter ---
// Routes events between InteractiveObjects using named connections.
// Listens for OBJECT_EVENT on EventBus, resolves source object's connections,
// and calls receiveEvent() on matching targets.
// AGENT: Created once per GameScene, after ObjectManager. Destroyed with scene.

import eventBus from '../core/EventBus.js';
import { OBJECT_EVENT } from '../core/Events.js';

export class ObjectEventRouter {
  constructor(objectManager) {
    this._objectManager = objectManager;
    this._handler = (payload) => this._route(payload);
    eventBus.on(OBJECT_EVENT, this._handler);
  }

  _route({ sourceId, eventName, data }) {
    if (import.meta.env.DEV) {
      console.debug(`[ObjectEvent] ${sourceId} → ${eventName}`, data);
    }

    const source = this._objectManager.getObjectById(sourceId);
    if (!source) return;

    for (const conn of source.connections) {
      // Connection fires when emitted event matches the filter (or wildcard *)
      if (conn.event !== '*' && conn.event !== eventName) continue;

      if (conn.targetId != null) {
        // Named target connection
        const target = this._objectManager.getObjectById(conn.targetId);
        if (!target) continue;
        target.receiveEvent(eventName, { ...data, sourceId });
      } else if (conn.radius != null) {
        // Spatial radius connection — route to all objects within N tiles
        const nearby = this._objectManager.getObjectsInTileRadius(
          source.tileX, source.tileY, conn.radius,
        );
        for (const target of nearby) {
          if (target.id === sourceId) continue;
          target.receiveEvent(eventName, { ...data, sourceId });
        }
      }
    }
  }

  destroy() {
    eventBus.off(OBJECT_EVENT, this._handler);
    this._objectManager = null;
  }
}
