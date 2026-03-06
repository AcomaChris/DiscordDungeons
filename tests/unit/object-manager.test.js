import { describe, it, expect } from 'vitest';
import { ObjectManager } from '../../client/src/objects/ObjectManager.js';

describe('ObjectManager', () => {
  it('creates objects from map data', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 1, name: 'chest', type: 'chest', x: 100, y: 200, width: 16, height: 16, properties: {} },
      { id: 2, name: 'door', type: 'door', x: 200, y: 300, width: 16, height: 16, properties: {} },
    ]);
    expect(mgr.size).toBe(2);
  });

  it('skips spawn points', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 1, type: 'spawn', x: 50, y: 50, properties: {} },
      { id: 2, name: 'spawn', type: '', x: 60, y: 60, properties: {} },
      { id: 3, type: 'door', x: 100, y: 100, properties: {} },
    ]);
    expect(mgr.size).toBe(1);
  });

  it('getObjectById returns correct object', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 'door1', type: 'door', x: 100, y: 200, properties: {} },
    ]);
    const obj = mgr.getObjectById('door1');
    expect(obj).not.toBeNull();
    expect(obj.type).toBe('door');
  });

  it('getObjectById returns null for unknown', () => {
    const mgr = new ObjectManager();
    expect(mgr.getObjectById('unknown')).toBeNull();
  });

  it('getObjectsByType filters correctly', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 1, type: 'door', x: 0, y: 0, properties: {} },
      { id: 2, type: 'chest', x: 50, y: 0, properties: {} },
      { id: 3, type: 'door', x: 100, y: 0, properties: {} },
    ]);
    const doors = mgr.getObjectsByType('door');
    expect(doors).toHaveLength(2);
  });

  it('getObjectsInRadius returns sorted by distance', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 'far', type: 'a', x: 200, y: 0, width: 16, height: 16, properties: {} },
      { id: 'near', type: 'b', x: 10, y: 0, width: 16, height: 16, properties: {} },
    ]);
    const results = mgr.getObjectsInRadius(0, 8, 300);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('near');
    expect(results[1].id).toBe('far');
  });

  it('getObjectsInRadius excludes objects outside range', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 'near', type: 'a', x: 10, y: 10, width: 16, height: 16, properties: {} },
      { id: 'far', type: 'b', x: 500, y: 500, width: 16, height: 16, properties: {} },
    ]);
    const results = mgr.getObjectsInRadius(0, 0, 50);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('near');
  });

  it('getObjectsInTileRadius works with tile coordinates', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 'obj1', type: 'a', x: 16, y: 16, width: 16, height: 16, properties: {} },
    ]);
    // Object is at tile (1,1), query from tile (1,1) radius 1
    const results = mgr.getObjectsInTileRadius(1, 1, 1);
    expect(results).toHaveLength(1);
  });

  it('parses __components from properties', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'obj1',
      type: 'door',
      x: 0, y: 0,
      properties: {
        __components: JSON.stringify([{ id: 'interactable', promptText: 'Open' }]),
      },
    }]);
    const obj = mgr.getObjectById('obj1');
    expect(obj.components.has('interactable')).toBe(true);
  });

  it('parses __connections from properties', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'obj1',
      type: 'lever',
      x: 0, y: 0,
      properties: {
        __connections: JSON.stringify([{ name: 'link', targetId: 'door1', event: 'toggle' }]),
      },
    }]);
    const obj = mgr.getObjectById('obj1');
    expect(obj.connections).toHaveLength(1);
  });

  it('handles malformed __components gracefully', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([{
      id: 'obj1', type: 'a', x: 0, y: 0,
      properties: { __components: 'not-json' },
    }]);
    expect(mgr.getObjectById('obj1').components.size).toBe(0);
  });

  it('update calls update on all objects', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 1, type: 'a', x: 0, y: 0, properties: {} },
    ]);
    // Should not throw
    mgr.update(16);
  });

  it('destroy cleans up all objects', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 1, type: 'a', x: 0, y: 0, properties: {} },
      { id: 2, type: 'b', x: 50, y: 0, properties: {} },
    ]);
    mgr.destroy();
    expect(mgr.size).toBe(0);
  });

  it('all returns array of all objects', () => {
    const mgr = new ObjectManager();
    mgr.createFromMapData([
      { id: 1, type: 'a', x: 0, y: 0, properties: {} },
    ]);
    expect(mgr.all).toHaveLength(1);
  });
});
