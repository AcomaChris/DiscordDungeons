import { describe, it, expect, beforeEach } from 'vitest';
import { AbilityManager } from '../../client/src/abilities/AbilityManager.js';

describe('AbilityManager', () => {
  let mgr;

  beforeEach(() => {
    mgr = new AbilityManager();
  });

  // --- Constructor ---

  it('equips DEFAULT_ABILITIES on construction', () => {
    expect(mgr.has('movement')).toBe(true);
  });

  it('does not equip non-default abilities', () => {
    expect(mgr.has('float')).toBe(false);
  });

  // --- equip / unequip / has ---

  it('equips a valid ability', () => {
    mgr.equip('jump');
    expect(mgr.has('jump')).toBe(true);
  });

  it('unequips an ability', () => {
    mgr.unequip('movement');
    expect(mgr.has('movement')).toBe(false);
  });

  it('equip with unknown ID is a no-op', () => {
    mgr.equip('nonexistent');
    expect(mgr.has('nonexistent')).toBe(false);
  });

  // --- get / getParam / setParam ---

  it('get returns params and active state', () => {
    const result = mgr.get('movement');
    expect(result).not.toBeNull();
    expect(result.params.walkSpeed).toBe(80);
    expect(result.params.sprintSpeed).toBe(160);
    expect(result.active).toBe(false);
  });

  it('get returns null for unequipped ability', () => {
    expect(mgr.get('float')).toBeNull();
  });

  it('getParam returns a specific param value', () => {
    expect(mgr.getParam('movement', 'walkSpeed')).toBe(80);
  });

  it('getParam returns undefined for unequipped ability', () => {
    expect(mgr.getParam('float', 'gravityFactor')).toBeUndefined();
  });

  it('setParam updates a param value', () => {
    mgr.setParam('movement', 'walkSpeed', 100);
    expect(mgr.getParam('movement', 'walkSpeed')).toBe(100);
  });

  // --- updateFromInput ---

  it('activates movement when sprint input is true', () => {
    mgr.updateFromInput({ sprint: true });
    expect(mgr.get('movement').active).toBe(true);
  });

  it('deactivates movement when sprint input is false', () => {
    mgr.updateFromInput({ sprint: true });
    mgr.updateFromInput({ sprint: false });
    expect(mgr.get('movement').active).toBe(false);
  });

  it('passive abilities are always active regardless of input', () => {
    mgr.equip('float');
    mgr.updateFromInput({ sprint: false });
    expect(mgr.get('float').active).toBe(true);
  });

  // --- Network serialization ---

  it('getState returns correct shape', () => {
    const state = mgr.getState();
    expect(state.equipped).toEqual(['movement', 'jump']);
    expect(state.active).toEqual([]);
    expect(state.params.movement).toEqual({ walkSpeed: 80, sprintSpeed: 160, stepHeight: 8 });
    expect(state.params.jump).toEqual({ heightPower: 200, horizontalPower: 100 });
  });

  it('getState includes active abilities when sprinting', () => {
    mgr.updateFromInput({ sprint: true });
    const state = mgr.getState();
    expect(state.active).toEqual(['movement']);
  });

  it('applyState syncs equipped and active sets', () => {
    const remote = new AbilityManager();
    remote.equip('jump');
    remote.equip('float');
    remote.updateFromInput({ sprint: true });
    const state = remote.getState();

    mgr.applyState(state);

    expect(mgr.has('movement')).toBe(true);
    expect(mgr.has('jump')).toBe(true);
    expect(mgr.has('float')).toBe(true);
    expect(mgr.get('movement').active).toBe(true);
    expect(mgr.get('float').active).toBe(true);
  });

  it('applyState removes abilities not in remote state', () => {
    mgr.equip('jump');
    // Remote only has movement
    mgr.applyState({ equipped: ['movement'], active: [], params: {} });
    expect(mgr.has('jump')).toBe(false);
    expect(mgr.has('movement')).toBe(true);
  });

  it('getState/applyState round-trips correctly', () => {
    mgr.equip('jump');
    mgr.equip('float');
    mgr.updateFromInput({ sprint: true });
    mgr.setParam('movement', 'sprintSpeed', 200);

    const state = mgr.getState();
    const restored = new AbilityManager();
    restored.applyState(state);

    expect(restored.has('movement')).toBe(true);
    expect(restored.has('jump')).toBe(true);
    expect(restored.has('float')).toBe(true);
    expect(restored.get('movement').active).toBe(true);
    expect(restored.get('movement').params.sprintSpeed).toBe(200);
    expect(restored.get('float').active).toBe(true);
  });

  it('applyState handles null gracefully', () => {
    mgr.applyState(null);
    expect(mgr.has('movement')).toBe(true);
  });

  // --- Modifiers ---

  it('addModifier adds a modifier to an ability', () => {
    const ok = mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    expect(ok).toBe(true);
    expect(mgr.getModifiers('movement')).toHaveLength(1);
  });

  it('addModifier with same id replaces existing', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 30 });
    expect(mgr.getModifiers('movement')).toHaveLength(1);
    expect(mgr.getModifiers('movement')[0].value).toBe(30);
  });

  it('addModifier returns false for unequipped ability', () => {
    expect(mgr.addModifier('float', { id: 'x', param: 'gravityFactor', op: 'add', value: 1 })).toBe(false);
  });

  it('removeModifier removes by id', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    const ok = mgr.removeModifier('movement', 'boots');
    expect(ok).toBe(true);
    expect(mgr.getModifiers('movement')).toHaveLength(0);
  });

  it('removeModifier returns false for nonexistent modifier', () => {
    expect(mgr.removeModifier('movement', 'nope')).toBe(false);
  });

  it('getModifiers returns empty array for ability with no modifiers', () => {
    expect(mgr.getModifiers('movement')).toEqual([]);
  });

  it('getModifiers returns empty array for unequipped ability', () => {
    expect(mgr.getModifiers('float')).toEqual([]);
  });

  it('clearModifiers removes all modifiers', () => {
    mgr.addModifier('movement', { id: 'a', param: 'walkSpeed', op: 'add', value: 10 });
    mgr.addModifier('movement', { id: 'b', param: 'sprintSpeed', op: 'mul', value: 1.5 });
    mgr.clearModifiers('movement');
    expect(mgr.getModifiers('movement')).toHaveLength(0);
  });

  it('clearModifiers with source only removes matching source', () => {
    mgr.addModifier('movement', { id: 'a', param: 'walkSpeed', op: 'add', value: 10, source: 'item:boots' });
    mgr.addModifier('movement', { id: 'b', param: 'walkSpeed', op: 'add', value: 5, source: 'env:wind' });
    mgr.clearModifiers('movement', 'item:boots');
    const mods = mgr.getModifiers('movement');
    expect(mods).toHaveLength(1);
    expect(mods[0].id).toBe('b');
  });

  it('getParam returns resolved value with modifiers', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    expect(mgr.getParam('movement', 'walkSpeed')).toBe(100);
  });

  it('getBaseParam returns unmodified value', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    expect(mgr.getBaseParam('movement', 'walkSpeed')).toBe(80);
  });

  it('get() returns resolved params object', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    const result = mgr.get('movement');
    expect(result.params.walkSpeed).toBe(100);
    expect(result.params.sprintSpeed).toBe(160); // unmodified param unchanged
  });

  it('setParam writes base value, does not affect modifiers', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    mgr.setParam('movement', 'walkSpeed', 90);
    expect(mgr.getBaseParam('movement', 'walkSpeed')).toBe(90);
    expect(mgr.getParam('movement', 'walkSpeed')).toBe(110); // 90 + 20
  });

  it('unequip clears modifiers along with ability', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    mgr.unequip('movement');
    expect(mgr.getModifiers('movement')).toEqual([]);
  });

  // --- Modifier serialization ---

  it('getState includes modifiers in output', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    const state = mgr.getState();
    expect(state.modifiers.movement).toHaveLength(1);
    expect(state.modifiers.movement[0].id).toBe('boots');
  });

  it('getState omits modifiers key for abilities with none', () => {
    const state = mgr.getState();
    expect(state.modifiers).toEqual({});
  });

  it('applyState restores modifiers', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    const state = mgr.getState();

    const restored = new AbilityManager();
    restored.applyState(state);
    expect(restored.getModifiers('movement')).toHaveLength(1);
    expect(restored.getParam('movement', 'walkSpeed')).toBe(100);
  });

  it('applyState clears modifiers when remote has none', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    mgr.applyState({ equipped: ['movement', 'jump'], active: [], params: {} });
    expect(mgr.getModifiers('movement')).toHaveLength(0);
  });

  it('getState/applyState round-trips modifiers', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20, source: 'item:boots' });
    mgr.addModifier('jump', { id: 'ring', param: 'heightPower', op: 'mul', value: 2, source: 'item:ring' });

    const state = mgr.getState();
    const restored = new AbilityManager();
    restored.applyState(state);

    expect(restored.getParam('movement', 'walkSpeed')).toBe(100);
    expect(restored.getParam('jump', 'heightPower')).toBe(400);
  });

  it('applyState handles missing modifiers field (backward compat)', () => {
    mgr.addModifier('movement', { id: 'boots', param: 'walkSpeed', op: 'add', value: 20 });
    // Simulate old-format state without modifiers field
    mgr.applyState({ equipped: ['movement', 'jump'], active: [], params: {} });
    expect(mgr.getModifiers('movement')).toHaveLength(0);
  });
});
