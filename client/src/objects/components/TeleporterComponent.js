// --- TeleporterComponent ---
// Step-triggered map transition. When the player steps onto this object,
// emits MAP_TRANSITION_REQUEST to the MapTransitionManager.

import { Component } from '../Component.js';
import { componentRegistry } from '../ComponentRegistry.js';
import eventBus from '../../core/EventBus.js';
import { MAP_TRANSITION_REQUEST } from '../../core/Events.js';

export class TeleporterComponent extends Component {
  onStep(_player) {
    const { targetMap, targetSpawn, targetX, targetY } = this.params;
    if (!targetMap) {
      if (import.meta.env.DEV) console.warn('[TeleporterComponent] No targetMap set');
      return;
    }

    // Prefer named spawn; fall back to coordinate target
    const spawnTarget = targetSpawn
      || (targetX || targetY ? { x: targetX, y: targetY } : null);

    eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap, spawnTarget });
  }
}

componentRegistry.register('teleporter', TeleporterComponent);
