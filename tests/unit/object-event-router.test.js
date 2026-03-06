import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ObjectEventRouter } from '../../client/src/objects/ObjectEventRouter.js';
import { ObjectManager } from '../../client/src/objects/ObjectManager.js';
import eventBus from '../../client/src/core/EventBus.js';

describe('ObjectEventRouter', () => {
  let mgr, router;

  afterEach(() => {
    if (router) router.destroy();
    if (mgr) mgr.destroy();
    eventBus.reset();
  });

  function setup(objects) {
    mgr = new ObjectManager();
    mgr.createFromMapData(objects);
    router = new ObjectEventRouter(mgr);
    return { mgr, router };
  }

  it('routes event from source to named target', () => {
    setup([
      {
        id: 'sw1', type: 'switch', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __connections: JSON.stringify([
            { name: 'link', targetId: 'door1', event: 'switch:toggled' },
          ]),
        },
      },
      { id: 'door1', type: 'door', x: 32, y: 0, width: 16, height: 16 },
    ]);

    const door = mgr.getObjectById('door1');
    const spy = vi.spyOn(door, 'receiveEvent');

    const sw = mgr.getObjectById('sw1');
    sw.emit('switch:toggled', { isOn: true });

    expect(spy).toHaveBeenCalledWith('switch:toggled', { isOn: true, sourceId: 'sw1' });
  });

  it('does not route events that do not match connection filter', () => {
    setup([
      {
        id: 'sw1', type: 'switch', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __connections: JSON.stringify([
            { name: 'link', targetId: 'door1', event: 'switch:toggled' },
          ]),
        },
      },
      { id: 'door1', type: 'door', x: 32, y: 0, width: 16, height: 16 },
    ]);

    const door = mgr.getObjectById('door1');
    const spy = vi.spyOn(door, 'receiveEvent');

    // Emit a different event
    mgr.getObjectById('sw1').emit('switch:on', {});

    expect(spy).not.toHaveBeenCalled();
  });

  it('wildcard * matches any event', () => {
    setup([
      {
        id: 'src', type: 'test', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __connections: JSON.stringify([
            { name: 'all', targetId: 'tgt', event: '*' },
          ]),
        },
      },
      { id: 'tgt', type: 'test', x: 32, y: 0, width: 16, height: 16 },
    ]);

    const tgt = mgr.getObjectById('tgt');
    const spy = vi.spyOn(tgt, 'receiveEvent');

    mgr.getObjectById('src').emit('any:event', { foo: 1 });
    mgr.getObjectById('src').emit('other:event', { bar: 2 });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('any:event', { foo: 1, sourceId: 'src' });
    expect(spy).toHaveBeenCalledWith('other:event', { bar: 2, sourceId: 'src' });
  });

  it('gracefully handles missing target', () => {
    setup([
      {
        id: 'src', type: 'test', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __connections: JSON.stringify([
            { name: 'link', targetId: 'nonexistent', event: 'test' },
          ]),
        },
      },
    ]);

    // Should not throw
    expect(() => {
      mgr.getObjectById('src').emit('test', {});
    }).not.toThrow();
  });

  it('spatial radius routes to nearby objects, excludes self', () => {
    setup([
      {
        id: 'src', type: 'test', x: 16, y: 16, width: 16, height: 16,
        properties: {
          __connections: JSON.stringify([
            { name: 'broadcast', radius: 3, event: 'pulse' },
          ]),
        },
      },
      { id: 'near', type: 'test', x: 32, y: 16, width: 16, height: 16 },
      { id: 'far', type: 'test', x: 800, y: 800, width: 16, height: 16 },
    ]);

    const nearSpy = vi.spyOn(mgr.getObjectById('near'), 'receiveEvent');
    const farSpy = vi.spyOn(mgr.getObjectById('far'), 'receiveEvent');

    mgr.getObjectById('src').emit('pulse', { power: 5 });

    expect(nearSpy).toHaveBeenCalledWith('pulse', { power: 5, sourceId: 'src' });
    expect(farSpy).not.toHaveBeenCalled();
  });

  it('injects sourceId into routed event data', () => {
    setup([
      {
        id: 'a', type: 'test', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __connections: JSON.stringify([
            { name: 'link', targetId: 'b', event: 'ping' },
          ]),
        },
      },
      { id: 'b', type: 'test', x: 32, y: 0, width: 16, height: 16 },
    ]);

    const spy = vi.spyOn(mgr.getObjectById('b'), 'receiveEvent');
    mgr.getObjectById('a').emit('ping', { msg: 'hello' });

    expect(spy).toHaveBeenCalledWith('ping', { msg: 'hello', sourceId: 'a' });
  });

  it('destroy stops routing', () => {
    setup([
      {
        id: 'src', type: 'test', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __connections: JSON.stringify([
            { name: 'link', targetId: 'tgt', event: 'test' },
          ]),
        },
      },
      { id: 'tgt', type: 'test', x: 32, y: 0, width: 16, height: 16 },
    ]);

    const spy = vi.spyOn(mgr.getObjectById('tgt'), 'receiveEvent');

    router.destroy();
    mgr.getObjectById('src').emit('test', {});

    expect(spy).not.toHaveBeenCalled();
  });
});
