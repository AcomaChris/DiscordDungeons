// --- Jump Physics ---
// Pure functions for Z-axis jump simulation. No Phaser dependency — used by
// Player.js each frame and fully unit-testable in isolation.
//
// The Z-axis is visual height above the ground plane. Phaser's Y-axis gravity
// stays at 0 (top-down movement); this module handles jump arcs manually.

import { JUMP_GRAVITY, JUMP_VELOCITY_SCALE } from '../core/Constants.js';

// --- State shape ---
// { z: number, vz: number, groundZ: number, isJumping: boolean }

export function startJump(state, heightPower) {
  return {
    ...state,
    vz: heightPower * JUMP_VELOCITY_SCALE,
    isJumping: true,
  };
}

// AGENT: gravityFactor defaults to 1.0 (full gravity). Float ability passes
// a value < 1 during descent to slow the fall.
export function updateJumpState(state, dt, gravityFactor = 1.0) {
  let { z, vz, groundZ, isJumping } = state;

  // Apply gravity — only modified during descent (vz < 0)
  const gravity = vz < 0
    ? JUMP_GRAVITY * gravityFactor
    : JUMP_GRAVITY;

  vz -= gravity * dt;
  z += vz * dt;

  // Landing
  if (z <= groundZ) {
    z = groundZ;
    vz = 0;
    isJumping = false;
  }

  return { z, vz, groundZ, isJumping };
}
