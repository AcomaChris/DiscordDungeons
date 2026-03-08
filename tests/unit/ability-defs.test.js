import { describe, it, expect } from 'vitest';
import { ABILITY_DEFS, AbilityType, DEFAULT_ABILITIES } from '../../client/src/abilities/AbilityDefs.js';

describe('AbilityDefs', () => {
  it('all entries have required fields', () => {
    for (const [id, def] of Object.entries(ABILITY_DEFS)) {
      expect(def.id).toBe(id);
      expect([AbilityType.ACTIVE, AbilityType.PASSIVE]).toContain(def.type);
      expect(def.params).toBeDefined();
      expect(typeof def.params).toBe('object');
    }
  });

  it('active abilities have a non-null inputKey', () => {
    for (const def of Object.values(ABILITY_DEFS)) {
      if (def.type === AbilityType.ACTIVE) {
        expect(def.inputKey).not.toBeNull();
        expect(typeof def.inputKey).toBe('string');
      }
    }
  });

  it('passive abilities have null inputKey', () => {
    for (const def of Object.values(ABILITY_DEFS)) {
      if (def.type === AbilityType.PASSIVE) {
        expect(def.inputKey).toBeNull();
      }
    }
  });

  it('DEFAULT_ABILITIES references valid ability IDs', () => {
    for (const id of DEFAULT_ABILITIES) {
      expect(ABILITY_DEFS[id]).toBeDefined();
    }
  });

  it('movement has walkSpeed and stepHeight params', () => {
    const movement = ABILITY_DEFS.movement;
    expect(movement.params.walkSpeed).toBe(80);
    expect(movement.params.stepHeight).toBe(8);
  });

  it('sprint has sprintSpeed param', () => {
    const sprint = ABILITY_DEFS.sprint;
    expect(sprint.params.sprintSpeed).toBe(160);
    expect(sprint.type).toBe(AbilityType.ACTIVE);
    expect(sprint.inputKey).toBe('sprint');
  });

  it('jump has heightPower and horizontalPower params', () => {
    const jump = ABILITY_DEFS.jump;
    expect(jump.params.heightPower).toBe(200);
    expect(jump.params.horizontalPower).toBe(100);
  });

  it('float has gravityFactor param', () => {
    const float = ABILITY_DEFS.float;
    expect(float.params.gravityFactor).toBe(0.5);
  });

  it('movement is passive, sprint is active, float is passive', () => {
    expect(ABILITY_DEFS.movement.type).toBe(AbilityType.PASSIVE);
    expect(ABILITY_DEFS.sprint.type).toBe(AbilityType.ACTIVE);
    expect(ABILITY_DEFS.float.type).toBe(AbilityType.PASSIVE);
  });

  it('mantle has mantleHeight, mantleSpeed, and mantleReach params', () => {
    const mantle = ABILITY_DEFS.mantle;
    expect(mantle.params.mantleHeight).toBe(16);
    expect(mantle.params.mantleSpeed).toBe(200);
    expect(mantle.params.mantleReach).toBe(1);
  });

  it('mantle is passive with null inputKey', () => {
    expect(ABILITY_DEFS.mantle.type).toBe(AbilityType.PASSIVE);
    expect(ABILITY_DEFS.mantle.inputKey).toBeNull();
  });

  it('DEFAULT_ABILITIES is movement only (DexterityController manages the rest)', () => {
    expect(DEFAULT_ABILITIES).toEqual(['movement']);
  });
});
