// --- InteractiveObject ---
// Represents a placed object in the game world with components.
// Created from map Objects layer data + object definitions.
// AGENT: Position is in world pixels. Components handle all behavior.

import { ComponentManager } from './ComponentManager.js';
import eventBus from '../core/EventBus.js';
import { OBJECT_STATE_CHANGED, OBJECT_EVENT, OBJECT_SPAWNED, OBJECT_DESTROYED } from '../core/Events.js';
import { TILE_SIZE } from '../core/Constants.js';

export class InteractiveObject {
  constructor(config) {
    this.id = config.id;
    this.type = config.type || '';
    this.defId = config.defId || null;
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.width = config.width || TILE_SIZE;
    this.height = config.height || TILE_SIZE;
    this.properties = config.properties || {};

    // Tile coordinates (computed from pixel position)
    this.tileX = Math.floor(this.x / TILE_SIZE);
    this.tileY = Math.floor(this.y / TILE_SIZE);

    // Named connections to other objects: [{ name, targetId, event }]
    this.connections = config.connections || [];

    // Component system
    this.components = new ComponentManager(this);

    // Add components from config
    const componentConfigs = config.components || [];
    for (const compConfig of componentConfigs) {
      const { id, ...overrides } = compConfig;
      this.components.add(id, overrides);
    }
  }

  // Called after all objects in the map are created (connections can resolve)
  init() {
    this.components.initAll();
    eventBus.emit(OBJECT_SPAWNED, { objectId: this.id, type: this.type, x: this.x, y: this.y });
  }

  update(delta) {
    this.components.update(delta);
  }

  // --- Interaction Dispatch ---

  onInteract(player) {
    this.components.dispatch('interact', player);
  }

  onTouch(player) {
    this.components.dispatch('touch', player);
  }

  onStep(player) {
    this.components.dispatch('step', player);
  }

  // --- Event System ---

  // Emit an event from this object. ObjectEventRouter handles routing
  // to connections, spatial neighbors, and global EventBus.
  emit(eventName, data = {}) {
    eventBus.emit(OBJECT_EVENT, {
      sourceId: this.id,
      eventName,
      data,
    });
  }

  // Receive an event routed from another object or the system
  receiveEvent(eventName, data) {
    this.components.dispatchEvent(eventName, data);
  }

  // Notify that state changed (triggers persistence + network sync)
  notifyStateChanged() {
    eventBus.emit(OBJECT_STATE_CHANGED, {
      objectId: this.id,
      state: this.getState(),
    });
  }

  // --- State Serialization ---

  getState() {
    return {
      id: this.id,
      components: this.components.getState(),
    };
  }

  applyState(state) {
    if (!state) return;
    if (state.components) {
      this.components.applyState(state.components);
    }
  }

  // --- Spatial ---

  // Center position for distance calculations
  get centerX() { return this.x + this.width / 2; }
  get centerY() { return this.y + this.height / 2; }

  distanceTo(x, y) {
    const dx = this.centerX - x;
    const dy = this.centerY - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Prompt Text ---

  // Returns the prompt text from the first interact-triggered component.
  // Components with a promptText getter (e.g. DoorComponent) override params.
  get promptText() {
    const comp = this.components.getInteractTrigger();
    if (!comp) return null;
    // Prefer component getter over raw params (allows state-dependent text)
    if (typeof comp.promptText === 'string') return comp.promptText;
    return comp.params?.promptText || comp.params?.promptOpen || null;
  }

  destroy() {
    eventBus.emit(OBJECT_DESTROYED, { objectId: this.id });
    this.components.destroy();
    this.connections = [];
    this.properties = {};
  }
}
