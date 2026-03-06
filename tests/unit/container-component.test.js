import { describe, it, expect, beforeEach } from 'vitest';

describe('ContainerComponent', () => {
  let ContainerComponent, ObjectManager, eventBus;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;

    const ccMod = await import('../../client/src/objects/components/ContainerComponent.js');
    ContainerComponent = ccMod.ContainerComponent;
  });

  function createContainer(items = [], overrides = {}) {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'chest1', type: 'chest', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'container', items, ...overrides }]),
      },
    }]);
    return { mgr, obj: mgr.getObjectById('chest1') };
  }

  it('starts closed', () => {
    const { mgr, obj } = createContainer();
    const comp = obj.components.get('container');
    expect(comp.isOpen).toBe(false);
    mgr.destroy();
  });

  it('opens on interact and emits event', async () => {
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');
    const events = [];
    eventBus.on(OBJECT_EVENT, (e) => events.push(e));

    const { mgr, obj } = createContainer();
    obj.onInteract({ x: 0, y: 0 });

    expect(obj.components.get('container').isOpen).toBe(true);
    const openEvent = events.find(e => e.eventName === 'container:opened');
    expect(openEvent).toBeDefined();
    mgr.destroy();
  });

  it('closes on second interact', () => {
    const { mgr, obj } = createContainer();
    obj.onInteract({ x: 0, y: 0 });
    obj.onInteract({ x: 0, y: 0 });
    expect(obj.components.get('container').isOpen).toBe(false);
    mgr.destroy();
  });

  it('holds pre-populated items', () => {
    const items = [{ id: 'gold', name: 'Gold', quantity: 3 }];
    const { mgr, obj } = createContainer(items);
    const comp = obj.components.get('container');
    expect(comp.items).toHaveLength(1);
    expect(comp.items[0].name).toBe('Gold');
    mgr.destroy();
  });

  it('takeItem removes and returns item', () => {
    const items = [
      { id: 'gold', name: 'Gold', quantity: 3 },
      { id: 'potion', name: 'Potion', quantity: 1 },
    ];
    const { mgr, obj } = createContainer(items);
    const comp = obj.components.get('container');

    const taken = comp.takeItem(0);
    expect(taken.id).toBe('gold');
    expect(comp.items).toHaveLength(1);
    expect(comp.items[0].id).toBe('potion');
    mgr.destroy();
  });

  it('takeItem returns null for invalid index', () => {
    const { mgr, obj } = createContainer();
    const comp = obj.components.get('container');
    expect(comp.takeItem(99)).toBeNull();
    mgr.destroy();
  });

  it('addItem adds to container', () => {
    const { mgr, obj } = createContainer();
    const comp = obj.components.get('container');
    const result = comp.addItem({ id: 'gem', name: 'Gem', quantity: 1 });
    expect(result).toBe(true);
    expect(comp.items).toHaveLength(1);
    mgr.destroy();
  });

  it('addItem returns false when full', () => {
    const { mgr, obj } = createContainer([], { maxSlots: 1 });
    const comp = obj.components.get('container');
    comp.addItem({ id: 'a', name: 'A', quantity: 1 });
    const result = comp.addItem({ id: 'b', name: 'B', quantity: 1 });
    expect(result).toBe(false);
    expect(comp.items).toHaveLength(1);
    mgr.destroy();
  });

  it('isEmpty and isFull report correctly', () => {
    const { mgr, obj } = createContainer([], { maxSlots: 1 });
    const comp = obj.components.get('container');
    expect(comp.isEmpty).toBe(true);
    expect(comp.isFull).toBe(false);

    comp.addItem({ id: 'a', name: 'A', quantity: 1 });
    expect(comp.isEmpty).toBe(false);
    expect(comp.isFull).toBe(true);
    mgr.destroy();
  });

  it('prompt text changes based on state', () => {
    const { mgr, obj } = createContainer();
    const comp = obj.components.get('container');
    expect(comp.promptText).toBe('Open');

    obj.onInteract({ x: 0, y: 0 });
    expect(comp.promptText).toBe('Close');
    mgr.destroy();
  });

  it('serializes and restores state', () => {
    const items = [{ id: 'gold', name: 'Gold', quantity: 3 }];
    const { mgr, obj } = createContainer(items);
    const comp = obj.components.get('container');
    obj.onInteract({ x: 0, y: 0 }); // open it

    const state = comp.getState();
    expect(state.items).toHaveLength(1);
    expect(state.isOpen).toBe(true);

    // Restore into fresh container
    const { mgr: mgr2, obj: obj2 } = createContainer();
    obj2.components.get('container').applyState(state);
    expect(obj2.components.get('container').items).toHaveLength(1);

    mgr.destroy();
    mgr2.destroy();
  });

  it('rolls loot table on first open', () => {
    const lootTable = [
      { id: 'gold', name: 'Gold', quantity: 10, chance: 1 },
      { id: 'nothing', name: 'Nothing', quantity: 1, chance: 0 },
    ];
    const { mgr, obj } = createContainer([], { lootTable });
    const comp = obj.components.get('container');

    obj.onInteract({ x: 0, y: 0 });

    // Gold always drops (chance 1), Nothing never drops (chance 0)
    expect(comp.items).toHaveLength(1);
    expect(comp.items[0].id).toBe('gold');
    mgr.destroy();
  });
});
