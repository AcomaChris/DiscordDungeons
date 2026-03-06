import { describe, it, expect, beforeEach } from 'vitest';

describe('DoorComponent', () => {
  let DoorComponent, ObjectManager, eventBus;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;

    const dcMod = await import('../../client/src/objects/components/DoorComponent.js');
    DoorComponent = dcMod.DoorComponent;
  });

  function createDoor(overrides = {}) {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'door1', type: 'door', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'door', ...overrides }]),
      },
    }]);
    return { mgr, obj: mgr.getObjectById('door1') };
  }

  it('starts closed by default', () => {
    const { mgr, obj } = createDoor();
    const comp = obj.components.get('door');
    expect(comp.params.isOpen).toBe(false);
    mgr.destroy();
  });

  it('toggles open on interact', () => {
    const { mgr, obj } = createDoor();
    obj.onInteract({ x: 0, y: 0 });
    expect(obj.components.get('door').params.isOpen).toBe(true);
    mgr.destroy();
  });

  it('toggles closed on second interact', () => {
    const { mgr, obj } = createDoor();
    obj.onInteract({ x: 0, y: 0 });
    obj.onInteract({ x: 0, y: 0 });
    expect(obj.components.get('door').params.isOpen).toBe(false);
    mgr.destroy();
  });

  it('emits door:opened event when opening', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createDoor();
    obj.onInteract({ x: 0, y: 0 });

    const openEvent = events.find(e => e.eventName === 'door:opened');
    expect(openEvent).toBeDefined();
    expect(openEvent.data.doorId).toBe('door1');
    mgr.destroy();
  });

  it('emits door:closed event when closing', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createDoor();
    obj.onInteract({ x: 0, y: 0 }); // open
    obj.onInteract({ x: 0, y: 0 }); // close

    const closeEvent = events.find(e => e.eventName === 'door:closed');
    expect(closeEvent).toBeDefined();
    mgr.destroy();
  });

  it('does not open when locked', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createDoor({ lockId: 'gold_key' });
    obj.onInteract({ x: 0, y: 0 });

    expect(obj.components.get('door').params.isOpen).toBe(false);
    const lockEvent = events.find(e => e.eventName === 'door:locked');
    expect(lockEvent).toBeDefined();
    expect(lockEvent.data.lockId).toBe('gold_key');
    mgr.destroy();
  });

  it('returns correct prompt text based on state', () => {
    const { mgr, obj } = createDoor();
    const comp = obj.components.get('door');
    expect(comp.promptText).toBe('Open');

    obj.onInteract({ x: 0, y: 0 }); // open
    expect(comp.promptText).toBe('Close');
    mgr.destroy();
  });

  it('serializes and restores state', () => {
    const { mgr, obj } = createDoor();
    obj.onInteract({ x: 0, y: 0 }); // open

    const state = obj.components.get('door').getState();
    expect(state.isOpen).toBe(true);

    // Create a new door and apply the saved state
    const { mgr: mgr2, obj: obj2 } = createDoor();
    obj2.components.get('door').applyState(state);
    expect(obj2.components.get('door').params.isOpen).toBe(true);

    mgr.destroy();
    mgr2.destroy();
  });

  it('emits state changed notification', async () => {
    const { OBJECT_STATE_CHANGED } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_STATE_CHANGED, (e) => events.push(e));

    const { mgr, obj } = createDoor();
    obj.onInteract({ x: 0, y: 0 });

    expect(events).toHaveLength(1);
    expect(events[0].objectId).toBe('door1');
    mgr.destroy();
  });
});
