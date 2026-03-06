import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentManager } from '../../client/src/objects/ComponentManager.js';
import { componentRegistry } from '../../client/src/objects/ComponentRegistry.js';
import { Component } from '../../client/src/objects/Component.js';
import { getComponentDef } from '../../client/src/objects/ComponentDefs.js';

// Register a test component class
class TestComponent extends Component {
  init() { this._initCalled = true; }
  update(delta) { this._lastDelta = delta; }
  onInteract(player) { this._interactPlayer = player; }
  onEvent(name, data) { this._lastEvent = { name, data }; }
  destroy() { this._destroyed = true; super.destroy(); }
}

beforeEach(() => {
  // Register TestComponent as 'interactable' for tests
  componentRegistry.register('interactable', TestComponent);
});

function createOwner() {
  return { id: 'test-obj', emit: vi.fn() };
}

describe('ComponentManager', () => {
  it('adds a component by ID', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable');
    expect(comp).toBeInstanceOf(TestComponent);
    expect(mgr.has('interactable')).toBe(true);
    expect(mgr.size).toBe(1);
  });

  it('returns null for duplicate add', () => {
    const mgr = new ComponentManager(createOwner());
    mgr.add('interactable');
    expect(mgr.add('interactable')).toBeNull();
  });

  it('returns null for unknown component ID', () => {
    const mgr = new ComponentManager(createOwner());
    expect(mgr.add('nonexistent')).toBeNull();
  });

  it('removes a component', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable');
    expect(mgr.remove('interactable')).toBe(true);
    expect(mgr.has('interactable')).toBe(false);
    expect(comp._destroyed).toBe(true);
  });

  it('get returns component or null', () => {
    const mgr = new ComponentManager(createOwner());
    mgr.add('interactable');
    expect(mgr.get('interactable')).toBeInstanceOf(TestComponent);
    expect(mgr.get('unknown')).toBeNull();
  });

  it('initAll calls init on all components', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable');
    mgr.initAll();
    expect(comp._initCalled).toBe(true);
  });

  it('update calls update on all components', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable');
    mgr.update(16);
    expect(comp._lastDelta).toBe(16);
  });

  it('dispatch routes to correct trigger type', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable');
    const player = { id: 'p1' };
    mgr.dispatch('interact', player);
    expect(comp._interactPlayer).toBe(player);
  });

  it('dispatch ignores components with wrong trigger', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable'); // trigger = 'interact'
    mgr.dispatch('step', { id: 'p1' });
    expect(comp._interactPlayer).toBeUndefined();
  });

  it('dispatchEvent sends to all components', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable');
    mgr.dispatchEvent('test:event', { foo: 1 });
    expect(comp._lastEvent).toEqual({ name: 'test:event', data: { foo: 1 } });
  });

  it('getInteractTrigger returns first interact-triggered component', () => {
    const mgr = new ComponentManager(createOwner());
    mgr.add('interactable');
    const trigger = mgr.getInteractTrigger();
    expect(trigger).toBeInstanceOf(TestComponent);
    expect(trigger.trigger).toBe('interact');
  });

  it('getState/applyState round-trips', () => {
    const mgr = new ComponentManager(createOwner());
    mgr.add('interactable', { promptText: 'Custom' });

    const state = mgr.getState();
    expect(state.interactable.promptText).toBe('Custom');

    // Create new manager, apply state
    const mgr2 = new ComponentManager(createOwner());
    mgr2.add('interactable');
    mgr2.applyState(state);
    expect(mgr2.get('interactable').params.promptText).toBe('Custom');
  });

  it('destroy cleans up all components', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable');
    mgr.destroy();
    expect(comp._destroyed).toBe(true);
    expect(mgr.size).toBe(0);
  });

  it('applies per-instance overrides', () => {
    const mgr = new ComponentManager(createOwner());
    const comp = mgr.add('interactable', { radius: 48, promptText: 'Use' });
    expect(comp.params.radius).toBe(48);
    expect(comp.params.promptText).toBe('Use');
    // Default params still present
    expect(comp.params.cooldown).toBe(0);
  });

  it('is iterable', () => {
    const mgr = new ComponentManager(createOwner());
    mgr.add('interactable');
    const components = [...mgr];
    expect(components).toHaveLength(1);
    expect(components[0]).toBeInstanceOf(TestComponent);
  });
});
