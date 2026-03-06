import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LuaEngineClass } from '../../client/src/scripting/LuaEngine.js';
import { injectStandardBindings } from '../../client/src/scripting/LuaBindings.js';

// We need to mock the luaEngine singleton that ScriptComponent imports.
// Instead, we test ScriptComponent by directly using its class with a real engine.

describe('ScriptComponent', () => {
  let engine, bindings;

  // Mock the luaEngine singleton before importing ScriptComponent
  beforeEach(async () => {
    engine = new LuaEngineClass();
    await engine.init();

    // Mock the singleton — ScriptComponent imports luaEngine from LuaEngine.js
    const luaMod = await import('../../client/src/scripting/LuaEngine.js');
    // Replace singleton methods with our test engine's
    const singleton = luaMod.default;
    singleton._engine = engine._engine;
    singleton._factory = engine._factory;
    singleton._ready = true;
  });

  afterEach(async () => {
    const luaMod = await import('../../client/src/scripting/LuaEngine.js');
    luaMod.default._engine = null;
    luaMod.default._factory = null;
    luaMod.default._ready = false;
    engine.destroy();
  });

  function makeOwner(id = 'test_obj', params = {}) {
    const owner = {
      id,
      type: 'test',
      x: 32, y: 64,
      width: 16, height: 16,
      tileX: 2, tileY: 4,
      components: {
        get(compId) {
          if (compId === 'script') return owner._comp;
          return null;
        },
      },
      _comp: null,
      emit: vi.fn(),
      notifyStateChanged: vi.fn(),
    };
    return owner;
  }

  async function createScript(code, owner) {
    const { ScriptComponent } = await import('../../client/src/scripting/ScriptComponent.js');
    const def = {
      id: 'script',
      authority: 'client',
      persistence: 'volatile',
      trigger: 'interact',
      params: { code: '' },
    };
    const comp = new ScriptComponent(owner, def, { code });
    owner._comp = comp;

    // Set up bindings
    const mgr = {
      getObjectById: () => null,
      getObjectsByType: () => [],
      getObjectsInTileRadius: () => [],
    };
    comp._bindings = injectStandardBindings(
      (await import('../../client/src/scripting/LuaEngine.js')).default,
      mgr,
    );

    await comp.init();
    return comp;
  }

  it('compiles and runs on_interact handler', async () => {
    const owner = makeOwner();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const comp = await createScript(`
      function on_interact()
        log("interacted!")
      end
    `, owner);

    comp.onInteract({});
    expect(spy).toHaveBeenCalledWith('[Lua]', 'interacted!');
    spy.mockRestore();
    comp.destroy();
  });

  it('calls on_init during init', async () => {
    const owner = makeOwner();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const comp = await createScript(`
      function on_init()
        log("initialized!")
      end
    `, owner);

    expect(spy).toHaveBeenCalledWith('[Lua]', 'initialized!');
    spy.mockRestore();
    comp.destroy();
  });

  it('calls on_touch handler', async () => {
    const owner = makeOwner();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const comp = await createScript(`
      function on_touch()
        log("touched!")
      end
    `, owner);

    comp.onTouch({});
    expect(spy).toHaveBeenCalledWith('[Lua]', 'touched!');
    spy.mockRestore();
    comp.destroy();
  });

  it('calls on_step handler', async () => {
    const owner = makeOwner();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const comp = await createScript(`
      function on_step()
        log("stepped!")
      end
    `, owner);

    comp.onStep({});
    expect(spy).toHaveBeenCalledWith('[Lua]', 'stepped!');
    spy.mockRestore();
    comp.destroy();
  });

  it('calls on_event with event name and data', async () => {
    const owner = makeOwner();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const comp = await createScript(`
      function on_event(name, data)
        log("event:", name)
      end
    `, owner);

    comp.onEvent('door:opened', { doorId: 'door1' });
    expect(spy).toHaveBeenCalledWith('[Lua]', 'event:', 'door:opened');
    spy.mockRestore();
    comp.destroy();
  });

  it('calls on_update with delta', async () => {
    const owner = makeOwner();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const comp = await createScript(`
      function on_update(dt)
        log("delta:", dt)
      end
    `, owner);

    comp.update(16.67);
    expect(spy).toHaveBeenCalledWith('[Lua]', 'delta:', 16.67);
    spy.mockRestore();
    comp.destroy();
  });

  it('self.get and self.set work', async () => {
    const owner = makeOwner();
    const comp = await createScript(`
      function on_interact()
        local count = self.get("count") or 0
        count = count + 1
        self.set("count", count)
      end
    `, owner);

    comp.onInteract({});
    expect(comp.params.count).toBe(1);
    expect(owner.notifyStateChanged).toHaveBeenCalled();

    comp.onInteract({});
    expect(comp.params.count).toBe(2);
    comp.destroy();
  });

  it('self.emit fires events on owner', async () => {
    const owner = makeOwner();
    const comp = await createScript(`
      function on_interact()
        self.emit("custom:fired", {})
      end
    `, owner);

    comp.onInteract({});
    expect(owner.emit).toHaveBeenCalledWith('custom:fired', expect.any(Object));
    comp.destroy();
  });

  it('handles missing handlers gracefully', async () => {
    const owner = makeOwner();
    const comp = await createScript(`
      -- no handlers defined
    `, owner);

    // None of these should throw
    comp.onInteract({});
    comp.onTouch({});
    comp.onStep({});
    comp.onEvent('test', {});
    comp.update(16);
    comp.destroy();
  });

  it('handles script errors gracefully', async () => {
    const owner = makeOwner();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const comp = await createScript(`
      function on_interact()
        error("intentional test error")
      end
    `, owner);

    // Should not throw
    comp.onInteract({});
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    comp.destroy();
  });

  it('getState excludes code', async () => {
    const owner = makeOwner();
    const comp = await createScript(`
      function on_interact()
        self.set("myVal", 42)
      end
    `, owner);

    comp.onInteract({});
    const state = comp.getState();
    expect(state.myVal).toBe(42);
    expect(state.code).toBeUndefined();
    comp.destroy();
  });
});
