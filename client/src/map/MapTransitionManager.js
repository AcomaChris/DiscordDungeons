// --- MapTransitionManager ---
// Handles map-to-map transitions triggered by teleporters and doors.
// Listens for MAP_TRANSITION_REQUEST, fades out, saves state, restarts scene.
// AGENT: Only one transition can be in-flight at a time (_locked flag).

import eventBus from '../core/EventBus.js';
import { MAP_TRANSITION_REQUEST } from '../core/Events.js';
import objectStateStore from '../objects/ObjectStateStore.js';

const FADE_DURATION = 500;

export class MapTransitionManager {
  constructor(scene) {
    this._scene = scene;
    this._locked = false;

    this._onRequest = (data) => this._handleRequest(data);
    eventBus.on(MAP_TRANSITION_REQUEST, this._onRequest);
  }

  _handleRequest({ targetMap, spawnTarget }) {
    if (this._locked) return;
    if (!targetMap) return;
    this._locked = true;

    if (import.meta.env.DEV) {
      console.log(`[MapTransition] ${this._scene._mapId} → ${targetMap}`, spawnTarget);
    }

    // Disable input so player can't move during fade
    this._scene.input.keyboard.enabled = false;

    // Fade to black, then swap maps
    this._scene.cameras.main.fade(FADE_DURATION, 0, 0, 0, false, (_camera, progress) => {
      if (progress < 1) return;
      objectStateStore.saveAll(this._scene.objectManager);
      // Signal to GameScene.shutdown() that this is a map transition, not a full stop
      this._scene._isMapTransition = true;
      this._scene.scene.restart({ mapId: targetMap, spawnTarget });
    });
  }

  destroy() {
    eventBus.off(MAP_TRANSITION_REQUEST, this._onRequest);
    this._scene = null;
  }
}
