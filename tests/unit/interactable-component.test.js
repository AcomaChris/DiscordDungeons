import { describe, it, expect, beforeEach } from 'vitest';

describe('InteractableComponent', () => {
  let InteractableComponent, componentRegistry, ObjectManager;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    ebMod.default.reset();

    // Import ObjectManager first — it registers InteractableComponent
    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;

    const crMod = await import('../../client/src/objects/ComponentRegistry.js');
    componentRegistry = crMod.componentRegistry;

    const icMod = await import('../../client/src/objects/components/InteractableComponent.js');
    InteractableComponent = icMod.InteractableComponent;
  });

  it('is registered in the component registry', () => {
    expect(componentRegistry.has('interactable')).toBe(true);
  });

  it('creates InteractableComponent when used via ObjectManager', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'obj1', type: 'chest', x: 0, y: 0,
      properties: {
        __components: JSON.stringify([{ id: 'interactable', promptText: 'Open' }]),
      },
    }]);
    const obj = mgr.getObjectById('obj1');
    const comp = obj.components.get('interactable');
    expect(comp).toBeInstanceOf(InteractableComponent);
    expect(comp.params.promptText).toBe('Open');
    mgr.destroy();
  });

  it('emits interact event on onInteract', async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');

    const events = [];
    ebMod.default.on(OBJECT_EVENT, (e) => events.push(e));

    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'obj1', type: 'chest', x: 0, y: 0,
      properties: {
        __components: JSON.stringify([{ id: 'interactable' }]),
      },
    }]);
    const obj = mgr.getObjectById('obj1');
    obj.onInteract({ x: 10, y: 20 });

    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('interact');
    expect(events[0].sourceId).toBe('obj1');
    mgr.destroy();
  });

  it('emits touch event on onTouch', async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    const { OBJECT_EVENT } = await import('../../client/src/core/Events.js');

    const events = [];
    ebMod.default.on(OBJECT_EVENT, (e) => events.push(e));

    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'obj1', type: 'trap', x: 0, y: 0,
      properties: {
        __components: JSON.stringify([{ id: 'interactable', trigger: 'touch' }]),
      },
    }]);
    const obj = mgr.getObjectById('obj1');
    obj.onTouch({ x: 0, y: 0 });

    expect(events).toHaveLength(1);
    expect(events[0].eventName).toBe('touch');
    mgr.destroy();
  });

  it('uses default prompt text from ComponentDefs', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'obj1', type: 'a', x: 0, y: 0,
      properties: {
        __components: JSON.stringify([{ id: 'interactable' }]),
      },
    }]);
    const obj = mgr.getObjectById('obj1');
    expect(obj.promptText).toBe('Interact');
    mgr.destroy();
  });
});
