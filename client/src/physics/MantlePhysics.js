// --- Mantle Physics ---
// Pure functions for mantle detection and Z-interpolation. No Phaser
// dependency — used by Player.js and fully unit-testable in isolation.
//
// Mantling lets the player climb ledges too high for step-height by
// jumping near them. Detection runs during the jump's ascending phase;
// interpolation smoothly raises z to the target elevation.

const FACING_OFFSETS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

/**
 * Check if a mantle is possible given current state and tile elevation.
 *
 * @param {object} p
 * @param {number} p.playerX      - world X (sprite center)
 * @param {number} p.playerY      - ground-plane Y (_groundY)
 * @param {string} p.facing       - 'up'|'down'|'left'|'right'
 * @param {number} p.z            - current height above ground (px)
 * @param {number} p.stepHeight   - current step-height param (px)
 * @param {number} p.mantleHeight - max climbable delta above stepHeight (px)
 * @param {number} p.mantleReach  - tiles ahead to scan
 * @param {number} p.tileWidth
 * @param {number} p.tileHeight
 * @param {number} p.mapWidth     - map width in tiles
 * @param {number} p.mapHeight    - map height in tiles
 * @param {number[]} p.elevationData - flat array [y*mapWidth+x] of elevation levels
 * @param {number} p.elevationStep  - px per elevation level
 * @returns {{ canMantle: boolean, targetZ: number }}
 */
export function checkMantle(p) {
  const offset = FACING_OFFSETS[p.facing];
  if (!offset) return { canMantle: false, targetZ: 0 };

  const baseTX = Math.floor(p.playerX / p.tileWidth);
  const baseTY = Math.floor(p.playerY / p.tileHeight);

  for (let i = 1; i <= p.mantleReach; i++) {
    const tx = baseTX + offset.dx * i;
    const ty = baseTY + offset.dy * i;

    if (tx < 0 || tx >= p.mapWidth || ty < 0 || ty >= p.mapHeight) continue;

    const tileElevPx = (p.elevationData[ty * p.mapWidth + tx] || 0) * p.elevationStep;
    const delta = tileElevPx - p.z;

    // Above step-height (can't walk up) but within mantle reach
    if (delta > p.stepHeight && delta <= p.stepHeight + p.mantleHeight) {
      return { canMantle: true, targetZ: tileElevPx };
    }
  }

  return { canMantle: false, targetZ: 0 };
}

/**
 * Advance mantle interpolation (ease-out quadratic).
 *
 * @param {object} state - { z, startZ, targetZ, elapsed, duration, isMantling }
 * @param {number} dt    - frame delta in seconds
 * @returns {object}       updated state
 */
export function updateMantleState(state, dt) {
  let { z, startZ, targetZ, elapsed, duration, isMantling } = state;

  elapsed += dt * 1000;
  const t = Math.min(elapsed / duration, 1);

  // Ease-out: fast start, smooth deceleration at top
  const eased = 1 - (1 - t) * (1 - t);
  z = startZ + (targetZ - startZ) * eased;

  if (t >= 1) {
    z = targetZ;
    isMantling = false;
  }

  return { z, startZ, targetZ, elapsed, duration, isMantling };
}
