import { describe, it, expect } from 'vitest';
import {
  COMPONENT_DEFS, getComponentDef, getComponentIds, getComponentsByCategory,
  ComponentCategory, Authority, Persistence, TriggerType,
} from '../../client/src/objects/ComponentDefs.js';

describe('ComponentDefs', () => {
  const validCategories = Object.values(ComponentCategory);
  const validAuthorities = Object.values(Authority);
  const validPersistence = Object.values(Persistence);
  const validTriggers = Object.values(TriggerType);

  it('has at least one component defined', () => {
    expect(Object.keys(COMPONENT_DEFS).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(COMPONENT_DEFS))('%s has required fields', (id, def) => {
    expect(def.id).toBe(id);
    expect(typeof def.name).toBe('string');
    expect(validCategories).toContain(def.category);
    expect(validAuthorities).toContain(def.authority);
    expect(validPersistence).toContain(def.persistence);
    expect(validTriggers).toContain(def.trigger);
    expect(typeof def.params).toBe('object');
  });

  it('getComponentDef returns def for known ID', () => {
    const def = getComponentDef('interactable');
    expect(def).toBeDefined();
    expect(def.id).toBe('interactable');
  });

  it('getComponentDef returns null for unknown ID', () => {
    expect(getComponentDef('nonexistent')).toBeNull();
  });

  it('getComponentIds returns all keys', () => {
    const ids = getComponentIds();
    expect(ids).toContain('interactable');
    expect(ids).toContain('door');
    expect(ids).toContain('container');
    expect(ids.length).toBe(Object.keys(COMPONENT_DEFS).length);
  });

  it('getComponentsByCategory filters correctly', () => {
    const core = getComponentsByCategory(ComponentCategory.CORE);
    expect(core.length).toBeGreaterThan(0);
    expect(core.every(d => d.category === ComponentCategory.CORE)).toBe(true);
  });

  it('Wave 1 components are defined', () => {
    expect(getComponentDef('interactable')).not.toBeNull();
    expect(getComponentDef('door')).not.toBeNull();
    expect(getComponentDef('container')).not.toBeNull();
  });

  it('Wave 2 components are defined', () => {
    expect(getComponentDef('switch')).not.toBeNull();
    expect(getComponentDef('trap')).not.toBeNull();
    expect(getComponentDef('destructible')).not.toBeNull();
  });
});
