// --- DoorComponent ---
// Toggles a door between open and closed states. When open, the door
// becomes passable (debug sprite goes transparent). Emits door:opened
// and door:closed events for other objects to react to.
//
// AGENT: Real tile-swap and collision toggle will come when we wire
// this to the tilemap. For now, visual feedback is via the debug sprite.

import { Component } from '../Component.js';
import { componentRegistry } from '../ComponentRegistry.js';
import eventBus from '../../core/EventBus.js';
import { MAP_TRANSITION_REQUEST } from '../../core/Events.js';

// @doc-creator-content 02:Components > Door Component
// Toggles between open and closed states on interact. Supports three modes:
// - **Toggle door**: flips `isOpen`, emits `door:opened`/`door:closed` events
// - **Locked door**: if `lockId` is set, blocks interaction until player has matching key
// - **Portal door**: if `targetMap` is set, triggers a map transition instead of toggling
// Parameters: `isOpen`, `lockId`, `targetMap`, `targetSpawn`, `targetX`, `targetY`,
// `promptOpen`, `promptClose`. Responds to `switch:toggled` events from connected switches.

export class DoorComponent extends Component {
  init() {
    this._updateVisual();
  }

  onInteract(player) {
    if (this.params.lockId) {
      // TODO: check player inventory for matching key
      this.owner.emit('door:locked', { doorId: this.owner.id, lockId: this.params.lockId });
      return;
    }

    // Portal mode — door leads to another map
    if (this.params.targetMap) {
      const { targetMap, targetSpawn, targetX, targetY } = this.params;
      const spawnTarget = targetSpawn
        || (targetX || targetY ? { x: targetX, y: targetY } : null);
      eventBus.emit(MAP_TRANSITION_REQUEST, { targetMap, spawnTarget });
      return;
    }

    this.params.isOpen = !this.params.isOpen;
    this._updateVisual();
    this.owner.notifyStateChanged();

    const eventName = this.params.isOpen ? 'door:opened' : 'door:closed';
    this.owner.emit(eventName, { doorId: this.owner.id });
  }

  // React to routed events (e.g. switch:toggled from a connected switch)
  onEvent(eventName, _data) {
    if (eventName === 'switch:toggled' || eventName === 'switch:on' || eventName === 'switch:off') {
      this.onInteract(null);
    }
  }

  // Update the prompt text based on current state
  get promptText() {
    return this.params.isOpen ? this.params.promptClose : this.params.promptOpen;
  }

  _updateVisual() {
    const sprite = this.owner._debugSprite;
    if (!sprite) return;

    if (this.params.isOpen) {
      sprite.setAlpha(0.2);
      sprite.setStrokeStyle(1, 0x44cc44, 0.8);
    } else {
      sprite.setAlpha(0.8);
      sprite.setStrokeStyle(1, 0xffffff, 0.6);
    }
  }

  getState() {
    return { isOpen: this.params.isOpen };
  }

  applyState(state) {
    if (!state) return;
    this.params.isOpen = !!state.isOpen;
    this._updateVisual();
  }
}

componentRegistry.register('door', DoorComponent);
