import { describe, it, expect, vi } from 'vitest';
import { InteractiveObject } from '../../client/src/objects/InteractiveObject.js';
import { componentRegistry } from '../../client/src/objects/ComponentRegistry.js';
import { Component } from '../../client/src/objects/Component.js';

class MockComponent extends Component {
  onInteract(player) { this.lastPlayer = player; }
  onEvent(name, data) { this.lastEvent = { name, data }; }
}

componentRegistry.register('interactable', MockComponent);

describe('InteractiveObject', () => {
  it('creates with config', () => {
    const obj = new InteractiveObject({ id: 'door1', type: 'door', x: 100, y: 200 });
    expect(obj.id).toBe('door1');
    expect(obj.type).toBe('door');
    expect(obj.x).toBe(100);
    expect(obj.y).toBe(200);
    expect(obj.tileX).toBe(6);
    expect(obj.tileY).toBe(12);
  });

  it('adds components from config', () => {
    const obj = new InteractiveObject({
      id: 'obj1',
      components: [{ id: 'interactable', promptText: 'Use' }],
    });
    expect(obj.components.has('interactable')).toBe(true);
    expect(obj.components.get('interactable').params.promptText).toBe('Use');
  });

  it('dispatches interact to components', () => {
    const obj = new InteractiveObject({
      id: 'obj1',
      components: [{ id: 'interactable' }],
    });
    const player = { id: 'p1' };
    obj.onInteract(player);
    expect(obj.components.get('interactable').lastPlayer).toBe(player);
  });

  it('receives events and dispatches to components', () => {
    const obj = new InteractiveObject({
      id: 'obj1',
      components: [{ id: 'interactable' }],
    });
    obj.receiveEvent('fire:spread', { intensity: 5 });
    expect(obj.components.get('interactable').lastEvent).toEqual({
      name: 'fire:spread',
      data: { intensity: 5 },
    });
  });

  it('computes center and distance', () => {
    const obj = new InteractiveObject({ id: 'obj1', x: 0, y: 0, width: 32, height: 32 });
    expect(obj.centerX).toBe(16);
    expect(obj.centerY).toBe(16);
    expect(obj.distanceTo(16, 16)).toBe(0);
    expect(obj.distanceTo(16, 26)).toBeCloseTo(10);
  });

  it('serializes and restores state', () => {
    const obj = new InteractiveObject({
      id: 'obj1',
      components: [{ id: 'interactable', promptText: 'Custom' }],
    });
    const state = obj.getState();
    expect(state.id).toBe('obj1');
    expect(state.components.interactable.promptText).toBe('Custom');

    const obj2 = new InteractiveObject({
      id: 'obj1',
      components: [{ id: 'interactable' }],
    });
    obj2.applyState(state);
    expect(obj2.components.get('interactable').params.promptText).toBe('Custom');
  });

  it('returns promptText from interact component', () => {
    const obj = new InteractiveObject({
      id: 'obj1',
      components: [{ id: 'interactable', promptText: 'Open' }],
    });
    expect(obj.promptText).toBe('Open');
  });

  it('returns null promptText when no interact component', () => {
    const obj = new InteractiveObject({ id: 'obj1' });
    expect(obj.promptText).toBeNull();
  });

  it('stores connections', () => {
    const obj = new InteractiveObject({
      id: 'obj1',
      connections: [{ name: 'lever', targetId: 'door1', event: 'toggle' }],
    });
    expect(obj.connections).toHaveLength(1);
    expect(obj.connections[0].targetId).toBe('door1');
  });

  it('destroy cleans up', () => {
    const obj = new InteractiveObject({
      id: 'obj1',
      components: [{ id: 'interactable' }],
    });
    obj.destroy();
    expect(obj.components.size).toBe(0);
    expect(obj.connections).toHaveLength(0);
  });
});
