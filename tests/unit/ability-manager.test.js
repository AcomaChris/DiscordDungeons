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
    expect(mgr.has('jump')).toBe(false);
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
    expect(mgr.get('jump')).toBeNull();
  });

  it('getParam returns a specific param value', () => {
    expect(mgr.getParam('movement', 'walkSpeed')).toBe(80);
  });

  it('getParam returns undefined for unequipped ability', () => {
    expect(mgr.getParam('jump', 'heightPower')).toBeUndefined();
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
    expect(state.equipped).toEqual(['movement']);
    expect(state.active).toEqual([]);
    expect(state.params.movement).toEqual({ walkSpeed: 80, sprintSpeed: 160 });
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
});
