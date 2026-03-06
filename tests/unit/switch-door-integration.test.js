import { describe, it, expect, beforeEach } from 'vitest';

describe('Switch → Door Integration', () => {
  let ObjectManager, ObjectEventRouter, eventBus;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;

    const orMod = await import('../../client/src/objects/ObjectEventRouter.js');
    ObjectEventRouter = orMod.ObjectEventRouter;
  });

  function createScene() {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      {
        id: 'switch1', type: 'switch', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __components: JSON.stringify([{ id: 'switch' }]),
          __connections: JSON.stringify([
            { name: 'link1', targetId: 'door1', event: 'switch:toggled' },
          ]),
        },
      },
      {
        id: 'door1', type: 'door', x: 32, y: 0, width: 16, height: 16,
        properties: {
          __components: JSON.stringify([{ id: 'door' }]),
        },
      },
    ]);
    const router = new ObjectEventRouter(mgr);
    return { mgr, router };
  }

  it('interacting with switch toggles connected door open', () => {
    const { mgr, router } = createScene();

    const switchObj = mgr.getObjectById('switch1');
    const doorObj = mgr.getObjectById('door1');

    // Door starts closed
    expect(doorObj.components.get('door').params.isOpen).toBe(false);

    // Interact with switch → router delivers switch:toggled → door toggles
    switchObj.onInteract({ x: 0, y: 0 });
    expect(doorObj.components.get('door').params.isOpen).toBe(true);

    router.destroy();
    mgr.destroy();
  });

  it('second switch interact toggles door closed again', () => {
    const { mgr, router } = createScene();

    const switchObj = mgr.getObjectById('switch1');
    const doorObj = mgr.getObjectById('door1');

    switchObj.onInteract({ x: 0, y: 0 }); // open
    switchObj.onInteract({ x: 0, y: 0 }); // close

    expect(doorObj.components.get('door').params.isOpen).toBe(false);

    router.destroy();
    mgr.destroy();
  });

  it('emits both switch and door events through the chain', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, router } = createScene();
    const switchObj = mgr.getObjectById('switch1');

    switchObj.onInteract({ x: 0, y: 0 });

    const eventNames = events.map(e => e.eventName);
    expect(eventNames).toContain('switch:on');
    expect(eventNames).toContain('switch:toggled');
    expect(eventNames).toContain('door:opened');

    router.destroy();
    mgr.destroy();
  });

  it('does not route unrelated events', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      {
        id: 'switch2', type: 'switch', x: 0, y: 0, width: 16, height: 16,
        properties: {
          __components: JSON.stringify([{ id: 'switch' }]),
          __connections: JSON.stringify([
            // Only route switch:on, not switch:toggled
            { name: 'link', targetId: 'door2', event: 'switch:on' },
          ]),
        },
      },
      {
        id: 'door2', type: 'door', x: 32, y: 0, width: 16, height: 16,
        properties: {
          __components: JSON.stringify([{ id: 'door' }]),
        },
      },
    ]);
    const router = new ObjectEventRouter(mgr);

    const switchObj = mgr.getObjectById('switch2');
    const doorObj = mgr.getObjectById('door2');

    switchObj.onInteract({ x: 0, y: 0 }); // emits switch:on + switch:toggled

    // switch:on routes → door opens from onEvent(switch:on)
    // switch:toggled does NOT route (not in connection filter)
    // So door should be open (one toggle from switch:on)
    expect(doorObj.components.get('door').params.isOn).toBeUndefined;
    expect(doorObj.components.get('door').params.isOpen).toBe(true);

    router.destroy();
    mgr.destroy();
  });

  it('router destroy stops routing', () => {
    const { mgr, router } = createScene();

    const switchObj = mgr.getObjectById('switch1');
    const doorObj = mgr.getObjectById('door1');

    router.destroy();

    switchObj.onInteract({ x: 0, y: 0 });
    // Door should remain closed — router is destroyed
    expect(doorObj.components.get('door').params.isOpen).toBe(false);

    mgr.destroy();
  });
});
