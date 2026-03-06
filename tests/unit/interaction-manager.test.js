import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OBJECT_INTERACT, OBJECT_TOUCH, OBJECT_STEP } from '../../client/src/core/Events.js';

describe('InteractionManager', () => {
  let InteractionManager, ObjectManager, eventBus;

  beforeEach(async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    eventBus = ebMod.default;
    eventBus.reset();

    const omMod = await import('../../client/src/objects/ObjectManager.js');
    ObjectManager = omMod.ObjectManager;

    const imMod = await import('../../client/src/objects/InteractionManager.js');
    InteractionManager = imMod.InteractionManager;
  });

  function createObjMgr(objects) {
    const mgr = new ObjectManager();
    mgr.createFromMapData(objects);
    return mgr;
  }

  // Mock scene with add.text() for InteractionPrompt
  function makeMockGameObject() {
    return {
      setOrigin: vi.fn(),
      setDepth: vi.fn(),
      setVisible: vi.fn(),
      setText: vi.fn(),
      setPosition: vi.fn(),
      setStrokeStyle: vi.fn(),
      destroy: vi.fn(),
    };
  }

  function makeScene() {
    return {
      add: {
        text: vi.fn(() => makeMockGameObject()),
        rectangle: vi.fn(() => makeMockGameObject()),
        container: vi.fn(() => makeMockGameObject()),
      },
    };
  }

  function noInput() {
    return { moveX: 0, moveY: 0, sprint: false, jump: false, interact: false };
  }

  it('finds interact target when player is in range', () => {
    const mgr = createObjMgr([{
      id: 'chest1', type: 'chest', x: 10, y: 10, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'interactable', promptText: 'Open' }]),
      },
    }]);
    const im = new InteractionManager(mgr, makeScene());

    im.update(16, 10, 10, noInput());

    expect(im.currentTarget).not.toBeNull();
    expect(im.currentTarget.id).toBe('chest1');

    im.destroy();
    mgr.destroy();
  });

  it('clears target when player moves away', () => {
    const mgr = createObjMgr([{
      id: 'chest1', type: 'chest', x: 10, y: 10, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'interactable' }]),
      },
    }]);
    const im = new InteractionManager(mgr, makeScene());

    im.update(16, 10, 10, noInput());
    expect(im.currentTarget).not.toBeNull();

    im.update(16, 500, 500, noInput());
    expect(im.currentTarget).toBeNull();

    im.destroy();
    mgr.destroy();
  });

  it('dispatches onInteract and emits event on E press', () => {
    const mgr = createObjMgr([{
      id: 'door1', type: 'door', x: 10, y: 10, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'interactable', promptText: 'Open' }]),
      },
    }]);
    const im = new InteractionManager(mgr, makeScene());

    const events = [];
    eventBus.on(OBJECT_INTERACT, (e) => events.push(e));

    const input = { ...noInput(), interact: true };
    im.update(16, 10, 10, input);

    expect(events).toHaveLength(1);
    expect(events[0].objectId).toBe('door1');

    im.destroy();
    mgr.destroy();
  });

  it('does not dispatch interact when no target', () => {
    const mgr = createObjMgr([]);
    const im = new InteractionManager(mgr, makeScene());

    const events = [];
    eventBus.on(OBJECT_INTERACT, (e) => events.push(e));

    const input = { ...noInput(), interact: true };
    im.update(16, 10, 10, input);

    expect(events).toHaveLength(0);

    im.destroy();
    mgr.destroy();
  });

  it('respects interact cooldown', () => {
    const mgr = createObjMgr([{
      id: 'obj1', type: 'a', x: 10, y: 10, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'interactable' }]),
      },
    }]);
    const im = new InteractionManager(mgr, makeScene());

    const events = [];
    eventBus.on(OBJECT_INTERACT, (e) => events.push(e));

    const input = { ...noInput(), interact: true };
    im.update(16, 10, 10, input);
    expect(events).toHaveLength(1);

    // Second press within cooldown — should not fire
    im.update(16, 10, 10, input);
    expect(events).toHaveLength(1);

    // After cooldown expires
    im.update(300, 10, 10, input);
    expect(events).toHaveLength(2);

    im.destroy();
    mgr.destroy();
  });

  it('fires touch event on enter', () => {
    const mgr = createObjMgr([{
      id: 'trap1', type: 'trap', x: 5, y: 5, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'interactable', trigger: 'touch' }]),
      },
    }]);
    const im = new InteractionManager(mgr, makeScene());

    const events = [];
    eventBus.on(OBJECT_TOUCH, (e) => events.push(e));

    im.update(16, 5, 5, noInput());
    expect(events).toHaveLength(1);

    // Staying on top — should not re-fire
    im.update(16, 5, 5, noInput());
    expect(events).toHaveLength(1);

    im.destroy();
    mgr.destroy();
  });

  it('fires step event on enter', () => {
    const mgr = createObjMgr([{
      id: 'plate1', type: 'plate', x: 5, y: 5, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'interactable', trigger: 'step' }]),
      },
    }]);
    const im = new InteractionManager(mgr, makeScene());

    const events = [];
    eventBus.on(OBJECT_STEP, (e) => events.push(e));

    im.update(16, 5, 5, noInput());
    expect(events).toHaveLength(1);

    im.destroy();
    mgr.destroy();
  });

  it('ignores objects without interactable component for prompt', () => {
    const mgr = createObjMgr([{
      id: 'rock1', type: 'rock', x: 10, y: 10, width: 16, height: 16,
      properties: {},
    }]);
    const im = new InteractionManager(mgr, makeScene());

    im.update(16, 10, 10, noInput());
    expect(im.currentTarget).toBeNull();

    im.destroy();
    mgr.destroy();
  });

  it('destroy cleans up', () => {
    const mgr = createObjMgr([]);
    const im = new InteractionManager(mgr, makeScene());

    im.destroy();
    expect(im.currentTarget).toBeNull();

    mgr.destroy();
  });
});
