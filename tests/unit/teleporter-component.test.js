import { describe, it, expect, beforeEach } from 'vitest';

describe('TeleporterComponent', () => {
  let ObjectManager, eventBus, MAP_TRANSITION_REQUEST;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const evMod = await import('../../client/src/core/Events.js');
    MAP_TRANSITION_REQUEST = evMod.MAP_TRANSITION_REQUEST;

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;

    // Ensure TeleporterComponent is registered
    await import('../../client/src/objects/components/TeleporterComponent.js');
  });

  function createTeleporter(overrides = {}) {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'tp1', type: 'teleporter', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'teleporter', ...overrides }]),
      },
    }]);
    return { mgr, obj: mgr.getObjectById('tp1') };
  }

  it('emits MAP_TRANSITION_REQUEST on step', () => {
    const events = [];
    eventBus.on(MAP_TRANSITION_REQUEST, (e) => events.push(e));

    const { mgr, obj } = createTeleporter({ targetMap: 'test2' });
    obj.onStep({ x: 0, y: 0 });

    expect(events).toHaveLength(1);
    expect(events[0].targetMap).toBe('test2');
    mgr.destroy();
  });

  it('uses targetSpawn if provided', () => {
    const events = [];
    eventBus.on(MAP_TRANSITION_REQUEST, (e) => events.push(e));

    const { mgr, obj } = createTeleporter({ targetMap: 'test2', targetSpawn: 'entrance' });
    obj.onStep({ x: 0, y: 0 });

    expect(events[0].spawnTarget).toBe('entrance');
    mgr.destroy();
  });

  it('falls back to {x, y} coords when no targetSpawn', () => {
    const events = [];
    eventBus.on(MAP_TRANSITION_REQUEST, (e) => events.push(e));

    const { mgr, obj } = createTeleporter({ targetMap: 'test2', targetX: 100, targetY: 200 });
    obj.onStep({ x: 0, y: 0 });

    expect(events[0].spawnTarget).toEqual({ x: 100, y: 200 });
    mgr.destroy();
  });

  it('does nothing if targetMap is null', () => {
    const events = [];
    eventBus.on(MAP_TRANSITION_REQUEST, (e) => events.push(e));

    const { mgr, obj } = createTeleporter({});
    obj.onStep({ x: 0, y: 0 });

    expect(events).toHaveLength(0);
    mgr.destroy();
  });
});
