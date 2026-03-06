// --- LuaBindings ---
// Injects game API globals into the Lua state so scripts can interact
// with the game world. Called once during LuaEngine init.
//
// AGENT: Bindings are context-free at injection time. Context-specific
// values (self, player) are set per-call by ScriptComponent before
// invoking a handler.

// --- Standard Bindings (injected once) ---

export function injectStandardBindings(luaEngine, objectManager) {
  // log(...) — safe console output from Lua
  luaEngine.setGlobal('log', (...args) => {
    console.log('[Lua]', ...args);
  });

  // world.getObject(id) — look up object by ID
  // world.nearby(tileRadius) — objects within radius of current self
  // world.getObjectsByType(type) — filter by type string
  const world = {
    // AGENT: Return undefined (not null) for missing objects — Wasmoon
    // maps JS null to a truthy userdata, but undefined maps to Lua nil.
    getObject(id) {
      if (!objectManager) return undefined;
      const obj = objectManager.getObjectById(id);
      if (!obj) return undefined;
      return _wrapObject(obj);
    },

    getObjectsByType(type) {
      if (!objectManager) return [];
      return objectManager.getObjectsByType(type).map(_wrapObject);
    },

    // nearby() uses the current self context — set dynamically
    _selfRef: null,

    nearby(tileRadius) {
      if (!objectManager || !world._selfRef) return [];
      const obj = world._selfRef;
      return objectManager.getObjectsInTileRadius(obj.tileX, obj.tileY, tileRadius)
        .filter(o => o.id !== obj.id)
        .map(_wrapObject);
    },
  };

  luaEngine.setGlobal('world', world);

  // timer.after(ms, callback) — delayed execution via setTimeout
  // AGENT: Timers are fire-and-forget. No persistence across save/load.
  const timerApi = {
    _timers: [],

    after(ms, callback) {
      const id = setTimeout(() => {
        try { callback(); } catch (err) {
          console.error('[Lua] Timer callback error:', err.message);
        }
      }, ms);
      timerApi._timers.push(id);
      return id;
    },

    clearAll() {
      for (const id of timerApi._timers) clearTimeout(id);
      timerApi._timers = [];
    },
  };

  luaEngine.setGlobal('timer', timerApi);

  return { world, timer: timerApi };
}

// --- Per-Call Context (set before each handler invocation) ---

export function setSelfContext(luaEngine, bindings, interactiveObject) {
  const obj = interactiveObject;

  // Update world's self reference for nearby() calls
  bindings.world._selfRef = obj;

  const self = {
    id: obj.id,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    tileX: obj.tileX,
    tileY: obj.tileY,

    // Read a param from the script component
    get(key) {
      const comp = obj.components.get('script');
      return comp ? comp.params[key] : undefined;
    },

    // Write a param and trigger state change
    set(key, value) {
      const comp = obj.components.get('script');
      if (comp) {
        comp.params[key] = value;
        obj.notifyStateChanged();
      }
    },

    // Emit an event from this object
    emit(eventName, data) {
      obj.emit(eventName, data || {});
    },
  };

  luaEngine.setGlobal('self', self);
}

// --- Helpers ---

// Wrap an InteractiveObject into a read-only Lua-friendly table
function _wrapObject(obj) {
  return {
    id: obj.id,
    type: obj.type,
    x: obj.x,
    y: obj.y,
    tileX: obj.tileX,
    tileY: obj.tileY,
    width: obj.width,
    height: obj.height,
  };
}
