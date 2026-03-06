// --- ComponentManager ---
// Per-object manager that owns component instances. Handles lifecycle,
// state serialization, and event dispatch. One instance per InteractiveObject.
// AGENT: Mirrors AbilityManager pattern — add/remove/get + update loop.

import { componentRegistry } from './ComponentRegistry.js';

export class ComponentManager {
  constructor(owner) {
    this.owner = owner;
    // Map<componentId, Component>
    this._components = new Map();
  }

  // Add a component by ID with optional per-instance param overrides
  add(componentId, overrides = {}) {
    if (this._components.has(componentId)) return null;
    const component = componentRegistry.create(componentId, this.owner, overrides);
    if (!component) return null;
    this._components.set(componentId, component);
    return component;
  }

  remove(componentId) {
    const component = this._components.get(componentId);
    if (!component) return false;
    component.destroy();
    this._components.delete(componentId);
    return true;
  }

  get(componentId) {
    return this._components.get(componentId) || null;
  }

  has(componentId) {
    return this._components.has(componentId);
  }

  // Initialize all components (called after owner is fully set up)
  initAll() {
    for (const component of this._components.values()) {
      component.init();
    }
  }

  // Called each frame
  update(delta) {
    for (const component of this._components.values()) {
      component.update(delta);
    }
  }

  // Dispatch interaction to components matching the given trigger type
  dispatch(triggerType, player) {
    for (const component of this._components.values()) {
      if (component.trigger !== triggerType) continue;
      switch (triggerType) {
        case 'interact': component.onInteract(player); break;
        case 'touch': component.onTouch(player); break;
        case 'step': component.onStep(player); break;
      }
    }
  }

  // Dispatch an event to all components
  dispatchEvent(eventName, data) {
    for (const component of this._components.values()) {
      component.onEvent(eventName, data);
    }
  }

  // Returns the trigger type that should show an interaction prompt
  getInteractTrigger() {
    for (const component of this._components.values()) {
      if (component.trigger === 'interact') return component;
    }
    return null;
  }

  // --- State Serialization ---

  getState() {
    const state = {};
    for (const [id, component] of this._components) {
      state[id] = component.getState();
    }
    return state;
  }

  applyState(state) {
    if (!state) return;
    for (const [id, componentState] of Object.entries(state)) {
      const component = this._components.get(id);
      if (component) component.applyState(componentState);
    }
  }

  get size() {
    return this._components.size;
  }

  // Iterate all components
  [Symbol.iterator]() {
    return this._components.values();
  }

  destroy() {
    for (const component of this._components.values()) {
      component.destroy();
    }
    this._components.clear();
    this.owner = null;
  }
}
