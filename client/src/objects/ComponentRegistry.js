// --- ComponentRegistry ---
// Maps component IDs to their class constructors. Extensible — Wave 2/3
// components register themselves without modifying core files.
// AGENT: Always use componentRegistry.create() to instantiate components.

import { Component } from './Component.js';
import { getComponentDef } from './ComponentDefs.js';

class ComponentRegistryClass {
  constructor() {
    // Map<componentId, ComponentClass>
    this._constructors = new Map();
  }

  // Register a component class for a given ID
  register(id, ComponentClass) {
    this._constructors.set(id, ComponentClass);
  }

  // Create a component instance. Falls back to base Component if no
  // specific class is registered (useful for data-only components).
  create(id, owner, overrides = {}) {
    const def = getComponentDef(id);
    if (!def) return null;
    const Ctor = this._constructors.get(id) || Component;
    return new Ctor(owner, def, overrides);
  }

  has(id) {
    return this._constructors.has(id);
  }

  get registeredIds() {
    return [...this._constructors.keys()];
  }
}

// Singleton
export const componentRegistry = new ComponentRegistryClass();
