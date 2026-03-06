import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('TrapComponent', () => {
  let ObjectManager, eventBus;

  beforeEach(async () => {
    vi.useFakeTimers();

    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createTrap(overrides = {}) {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'trap1', type: 'trap', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'trap', ...overrides }]),
      },
    }]);
    return { mgr, obj: mgr.getObjectById('trap1') };
  }

  it('starts armed by default', () => {
    const { mgr, obj } = createTrap();
    expect(obj.components.get('trap').params.armed).toBe(true);
    mgr.destroy();
  });

  it('disarms and emits trap:triggered on step', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createTrap({ damage: 10 });
    obj.onStep({ x: 0, y: 0 });

    expect(obj.components.get('trap').params.armed).toBe(false);
    const trigEvent = events.find(e => e.eventName === 'trap:triggered');
    expect(trigEvent).toBeDefined();
    expect(trigEvent.data.damage).toBe(10);
    expect(trigEvent.data.trapId).toBe('trap1');
    mgr.destroy();
  });

  it('does not trigger when disarmed', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createTrap();
    obj.onStep({ x: 0, y: 0 }); // trigger
    events.length = 0;
    obj.onStep({ x: 0, y: 0 }); // should not trigger again

    expect(events.filter(e => e.eventName === 'trap:triggered')).toHaveLength(0);
    mgr.destroy();
  });

  it('rearms after rearmDelay', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createTrap({ rearmDelay: 3000 });
    obj.onStep({ x: 0, y: 0 });
    expect(obj.components.get('trap').params.armed).toBe(false);

    vi.advanceTimersByTime(3000);

    expect(obj.components.get('trap').params.armed).toBe(true);
    const rearmEvent = events.find(e => e.eventName === 'trap:rearmed');
    expect(rearmEvent).toBeDefined();
    mgr.destroy();
  });

  it('does not rearm when rearmDelay is 0', () => {
    const { mgr, obj } = createTrap({ rearmDelay: 0 });
    obj.onStep({ x: 0, y: 0 });

    vi.advanceTimersByTime(10000);
    expect(obj.components.get('trap').params.armed).toBe(false);
    mgr.destroy();
  });

  it('destroy clears rearm timer', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createTrap({ rearmDelay: 3000 });
    obj.onStep({ x: 0, y: 0 });
    mgr.destroy();

    vi.advanceTimersByTime(3000);
    // Should not emit rearmed after destroy
    expect(events.filter(e => e.eventName === 'trap:rearmed')).toHaveLength(0);
  });

  it('serializes and restores state', () => {
    const { mgr, obj } = createTrap();
    obj.onStep({ x: 0, y: 0 });

    const state = obj.components.get('trap').getState();
    expect(state.armed).toBe(false);

    const { mgr: mgr2, obj: obj2 } = createTrap();
    obj2.components.get('trap').applyState(state);
    expect(obj2.components.get('trap').params.armed).toBe(false);

    mgr.destroy();
    mgr2.destroy();
  });

  it('emits state changed notification on trigger', async () => {
    const { OBJECT_STATE_CHANGED } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_STATE_CHANGED, (e) => events.push(e));

    const { mgr, obj } = createTrap();
    obj.onStep({ x: 0, y: 0 });

    expect(events).toHaveLength(1);
    expect(events[0].objectId).toBe('trap1');
    mgr.destroy();
  });
});
