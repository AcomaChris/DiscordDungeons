// --- LuaEngine ---
// Singleton wrapper around Wasmoon (Lua 5.4 via WebAssembly).
// Provides async init, code execution, global injection, and error handling.
// One engine per game session — scripts are isolated by function scoping.
//
// AGENT: Always call init() before using. The engine is async because
// Wasmoon loads WASM on first use. Never let Lua errors crash the game.

import { LuaFactory } from 'wasmoon';

class LuaEngineClass {
  constructor() {
    this._engine = null;
    this._factory = null;
    this._ready = false;
  }

  get isReady() {
    return this._ready;
  }

  // Initialize the Lua VM. Must be awaited before any script execution.
  async init() {
    if (this._ready) return;
    try {
      this._factory = new LuaFactory();
      this._engine = await this._factory.createEngine();
      this._ready = true;
    } catch (err) {
      console.error('[LuaEngine] Failed to initialize:', err);
      this._ready = false;
    }
  }

  // Execute a Lua code string. Returns the result or null on error.
  async doString(code) {
    if (!this._ready) {
      console.warn('[LuaEngine] Not initialized, ignoring doString');
      return null;
    }
    try {
      return await this._engine.doString(code);
    } catch (err) {
      console.error('[LuaEngine] Script error:', err.message);
      return null;
    }
  }

  // Set a global variable in the Lua state (JS → Lua)
  setGlobal(name, value) {
    if (!this._ready) return;
    this._engine.global.set(name, value);
  }

  // Get a global variable from the Lua state (Lua → JS)
  getGlobal(name) {
    if (!this._ready) return undefined;
    return this._engine.global.get(name);
  }

  // Clean up the Lua VM
  destroy() {
    if (this._engine) {
      try {
        this._engine.global.close();
      } catch { /* ignore close errors */ }
      this._engine = null;
    }
    this._factory = null;
    this._ready = false;
  }
}

// Singleton
const luaEngine = new LuaEngineClass();
export default luaEngine;
export { LuaEngineClass };
