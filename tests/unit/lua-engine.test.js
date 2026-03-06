import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LuaEngineClass } from '../../client/src/scripting/LuaEngine.js';

describe('LuaEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new LuaEngineClass();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('starts not ready', () => {
    expect(engine.isReady).toBe(false);
  });

  it('initializes the Lua VM', async () => {
    await engine.init();
    expect(engine.isReady).toBe(true);
  });

  it('init is idempotent', async () => {
    await engine.init();
    await engine.init();
    expect(engine.isReady).toBe(true);
  });

  it('executes Lua code via doString', async () => {
    await engine.init();
    await engine.doString('result = 2 + 3');
    expect(engine.getGlobal('result')).toBe(5);
  });

  it('returns result from doString', async () => {
    await engine.init();
    const result = await engine.doString('return 42');
    expect(result).toBe(42);
  });

  it('sets and gets globals', async () => {
    await engine.init();
    engine.setGlobal('greeting', 'hello');
    const val = engine.getGlobal('greeting');
    expect(val).toBe('hello');
  });

  it('exposes JS functions to Lua', async () => {
    await engine.init();
    let called = false;
    engine.setGlobal('notify', () => { called = true; });
    await engine.doString('notify()');
    expect(called).toBe(true);
  });

  it('handles Lua errors gracefully', async () => {
    await engine.init();
    // Syntax error should not throw, returns null
    const result = await engine.doString('this is not valid lua!!!');
    expect(result).toBeNull();
    // Engine should still be usable after error
    expect(engine.isReady).toBe(true);
    await engine.doString('ok = true');
    expect(engine.getGlobal('ok')).toBe(true);
  });

  it('doString returns null when not initialized', async () => {
    const result = await engine.doString('x = 1');
    expect(result).toBeNull();
  });

  it('setGlobal is a no-op when not initialized', () => {
    // Should not throw
    engine.setGlobal('x', 1);
    expect(engine.getGlobal('x')).toBeUndefined();
  });

  it('destroy cleans up the engine', async () => {
    await engine.init();
    expect(engine.isReady).toBe(true);
    engine.destroy();
    expect(engine.isReady).toBe(false);
  });

  it('can reinitialize after destroy', async () => {
    await engine.init();
    engine.destroy();
    await engine.init();
    expect(engine.isReady).toBe(true);
    await engine.doString('x = 99');
    expect(engine.getGlobal('x')).toBe(99);
  });

  it('calls Lua functions from JS', async () => {
    await engine.init();
    await engine.doString(`
      function add(a, b)
        return a + b
      end
    `);
    const add = engine.getGlobal('add');
    expect(add(3, 4)).toBe(7);
  });

  it('passes tables between JS and Lua', async () => {
    await engine.init();
    engine.setGlobal('data', { name: 'test', value: 42 });
    await engine.doString('result_name = data.name');
    expect(engine.getGlobal('result_name')).toBe('test');
  });
});
