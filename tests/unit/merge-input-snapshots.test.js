import { describe, it, expect } from 'vitest';
import { mergeInputSnapshots } from '../../client/src/input/mergeInputSnapshots.js';

describe('mergeInputSnapshots', () => {
  it('returns keyboard moveX when touch is idle', () => {
    const result = mergeInputSnapshots({ moveX: -1, jump: false }, { moveX: 0, jump: false });
    expect(result.moveX).toBe(-1);
  });

  it('touch moveX wins when non-zero', () => {
    const result = mergeInputSnapshots({ moveX: -1, jump: false }, { moveX: 1, jump: false });
    expect(result.moveX).toBe(1);
  });

  it('ORs jump from both sources', () => {
    expect(mergeInputSnapshots({ moveX: 0, jump: true }, { moveX: 0, jump: false }).jump).toBe(true);
    expect(mergeInputSnapshots({ moveX: 0, jump: false }, { moveX: 0, jump: true }).jump).toBe(true);
    expect(mergeInputSnapshots({ moveX: 0, jump: false }, { moveX: 0, jump: false }).jump).toBe(false);
  });

  it('both idle produces neutral snapshot', () => {
    const result = mergeInputSnapshots({ moveX: 0, jump: false }, { moveX: 0, jump: false });
    expect(result).toEqual({ moveX: 0, jump: false });
  });
});
