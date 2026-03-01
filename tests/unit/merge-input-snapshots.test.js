import { describe, it, expect } from 'vitest';
import { mergeInputSnapshots } from '../../client/src/input/mergeInputSnapshots.js';

describe('mergeInputSnapshots', () => {
  it('returns keyboard moveX when touch is idle', () => {
    const result = mergeInputSnapshots(
      { moveX: -1, moveY: 0, sprint: false, jump: false },
      { moveX: 0, moveY: 0, sprint: false, jump: false },
    );
    expect(result.moveX).toBe(-1);
  });

  it('touch moveX wins when non-zero', () => {
    const result = mergeInputSnapshots(
      { moveX: -1, moveY: 0, sprint: false, jump: false },
      { moveX: 1, moveY: 0, sprint: false, jump: false },
    );
    expect(result.moveX).toBe(1);
  });

  it('returns keyboard moveY when touch is idle', () => {
    const result = mergeInputSnapshots(
      { moveX: 0, moveY: -1, sprint: false, jump: false },
      { moveX: 0, moveY: 0, sprint: false, jump: false },
    );
    expect(result.moveY).toBe(-1);
  });

  it('touch moveY wins when non-zero', () => {
    const result = mergeInputSnapshots(
      { moveX: 0, moveY: -1, sprint: false, jump: false },
      { moveX: 0, moveY: 1, sprint: false, jump: false },
    );
    expect(result.moveY).toBe(1);
  });

  it('both idle produces neutral snapshot', () => {
    const result = mergeInputSnapshots(
      { moveX: 0, moveY: 0, sprint: false, jump: false },
      { moveX: 0, moveY: 0, sprint: false, jump: false },
    );
    expect(result).toEqual({ moveX: 0, moveY: 0, sprint: false, jump: false });
  });

  it('merges axes independently', () => {
    const result = mergeInputSnapshots(
      { moveX: 1, moveY: -1, sprint: false, jump: false },
      { moveX: -1, moveY: 0, sprint: false, jump: false },
    );
    expect(result).toEqual({ moveX: -1, moveY: -1, sprint: false, jump: false });
  });

  it('keyboard sprint propagates to result', () => {
    const result = mergeInputSnapshots(
      { moveX: 0, moveY: 0, sprint: true, jump: false },
      { moveX: 0, moveY: 0, sprint: false, jump: false },
    );
    expect(result.sprint).toBe(true);
  });

  it('touch sprint propagates to result', () => {
    const result = mergeInputSnapshots(
      { moveX: 0, moveY: 0, sprint: false, jump: false },
      { moveX: 0, moveY: 0, sprint: true, jump: false },
    );
    expect(result.sprint).toBe(true);
  });
});
