// --- ComponentRegistry ---
// Maps component IDs to their class constructors. Extensible — Wave 2/3
// components register themselves without modifying core files.
// AGENT: Always use componentRegistry.create() to instantiate components.

import { Component } from './Component.js';
import { getComponentDef } from './ComponentDefs.js';

// @doc-creator-content 02:Components > Component Registry
// Central registry that maps component IDs to their class constructors.
// Components self-register at import time: `componentRegistry.register('door', DoorComponent)`.
// `create(id, owner, overrides)` instantiates a component by looking up its definition
// from `ComponentDefs` and its constructor from the registry. If no specific class is
// registered for an ID, it falls back to the base `Component` class (useful for
// data-only components that only need params and state, no custom behavior).

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
