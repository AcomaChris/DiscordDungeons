import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock sessionStorage for Node environment
const storage = {};
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn((key) => storage[key] || null),
  setItem: vi.fn((key, value) => { storage[key] = value; }),
  removeItem: vi.fn((key) => { delete storage[key]; }),
});

describe('ObjectStateStore', () => {
  let ObjectStateStore, objectStateStore;

  beforeEach(async () => {
    // Clear storage between tests
    for (const key of Object.keys(storage)) delete storage[key];

    const mod = await import('../../client/src/objects/ObjectStateStore.js');
    objectStateStore = mod.default;
    ObjectStateStore = objectStateStore.constructor;

    objectStateStore.clear();
  });

  it('saves and loads volatile state', () => {
    objectStateStore.save('obj1', { isOpen: true }, 'volatile');
    const state = objectStateStore.load('obj1');
    expect(state).toEqual({ isOpen: true });
  });

  it('volatile state is lost after clear', () => {
    objectStateStore.save('obj1', { isOpen: true }, 'volatile');
    objectStateStore.clear();
    expect(objectStateStore.load('obj1')).toBeNull();
  });

  it('saves and loads session state', () => {
    objectStateStore.save('obj1', { items: ['gold'] }, 'session');
    const state = objectStateStore.load('obj1');
    expect(state).toEqual({ items: ['gold'] });
  });

  it('session state persists to sessionStorage', () => {
    objectStateStore.save('obj1', { x: 1 }, 'session');
    expect(sessionStorage.setItem).toHaveBeenCalled();

    const raw = storage['dd_object_states'];
    const data = JSON.parse(raw);
    expect(data['obj1']).toEqual({ x: 1 });
  });

  it('session state has higher priority than volatile', () => {
    objectStateStore.save('obj1', { from: 'volatile' }, 'volatile');
    objectStateStore.save('obj1', { from: 'session' }, 'session');
    const state = objectStateStore.load('obj1');
    expect(state.from).toBe('session');
  });

  it('persistent falls back to session for now', () => {
    objectStateStore.save('obj1', { from: 'persistent' }, 'persistent');
    const state = objectStateStore.load('obj1');
    expect(state.from).toBe('persistent');
  });

  it('remove deletes from all tiers', () => {
    objectStateStore.save('obj1', { a: 1 }, 'volatile');
    objectStateStore.save('obj1', { a: 2 }, 'session');
    objectStateStore.remove('obj1');
    expect(objectStateStore.load('obj1')).toBeNull();
  });

  it('saveAll saves session-tier objects', async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    ebMod.default.reset();
    const { ObjectManager } = await import('../../client/src/objects/ObjectManager.js');

    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'door1', type: 'door', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'door' }]),
      },
    }]);

    // Open the door so it has state to save
    mgr.getObjectById('door1').onInteract({ x: 0, y: 0 });

    objectStateStore.saveAll(mgr);

    // Door has session persistence, so it should be in sessionStorage
    const state = objectStateStore.load('door1');
    expect(state).not.toBeNull();

    mgr.destroy();
  });

  it('restoreAll applies saved state to objects', async () => {
    const ebMod = await import('../../client/src/core/EventBus.js');
    ebMod.default.reset();
    const { ObjectManager } = await import('../../client/src/objects/ObjectManager.js');

    // Save a door state
    objectStateStore.save('door1', {
      id: 'door1',
      components: { door: { isOpen: true } },
    }, 'session');

    // Create a fresh door
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'door1', type: 'door', x: 0, y: 0, width: 16, height: 16,
      properties: {
        __components: JSON.stringify([{ id: 'door' }]),
      },
    }]);

    objectStateStore.restoreAll(mgr);

    const door = mgr.getObjectById('door1');
    expect(door.components.get('door').params.isOpen).toBe(true);

    mgr.destroy();
  });
});
