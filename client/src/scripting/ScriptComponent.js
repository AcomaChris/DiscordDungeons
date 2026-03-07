// --- ScriptComponent ---
// Component subclass that runs Lua lifecycle handlers via Wasmoon.
// Scripts define on_interact, on_update, on_event, on_touch, on_step
// as Lua functions. Each script is scoped to avoid namespace collisions.
//
// AGENT: Scripts run in a shared Lua VM. Isolation is via function scoping,
// not separate VMs. Always set self context before calling handlers.

// @doc-creator-content 05:Scripting > Script Component
// Component that runs custom Lua code on lifecycle events. The `code` parameter
// contains inline Lua that defines handler functions: `on_init()`, `on_interact()`,
// `on_touch()`, `on_step()`, `on_update(delta)`, `on_event(name, data)`.
// Scripts execute in the shared LuaEngine with access to `self` (read/write params,
// emit events), `world` (query nearby objects), `timer` (delayed callbacks), and `log`.
// Each script instance is scoped to avoid namespace collisions between objects.

import { Component } from '../objects/Component.js';
import { componentRegistry } from '../objects/ComponentRegistry.js';
import luaEngine from './LuaEngine.js';
import { setSelfContext } from './LuaBindings.js';

// Counter for unique handler table names
let _scriptCounter = 0;

export class ScriptComponent extends Component {
  constructor(owner, def, overrides = {}) {
    super(owner, def, overrides);

    // Unique namespace for this script instance
    this._scopeId = `__script_${_scriptCounter++}`;

    // Lua handler references (populated in init)
    this._handlers = null;

    // Reference to shared bindings (set externally by GameScene)
    this._bindings = null;
  }

  async init() {
    if (!luaEngine.isReady || !this.params.code) return;

    // Wrap user code in a scoped function to avoid global pollution.
    // The wrapper returns a table of handlers the user defined.
    const wrappedCode = `
${this._scopeId} = (function()
  local handlers = {}
  ${this.params.code}
  -- Collect any global-style handler functions the user defined
  if on_interact then handlers.on_interact = on_interact; on_interact = nil end
  if on_update then handlers.on_update = on_update; on_update = nil end
  if on_event then handlers.on_event = on_event; on_event = nil end
  if on_touch then handlers.on_touch = on_touch; on_touch = nil end
  if on_step then handlers.on_step = on_step; on_step = nil end
  if on_init then handlers.on_init = on_init; on_init = nil end
  return handlers
end)()
`;

    await luaEngine.doString(wrappedCode);
    this._handlers = luaEngine.getGlobal(this._scopeId);

    // Call on_init if defined
    if (this._handlers?.on_init) {
      this._setContext();
      try { this._handlers.on_init(); } catch (err) {
        console.error(`[ScriptComponent] ${this.owner.id} on_init error:`, err.message);
      }
    }
  }

  onInteract(_player) {
    if (!this._handlers?.on_interact) return;
    this._setContext();
    try { this._handlers.on_interact(); } catch (err) {
      console.error(`[ScriptComponent] ${this.owner.id} on_interact error:`, err.message);
    }
  }

  onTouch(_player) {
    if (!this._handlers?.on_touch) return;
    this._setContext();
    try { this._handlers.on_touch(); } catch (err) {
      console.error(`[ScriptComponent] ${this.owner.id} on_touch error:`, err.message);
    }
  }

  onStep(_player) {
    if (!this._handlers?.on_step) return;
    this._setContext();
    try { this._handlers.on_step(); } catch (err) {
      console.error(`[ScriptComponent] ${this.owner.id} on_step error:`, err.message);
    }
  }

  onEvent(eventName, data) {
    if (!this._handlers?.on_event) return;
    this._setContext();
    try { this._handlers.on_event(eventName, data); } catch (err) {
      console.error(`[ScriptComponent] ${this.owner.id} on_event error:`, err.message);
    }
  }

  update(delta) {
    if (!this._handlers?.on_update) return;
    this._setContext();
    try { this._handlers.on_update(delta); } catch (err) {
      console.error(`[ScriptComponent] ${this.owner.id} on_update error:`, err.message);
    }
  }

  // State serialization — only params, not Lua heap
  getState() {
    const state = { ...this.params };
    delete state.code; // Don't persist the source code in state
    return state;
  }

  destroy() {
    // Clean up the handler table from Lua global scope
    if (this._scopeId && luaEngine.isReady) {
      luaEngine.setGlobal(this._scopeId, undefined);
    }
    this._handlers = null;
    this._bindings = null;
    super.destroy();
  }

  // --- Internal ---

  _setContext() {
    if (this._bindings && this.owner) {
      setSelfContext(luaEngine, this._bindings, this.owner);
    }
  }
}

// Self-register with ComponentRegistry
componentRegistry.register('script', ScriptComponent);
