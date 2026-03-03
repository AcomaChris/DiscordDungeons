import { describe, it, expect } from 'vitest';
import { checkMantle, updateMantleState } from '../../client/src/physics/MantlePhysics.js';

// Build a flat elevation data array with optional overrides
function makeElevationData(width, height, overrides = {}) {
  const data = new Array(width * height).fill(0);
  for (const [key, val] of Object.entries(overrides)) {
    const [x, y] = key.split(',').map(Number);
    data[y * width + x] = val;
  }
  return data;
}

const BASE = {
  tileWidth: 16,
  tileHeight: 16,
  mapWidth: 10,
  mapHeight: 10,
  elevationStep: 8,
  stepHeight: 8,
  mantleHeight: 16,
  mantleReach: 1,
  z: 0,
  playerX: 88, // tile 5 center
  playerY: 88, // tile 5 center
};

describe('checkMantle', () => {
  it('detects mantleable ledge when facing right', () => {
    const elevationData = makeElevationData(10, 10, { '6,5': 2 });
    const result = checkMantle({ ...BASE, facing: 'right', elevationData });
    expect(result.canMantle).toBe(true);
    expect(result.targetZ).toBe(16);
  });

  it('detects mantleable ledge when facing left', () => {
    const elevationData = makeElevationData(10, 10, { '4,5': 2 });
    const result = checkMantle({ ...BASE, facing: 'left', elevationData });
    expect(result.canMantle).toBe(true);
    expect(result.targetZ).toBe(16);
  });

  it('detects mantleable ledge when facing up', () => {
    const elevationData = makeElevationData(10, 10, { '5,4': 2 });
    const result = checkMantle({ ...BASE, facing: 'up', elevationData });
    expect(result.canMantle).toBe(true);
    expect(result.targetZ).toBe(16);
  });

  it('detects mantleable ledge when facing down', () => {
    const elevationData = makeElevationData(10, 10, { '5,6': 2 });
    const result = checkMantle({ ...BASE, facing: 'down', elevationData });
    expect(result.canMantle).toBe(true);
    expect(result.targetZ).toBe(16);
  });

  it('returns false when elevation is within step-height', () => {
    // elevation 1 = 8px = stepHeight → normal step-up handles it
    const elevationData = makeElevationData(10, 10, { '6,5': 1 });
    const result = checkMantle({ ...BASE, facing: 'right', elevationData });
    expect(result.canMantle).toBe(false);
  });

  it('returns false when elevation exceeds mantle reach', () => {
    // elevation 4 = 32px, stepHeight + mantleHeight = 24px
    const elevationData = makeElevationData(10, 10, { '6,5': 4 });
    const result = checkMantle({ ...BASE, facing: 'right', elevationData });
    expect(result.canMantle).toBe(false);
  });

  it('only checks tiles in the facing direction', () => {
    // Ledge is to the right, but player faces up
    const elevationData = makeElevationData(10, 10, { '6,5': 2 });
    const result = checkMantle({ ...BASE, facing: 'up', elevationData });
    expect(result.canMantle).toBe(false);
  });

  it('works when player is already elevated', () => {
    // Player at z=8 (elev 1), tile ahead at elev 3 (24px)
    // delta = 24 - 8 = 16, > stepHeight(8), <= stepHeight(8) + mantleHeight(16) = 24
    const elevationData = makeElevationData(10, 10, { '6,5': 3 });
    const result = checkMantle({ ...BASE, facing: 'right', z: 8, elevationData });
    expect(result.canMantle).toBe(true);
    expect(result.targetZ).toBe(24);
  });

  it('handles out-of-bounds tiles', () => {
    const elevationData = makeElevationData(10, 10);
    // Player at tile 9, facing right → tile 10 is OOB
    const result = checkMantle({
      ...BASE, playerX: 152, facing: 'right', elevationData,
    });
    expect(result.canMantle).toBe(false);
  });

  it('returns false for invalid facing', () => {
    const elevationData = makeElevationData(10, 10, { '6,5': 2 });
    const result = checkMantle({ ...BASE, facing: 'invalid', elevationData });
    expect(result.canMantle).toBe(false);
  });

  it('respects mantleReach — misses distant ledge with reach 1', () => {
    // Ledge is 2 tiles away at tile 7, reach is 1
    const elevationData = makeElevationData(10, 10, { '7,5': 2 });
    const result = checkMantle({ ...BASE, facing: 'right', mantleReach: 1, elevationData });
    expect(result.canMantle).toBe(false);
  });

  it('respects mantleReach — finds distant ledge with reach 2', () => {
    const elevationData = makeElevationData(10, 10, { '7,5': 2 });
    const result = checkMantle({ ...BASE, facing: 'right', mantleReach: 2, elevationData });
    expect(result.canMantle).toBe(true);
  });

  it('picks the nearest ledge when multiple are in range', () => {
    // Tile 6 = elev 2 (16px), tile 7 = elev 3 (24px)
    const elevationData = makeElevationData(10, 10, { '6,5': 2, '7,5': 3 });
    const result = checkMantle({ ...BASE, facing: 'right', mantleReach: 2, elevationData });
    expect(result.canMantle).toBe(true);
    expect(result.targetZ).toBe(16); // nearest wins
  });

  it('returns false when tile ahead has same elevation', () => {
    const elevationData = makeElevationData(10, 10, { '5,5': 0, '6,5': 0 });
    const result = checkMantle({ ...BASE, facing: 'right', elevationData });
    expect(result.canMantle).toBe(false);
  });
});

describe('updateMantleState', () => {
  const initial = {
    z: 0, startZ: 0, targetZ: 16,
    elapsed: 0, duration: 200, isMantling: true,
  };

  it('starts at startZ', () => {
    expect(initial.z).toBe(0);
    expect(initial.isMantling).toBe(true);
  });

  it('interpolates between startZ and targetZ', () => {
    const mid = updateMantleState(initial, 0.1); // 100ms
    expect(mid.z).toBeGreaterThan(0);
    expect(mid.z).toBeLessThan(16);
    expect(mid.isMantling).toBe(true);
  });

  it('completes at duration and sets isMantling false', () => {
    const final = updateMantleState(initial, 0.2); // 200ms = full duration
    expect(final.z).toBe(16);
    expect(final.isMantling).toBe(false);
  });

  it('clamps at targetZ even if dt overshoots', () => {
    const overshoot = updateMantleState(initial, 1.0);
    expect(overshoot.z).toBe(16);
    expect(overshoot.isMantling).toBe(false);
  });

  it('uses ease-out (>50% progress at 50% time)', () => {
    const mid = updateMantleState(initial, 0.1); // 50% of 200ms
    expect(mid.z).toBeGreaterThan(8); // > 50% of 16
  });

  it('works with non-zero startZ', () => {
    const state = { z: 8, startZ: 8, targetZ: 24, elapsed: 0, duration: 200, isMantling: true };
    const final = updateMantleState(state, 0.2);
    expect(final.z).toBe(24);
    expect(final.isMantling).toBe(false);
  });

  it('accumulates elapsed across multiple calls', () => {
    const step1 = updateMantleState(initial, 0.05); // 50ms
    const step2 = updateMantleState(step1, 0.05);    // 100ms
    const step3 = updateMantleState(step2, 0.05);    // 150ms
    const step4 = updateMantleState(step3, 0.05);    // 200ms

    expect(step1.z).toBeGreaterThan(0);
    expect(step2.z).toBeGreaterThan(step1.z);
    expect(step3.z).toBeGreaterThan(step2.z);
    expect(step4.z).toBe(16);
    expect(step4.isMantling).toBe(false);
  });
});
