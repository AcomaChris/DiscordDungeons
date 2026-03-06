import { describe, it, expect, beforeEach } from 'vitest';

describe('DestructibleComponent', () => {
  let ObjectManager, eventBus;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;
  });

  function createDestructible(overrides = {}) {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'barrel1', type: 'destructible', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{
          id: 'destructible',
          health: 30,
          maxHealth: 30,
          drops: [{ id: 'wood', name: 'Wood', quantity: 2 }],
          ...overrides,
        }]),
      },
    }]);
    return { mgr, obj: mgr.getObjectById('barrel1') };
  }

  it('starts with full health', () => {
    const { mgr, obj } = createDestructible();
    const comp = obj.components.get('destructible');
    expect(comp.params.health).toBe(30);
    expect(comp.isDestroyed).toBe(false);
    mgr.destroy();
  });

  it('takes damage and emits destructible:damaged', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createDestructible();
    obj.receiveEvent('damage', { amount: 10 });

    expect(obj.components.get('destructible').params.health).toBe(20);
    const dmgEvent = events.find(e => e.eventName === 'destructible:damaged');
    expect(dmgEvent).toBeDefined();
    expect(dmgEvent.data.health).toBe(20);
    expect(dmgEvent.data.maxHealth).toBe(30);
    expect(dmgEvent.data.damage).toBe(10);
    mgr.destroy();
  });

  it('emits destructible:destroyed with drops at 0 health', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createDestructible({ health: 10, maxHealth: 10 });
    obj.receiveEvent('damage', { amount: 10 });

    expect(obj.components.get('destructible').isDestroyed).toBe(true);
    const destroyEvent = events.find(e => e.eventName === 'destructible:destroyed');
    expect(destroyEvent).toBeDefined();
    expect(destroyEvent.data.drops).toEqual([{ id: 'wood', name: 'Wood', quantity: 2 }]);
    mgr.destroy();
  });

  it('ignores damage after destruction', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createDestructible({ health: 5, maxHealth: 5 });
    obj.receiveEvent('damage', { amount: 5 }); // destroy
    events.length = 0;
    obj.receiveEvent('damage', { amount: 5 }); // should be ignored

    expect(events.filter(e => e.eventName === 'destructible:damaged')).toHaveLength(0);
    mgr.destroy();
  });

  it('ignores zero and negative damage', () => {
    const { mgr, obj } = createDestructible();
    obj.receiveEvent('damage', { amount: 0 });
    expect(obj.components.get('destructible').params.health).toBe(30);

    obj.receiveEvent('damage', { amount: -5 });
    expect(obj.components.get('destructible').params.health).toBe(30);
    mgr.destroy();
  });

  it('ignores non-damage events', () => {
    const { mgr, obj } = createDestructible();
    obj.receiveEvent('heal', { amount: 10 });
    expect(obj.components.get('destructible').params.health).toBe(30);
    mgr.destroy();
  });

  it('clamps health to zero (does not go negative)', () => {
    const { mgr, obj } = createDestructible({ health: 5, maxHealth: 5 });
    obj.receiveEvent('damage', { amount: 100 });
    expect(obj.components.get('destructible').params.health).toBe(0);
    mgr.destroy();
  });

  it('serializes and restores state', () => {
    const { mgr, obj } = createDestructible();
    obj.receiveEvent('damage', { amount: 15 });

    const state = obj.components.get('destructible').getState();
    expect(state.health).toBe(15);

    const { mgr: mgr2, obj: obj2 } = createDestructible();
    obj2.components.get('destructible').applyState(state);
    expect(obj2.components.get('destructible').params.health).toBe(15);

    mgr.destroy();
    mgr2.destroy();
  });

  it('emits state changed notification on damage', async () => {
    const { OBJECT_STATE_CHANGED } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_STATE_CHANGED, (e) => events.push(e));

    const { mgr, obj } = createDestructible();
    obj.receiveEvent('damage', { amount: 5 });

    expect(events).toHaveLength(1);
    expect(events[0].objectId).toBe('barrel1');
    mgr.destroy();
  });
});
