import {
  CHAR_WIDTH,
  CHAR_HEIGHT,
  CHAR_RADIUS,
  EYE_RADIUS,
  EYE_OFFSET_X,
  TEXTURE_SCALE,
} from '../core/Constants.js';

// --- Player Texture Generator ---
// Creates 4 directional textures (right, left, down, up) for a player color.
// Extracted from BootScene so textures can be regenerated at runtime (e.g. debug panel).
// AGENT: Destroys existing textures with the same prefix before regenerating.

export function generatePlayerTextures(scene, color, prefix) {
  const s = TEXTURE_SCALE;
  const w = CHAR_WIDTH * s;
  const h = CHAR_HEIGHT * s;
  const r = CHAR_RADIUS * s;
  const eyeR = EYE_RADIUS * s;
  const eyeY = (CHAR_RADIUS + 4) * s;

  // Remove old textures if they exist (for runtime regeneration)
  for (const dir of ['right', 'left', 'down', 'up']) {
    const key = `${prefix}-${dir}`;
    if (scene.textures.exists(key)) {
      scene.textures.remove(key);
    }
  }

  const gfx = scene.add.graphics();

  // --- Right-facing ---
  gfx.fillStyle(color, 1);
  gfx.fillRoundedRect(0, 0, w, h, r);
  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle((CHAR_WIDTH / 2 + EYE_OFFSET_X) * s, eyeY, eyeR);
  gfx.generateTexture(`${prefix}-right`, w, h);

  // --- Left-facing ---
  gfx.clear();
  gfx.fillStyle(color, 1);
  gfx.fillRoundedRect(0, 0, w, h, r);
  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle((CHAR_WIDTH / 2 - EYE_OFFSET_X) * s, eyeY, eyeR);
  gfx.generateTexture(`${prefix}-left`, w, h);

  // --- Down-facing (centered eye — looking toward camera) ---
  gfx.clear();
  gfx.fillStyle(color, 1);
  gfx.fillRoundedRect(0, 0, w, h, r);
  gfx.fillStyle(0xffffff, 1);
  gfx.fillCircle((CHAR_WIDTH / 2) * s, eyeY, eyeR);
  gfx.generateTexture(`${prefix}-down`, w, h);

  // --- Up-facing (no eye — back of head) ---
  gfx.clear();
  gfx.fillStyle(color, 1);
  gfx.fillRoundedRect(0, 0, w, h, r);
  gfx.generateTexture(`${prefix}-up`, w, h);

  gfx.destroy();
}
