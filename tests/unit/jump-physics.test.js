import { describe, it, expect } from 'vitest';
import { startJump, updateJumpState } from '../../client/src/physics/JumpPhysics.js';
import { JUMP_VELOCITY_SCALE } from '../../client/src/core/Constants.js';

const GROUND_STATE = { z: 0, vz: 0, groundZ: 0, isJumping: false };

// Simulate a full jump arc at 60fps, returning final state + metadata
function simulateJump(heightPower, gravityFactor = 1.0, groundZ = 0) {
  let state = startJump({ ...GROUND_STATE, groundZ }, heightPower);
  const dt = 1 / 60;
  let maxZ = 0;
  let frames = 0;

  for (let i = 0; i < 600; i++) {
    state = updateJumpState(state, dt, gravityFactor);
    if (state.z > maxZ) maxZ = state.z;
    frames++;
    if (!state.isJumping) break;
  }

  return { state, maxZ, frames };
}

describe('JumpPhysics', () => {
  // --- startJump ---

  it('starts with positive vz proportional to heightPower', () => {
    const state = startJump(GROUND_STATE, 200);
    expect(state.vz).toBe(200 * JUMP_VELOCITY_SCALE);
    expect(state.isJumping).toBe(true);
    expect(state.z).toBe(0);
  });

  it('preserves groundZ from input state', () => {
    const state = startJump({ ...GROUND_STATE, groundZ: 8 }, 200);
    expect(state.groundZ).toBe(8);
  });

  // --- Full arc ---

  it('completes a full arc and lands', () => {
    const { state } = simulateJump(200);
    expect(state.z).toBe(0);
    expect(state.vz).toBe(0);
    expect(state.isJumping).toBe(false);
  });

  it('reaches apex near expected height', () => {
    // Theoretical apex = vz₀² / (2g) = 200² / (2 × 1000) = 20px
    // Discrete 60fps integration undershoots slightly (~18.3px)
    const { maxZ } = simulateJump(200);
    expect(maxZ).toBeGreaterThan(17);
    expect(maxZ).toBeLessThan(21);
  });

  it('higher heightPower produces higher apex', () => {
    const low = simulateJump(100);
    const high = simulateJump(400);
    expect(high.maxZ).toBeGreaterThan(low.maxZ);
  });

  // --- Float ability ---

  it('float ability extends hang time', () => {
    const normal = simulateJump(200, 1.0);
    const floating = simulateJump(200, 0.5);
    expect(floating.frames).toBeGreaterThan(normal.frames);
  });

  it('zero gravity float still lands but much slower', () => {
    // gravityFactor=0 means no further acceleration during descent,
    // but the velocity from the last ascent frame persists so the
    // character drifts down slowly rather than hovering forever.
    const normal = simulateJump(200, 1.0);
    const zeroGrav = simulateJump(200, 0.0);
    expect(zeroGrav.frames).toBeGreaterThan(normal.frames);
  });

  it('float does not change apex height (only affects descent)', () => {
    const normal = simulateJump(200, 1.0);
    const floating = simulateJump(200, 0.5);
    // Same apex because gravity modification only kicks in during descent
    expect(floating.maxZ).toBeCloseTo(normal.maxZ, 0);
  });

  // --- Elevated platforms ---

  it('lands on elevated platform', () => {
    let state = startJump({ ...GROUND_STATE, groundZ: 8 }, 200);
    const dt = 1 / 60;
    for (let i = 0; i < 600; i++) {
      state = updateJumpState(state, dt);
      if (!state.isJumping) break;
    }
    expect(state.z).toBe(8);
    expect(state.isJumping).toBe(false);
  });

  it('falls when groundZ drops mid-flight', () => {
    // Start on a platform (groundZ=8), jump, then mid-flight the ground drops
    let state = startJump({ z: 8, vz: 0, groundZ: 8, isJumping: false }, 200);
    const dt = 1 / 60;

    // Let the player rise for 5 frames
    for (let i = 0; i < 5; i++) {
      state = updateJumpState(state, dt);
    }

    // Ground drops (walked off edge)
    state = { ...state, groundZ: 0 };

    // Continue until landing
    for (let i = 0; i < 600; i++) {
      state = updateJumpState(state, dt);
      if (!state.isJumping) break;
    }

    expect(state.z).toBe(0);
    expect(state.isJumping).toBe(false);
  });

  // --- Edge cases ---

  it('does not go below groundZ', () => {
    let state = startJump(GROUND_STATE, 50);
    const dt = 1 / 60;
    for (let i = 0; i < 600; i++) {
      state = updateJumpState(state, dt);
      expect(state.z).toBeGreaterThanOrEqual(0);
      if (!state.isJumping) break;
    }
  });

  it('gravity factor > 1 makes descent faster', () => {
    const normal = simulateJump(200, 1.0);
    const heavy = simulateJump(200, 2.0);
    expect(heavy.frames).toBeLessThan(normal.frames);
  });
});
