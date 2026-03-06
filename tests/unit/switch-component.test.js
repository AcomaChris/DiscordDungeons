import { describe, it, expect, beforeEach } from 'vitest';

describe('SwitchComponent', () => {
  let ObjectManager, eventBus;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;
  });

  function createSwitch(overrides = {}) {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'switch1', type: 'switch', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'switch', ...overrides }]),
      },
    }]);
    return { mgr, obj: mgr.getObjectById('switch1') };
  }

  it('starts off by default', () => {
    const { mgr, obj } = createSwitch();
    expect(obj.components.get('switch').params.isOn).toBe(false);
    mgr.destroy();
  });

  it('toggles on when interacted', () => {
    const { mgr, obj } = createSwitch();
    obj.onInteract({ x: 0, y: 0 });
    expect(obj.components.get('switch').params.isOn).toBe(true);
    mgr.destroy();
  });

  it('toggles back off on second interact', () => {
    const { mgr, obj } = createSwitch();
    obj.onInteract({ x: 0, y: 0 });
    obj.onInteract({ x: 0, y: 0 });
    expect(obj.components.get('switch').params.isOn).toBe(false);
    mgr.destroy();
  });

  it('emits switch:on when toggling on', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createSwitch();
    obj.onInteract({ x: 0, y: 0 });

    const onEvent = events.find(e => e.eventName === 'switch:on');
    expect(onEvent).toBeDefined();
    expect(onEvent.data.switchId).toBe('switch1');
    expect(onEvent.data.isOn).toBe(true);
    mgr.destroy();
  });

  it('emits switch:off when toggling off', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createSwitch();
    obj.onInteract({ x: 0, y: 0 }); // on
    obj.onInteract({ x: 0, y: 0 }); // off

    const offEvent = events.find(e => e.eventName === 'switch:off');
    expect(offEvent).toBeDefined();
    expect(offEvent.data.isOn).toBe(false);
    mgr.destroy();
  });

  it('emits switch:toggled on every interact', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createSwitch();
    obj.onInteract({ x: 0, y: 0 });
    obj.onInteract({ x: 0, y: 0 });

    const toggleEvents = events.filter(e => e.eventName === 'switch:toggled');
    expect(toggleEvents).toHaveLength(2);
    mgr.destroy();
  });

  it('returns correct prompt text based on state', () => {
    const { mgr, obj } = createSwitch();
    const comp = obj.components.get('switch');

    // Off → shows promptOn (default "Pull")
    expect(comp.promptText).toBe(comp.params.promptOn);

    obj.onInteract({ x: 0, y: 0 }); // on
    expect(comp.promptText).toBe(comp.params.promptOff);
    mgr.destroy();
  });

  it('serializes and restores state', () => {
    const { mgr, obj } = createSwitch();
    obj.onInteract({ x: 0, y: 0 }); // on

    const state = obj.components.get('switch').getState();
    expect(state.isOn).toBe(true);

    const { mgr: mgr2, obj: obj2 } = createSwitch();
    obj2.components.get('switch').applyState(state);
    expect(obj2.components.get('switch').params.isOn).toBe(true);

    mgr.destroy();
    mgr2.destroy();
  });

  it('emits state changed notification', async () => {
    const { OBJECT_STATE_CHANGED } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_STATE_CHANGED, (e) => events.push(e));

    const { mgr, obj } = createSwitch();
    obj.onInteract({ x: 0, y: 0 });

    expect(events).toHaveLength(1);
    expect(events[0].objectId).toBe('switch1');
    mgr.destroy();
  });
});
