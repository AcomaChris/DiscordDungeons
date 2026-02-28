import Phaser from 'phaser';
import {
  CHAR_WIDTH,
  CHAR_HEIGHT,
  CHAR_RADIUS,
  EYE_RADIUS,
  EYE_OFFSET_X,
  PLAYER_COLORS,
  TEXTURE_SCALE,
} from '../core/Constants.js';

// --- BootScene ---
// Generates all shared textures once, then transitions to MainMenu.
// AGENT: All textures must be created here — other scenes only reference them.
// Each color gets 4 directional textures: -right, -left, -down, -up.

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    PLAYER_COLORS.forEach((color, i) => {
      this._createPlayerTextures(color, `player-${i}`);
    });

    this.scene.start('MainMenuScene');
  }

  _createPlayerTextures(color, prefix) {
    const s = TEXTURE_SCALE;
    const w = CHAR_WIDTH * s;
    const h = CHAR_HEIGHT * s;
    const r = CHAR_RADIUS * s;
    const eyeR = EYE_RADIUS * s;
    const eyeY = (CHAR_RADIUS + 4) * s;
    const gfx = this.add.graphics();

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
}
