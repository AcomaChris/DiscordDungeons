import { describe, it, expect } from 'vitest';
import { resolveParam, ModifierOp } from '../../client/src/abilities/ModifierStack.js';

describe('resolveParam', () => {
  it('returns base value when no modifiers', () => {
    expect(resolveParam(80, [], 'walkSpeed')).toBe(80);
  });

  it('applies additive modifier', () => {
    const mods = [{ id: 'boots', param: 'walkSpeed', op: ModifierOp.ADD, value: 20 }];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(100);
  });

  it('applies multiplicative modifier', () => {
    const mods = [{ id: 'potion', param: 'walkSpeed', op: ModifierOp.MUL, value: 1.5 }];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(120);
  });

  it('applies add then mul in correct order', () => {
    const mods = [
      { id: 'boots', param: 'walkSpeed', op: ModifierOp.ADD, value: 20 },
      { id: 'potion', param: 'walkSpeed', op: ModifierOp.MUL, value: 1.5 },
    ];
    // (80 + 20) * 1.5 = 150
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(150);
  });

  it('stacks multiple additive modifiers', () => {
    const mods = [
      { id: 'boots', param: 'walkSpeed', op: ModifierOp.ADD, value: 10 },
      { id: 'ring', param: 'walkSpeed', op: ModifierOp.ADD, value: 15 },
    ];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(105);
  });

  it('stacks multiple multiplicative modifiers', () => {
    const mods = [
      { id: 'potion', param: 'walkSpeed', op: ModifierOp.MUL, value: 1.5 },
      { id: 'aura', param: 'walkSpeed', op: ModifierOp.MUL, value: 2 },
    ];
    // 80 * 1.5 * 2 = 240
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(240);
  });

  it('ignores modifiers for other params', () => {
    const mods = [
      { id: 'boots', param: 'sprintSpeed', op: ModifierOp.ADD, value: 50 },
    ];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(80);
  });

  it('handles zero additive modifier', () => {
    const mods = [{ id: 'noop', param: 'walkSpeed', op: ModifierOp.ADD, value: 0 }];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(80);
  });

  it('handles 1.0 multiplicative modifier (no-op)', () => {
    const mods = [{ id: 'noop', param: 'walkSpeed', op: ModifierOp.MUL, value: 1 }];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(80);
  });

  it('handles negative additive modifier (debuff)', () => {
    const mods = [{ id: 'slow', param: 'walkSpeed', op: ModifierOp.ADD, value: -30 }];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(50);
  });

  it('handles multiplicative < 1 (slow debuff)', () => {
    const mods = [{ id: 'slow', param: 'walkSpeed', op: ModifierOp.MUL, value: 0.5 }];
    expect(resolveParam(80, mods, 'walkSpeed')).toBe(40);
  });
});
