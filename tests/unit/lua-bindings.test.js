import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LuaEngineClass } from '../../client/src/scripting/LuaEngine.js';
import { injectStandardBindings, setSelfContext } from '../../client/src/scripting/LuaBindings.js';

// Minimal mock ObjectManager
function makeObjectManager(objects = []) {
  const map = new Map(objects.map(o => [o.id, o]));
  return {
    getObjectById(id) { return map.get(id) || null; },
    getObjectsByType(type) { return objects.filter(o => o.type === type); },
    getObjectsInTileRadius(tx, ty, r) {
      return objects.filter(o => {
        const dx = o.tileX - tx;
        const dy = o.tileY - ty;
        return Math.sqrt(dx * dx + dy * dy) <= r;
      });
    },
  };
}

// Minimal mock InteractiveObject
function makeObject(id, overrides = {}) {
  const obj = {
    id,
    type: overrides.type || 'test',
    x: overrides.x || 0,
    y: overrides.y || 0,
    width: 16,
    height: 16,
    tileX: overrides.tileX || 0,
    tileY: overrides.tileY || 0,
    components: {
      get(compId) {
        if (compId === 'script') return obj._scriptComp;
        return null;
      },
    },
    _scriptComp: { params: { ...(overrides.params || {}) } },
    emit: vi.fn(),
    notifyStateChanged: vi.fn(),
  };
  return obj;
}

describe('LuaBindings', () => {
  let engine, bindings;

  beforeEach(async () => {
    engine = new LuaEngineClass();
    await engine.init();
  });

  afterEach(() => {
    if (bindings?.timer) bindings.timer.clearAll();
    engine.destroy();
  });

  describe('log', () => {
    it('logs to console', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      bindings = injectStandardBindings(engine, null);
      await engine.doString('log("hello", "world")');
      expect(spy).toHaveBeenCalledWith('[Lua]', 'hello', 'world');
      spy.mockRestore();
    });
  });

  describe('world', () => {
    it('getObject returns wrapped object', async () => {
      const obj = makeObject('door1', { type: 'door', x: 32, tileX: 2 });
      const mgr = makeObjectManager([obj]);
      bindings = injectStandardBindings(engine, mgr);

      await engine.doString(`
        local o = world.getObject("door1")
        found_id = o.id
        found_type = o.type
        found_x = o.x
      `);

      expect(engine.getGlobal('found_id')).toBe('door1');
      expect(engine.getGlobal('found_type')).toBe('door');
      expect(engine.getGlobal('found_x')).toBe(32);
    });

    it('getObject returns nil for missing ID', async () => {
      const mgr = makeObjectManager([]);
      bindings = injectStandardBindings(engine, mgr);

      await engine.doString(`
        local o = world.getObject("nope")
        is_nil = (o == nil)
      `);
      expect(engine.getGlobal('is_nil')).toBe(true);
    });

    it('getObjectsByType filters correctly', async () => {
      const objs = [
        makeObject('d1', { type: 'door' }),
        makeObject('d2', { type: 'door' }),
        makeObject('c1', { type: 'chest' }),
      ];
      const mgr = makeObjectManager(objs);
      bindings = injectStandardBindings(engine, mgr);

      await engine.doString(`
        local doors = world.getObjectsByType("door")
        door_count = #doors
      `);
      expect(engine.getGlobal('door_count')).toBe(2);
    });

    it('nearby returns objects within tile radius', async () => {
      const selfObj = makeObject('self1', { tileX: 5, tileY: 5 });
      const near = makeObject('near1', { tileX: 6, tileY: 5 });
      const far = makeObject('far1', { tileX: 50, tileY: 50 });
      const mgr = makeObjectManager([selfObj, near, far]);
      bindings = injectStandardBindings(engine, mgr);
      setSelfContext(engine, bindings, selfObj);

      await engine.doString(`
        local objs = world.nearby(3)
        nearby_count = #objs
      `);
      expect(engine.getGlobal('nearby_count')).toBe(1); // near1 only (self excluded)
    });
  });

  describe('self context', () => {
    it('exposes object properties', async () => {
      const obj = makeObject('lever1', { type: 'lever', x: 64, y: 128, tileX: 4, tileY: 8 });
      const mgr = makeObjectManager([obj]);
      bindings = injectStandardBindings(engine, mgr);
      setSelfContext(engine, bindings, obj);

      await engine.doString(`
        sid = self.id
        sx = self.x
        sy = self.y
        stx = self.tileX
        sty = self.tileY
      `);
      expect(engine.getGlobal('sid')).toBe('lever1');
      expect(engine.getGlobal('sx')).toBe(64);
      expect(engine.getGlobal('sy')).toBe(128);
      expect(engine.getGlobal('stx')).toBe(4);
      expect(engine.getGlobal('sty')).toBe(8);
    });

    it('get reads params from script component', async () => {
      const obj = makeObject('sw1', { params: { isOn: true, power: 5 } });
      const mgr = makeObjectManager([obj]);
      bindings = injectStandardBindings(engine, mgr);
      setSelfContext(engine, bindings, obj);

      await engine.doString(`
        val = self.get("isOn")
        power = self.get("power")
      `);
      expect(engine.getGlobal('val')).toBe(true);
      expect(engine.getGlobal('power')).toBe(5);
    });

    it('set writes params and triggers state change', async () => {
      const obj = makeObject('sw1', { params: { isOn: false } });
      const mgr = makeObjectManager([obj]);
      bindings = injectStandardBindings(engine, mgr);
      setSelfContext(engine, bindings, obj);

      await engine.doString('self.set("isOn", true)');
      expect(obj._scriptComp.params.isOn).toBe(true);
      expect(obj.notifyStateChanged).toHaveBeenCalled();
    });

    it('emit fires event on the object', async () => {
      const obj = makeObject('em1');
      const mgr = makeObjectManager([obj]);
      bindings = injectStandardBindings(engine, mgr);
      setSelfContext(engine, bindings, obj);

      await engine.doString('self.emit("custom:test", {})');
      expect(obj.emit).toHaveBeenCalledWith('custom:test', expect.any(Object));
    });
  });

  describe('timer', () => {
    it('after executes callback after delay', async () => {
      vi.useFakeTimers();
      const mgr = makeObjectManager([]);
      bindings = injectStandardBindings(engine, mgr);

      let called = false;
      engine.setGlobal('markCalled', () => { called = true; });
      await engine.doString('timer.after(100, markCalled)');

      expect(called).toBe(false);
      vi.advanceTimersByTime(100);
      expect(called).toBe(true);
      vi.useRealTimers();
    });

    it('clearAll cancels pending timers', async () => {
      vi.useFakeTimers();
      const mgr = makeObjectManager([]);
      bindings = injectStandardBindings(engine, mgr);

      let called = false;
      engine.setGlobal('markCalled', () => { called = true; });
      await engine.doString('timer.after(100, markCalled)');

      bindings.timer.clearAll();
      vi.advanceTimersByTime(200);
      expect(called).toBe(false);
      vi.useRealTimers();
    });
  });
});
