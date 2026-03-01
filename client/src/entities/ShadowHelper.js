// --- Shadow Helper ---
// Shared shadow ellipse logic for Player and RemotePlayer. The shadow sits
// at the character's ground position and fades/shrinks as they rise.

import { CHAR_WIDTH, CHAR_HEIGHT } from '../core/Constants.js';

const MAX_ALPHA = 0.3;
const MIN_ALPHA = 0.1;
const MAX_Z = 40; // z at which shadow reaches minimum alpha/scale

export function createShadow(scene, x, y) {
  return scene.add.ellipse(
    x, y + CHAR_HEIGHT / 2 - 2,
    CHAR_WIDTH * 0.8, 4, 0x000000, MAX_ALPHA,
  ).setVisible(false);
}

export function updateShadow(shadow, spriteX, groundY, z, groundZ, spriteDepth) {
  const shadowY = groundY + CHAR_HEIGHT / 2 - 2;
  shadow.setPosition(spriteX, shadowY);

  const heightAboveGround = z - groundZ;
  const t = Math.min(Math.max(heightAboveGround, 0) / MAX_Z, 1);
  shadow.setAlpha(MAX_ALPHA - t * (MAX_ALPHA - MIN_ALPHA));
  shadow.setScale(1 - t * 0.4, 1 - t * 0.5);
  shadow.setDepth(spriteDepth - 1);
  shadow.setVisible(heightAboveGround > 0.5);
}
