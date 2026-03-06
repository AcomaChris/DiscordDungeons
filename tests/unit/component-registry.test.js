import { describe, it, expect, beforeEach } from 'vitest';
import { componentRegistry } from '../../client/src/objects/ComponentRegistry.js';
import { Component } from '../../client/src/objects/Component.js';

class CustomComponent extends Component {
  init() { this.custom = true; }
}

describe('ComponentRegistry', () => {
  it('creates a base Component for known def without registered class', () => {
    const owner = { id: 'obj1' };
    const comp = componentRegistry.create('door', owner);
    expect(comp).toBeInstanceOf(Component);
    expect(comp.id).toBe('door');
    expect(comp.owner).toBe(owner);
  });

  it('creates registered class when available', () => {
    componentRegistry.register('interactable', CustomComponent);
    const comp = componentRegistry.create('interactable', { id: 'obj1' });
    expect(comp).toBeInstanceOf(CustomComponent);
    comp.init();
    expect(comp.custom).toBe(true);
  });

  it('returns null for unknown component ID', () => {
    expect(componentRegistry.create('nonexistent', {})).toBeNull();
  });

  it('applies overrides to params', () => {
    const comp = componentRegistry.create('door', { id: 'obj1' }, { isOpen: true });
    expect(comp.params.isOpen).toBe(true);
    // Default params still present
    expect(comp.params.lockId).toBeNull();
  });

  it('has returns true for registered IDs', () => {
    componentRegistry.register('test-comp', CustomComponent);
    expect(componentRegistry.has('test-comp')).toBe(true);
    expect(componentRegistry.has('unknown')).toBe(false);
  });

  it('registeredIds returns all registered IDs', () => {
    componentRegistry.register('reg-test', CustomComponent);
    expect(componentRegistry.registeredIds).toContain('reg-test');
  });

  it('preserves def metadata on created component', () => {
    const comp = componentRegistry.create('container', { id: 'obj1' });
    expect(comp.authority).toBe('server');
    expect(comp.persistence).toBe('session');
    expect(comp.trigger).toBe('interact');
  });

  it('allows trigger override', () => {
    const comp = componentRegistry.create('door', { id: 'obj1' }, { trigger: 'touch' });
    expect(comp.trigger).toBe('touch');
  });
});
