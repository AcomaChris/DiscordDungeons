import Phaser from 'phaser';
import {
  CHAR_WIDTH,
  CHAR_HEIGHT,
  CHAR_RADIUS,
  EYE_RADIUS,
  EYE_OFFSET_X,
  FLOOR_HEIGHT,
  WORLD_WIDTH,
  PLAYER_COLORS,
  TEXTURE_SCALE,
} from '../core/Constants.js';

// --- BootScene ---
// Generates all shared textures once, then transitions to MainMenu.
// AGENT: All textures must be created here — other scenes only reference them.

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    this._createFloorTexture();
    PLAYER_COLORS.forEach((color, i) => {
      this._createPlayerTextures(color, `player-${i}`);
    });

    this.scene.start('MainMenuScene');
  }

  _createFloorTexture() {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x4a4a4a, 1);
    gfx.fillRect(0, 0, WORLD_WIDTH, FLOOR_HEIGHT);
    gfx.generateTexture('floor', WORLD_WIDTH, FLOOR_HEIGHT);
    gfx.destroy();
  }

  _createPlayerTextures(color, prefix) {
    const s = TEXTURE_SCALE;
    const gfx = this.add.graphics();

    // Right-facing
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(0, 0, CHAR_WIDTH * s, CHAR_HEIGHT * s, CHAR_RADIUS * s);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle((CHAR_WIDTH / 2 + EYE_OFFSET_X) * s, (CHAR_RADIUS + 4) * s, EYE_RADIUS * s);
    gfx.generateTexture(`${prefix}-right`, CHAR_WIDTH * s, CHAR_HEIGHT * s);

    // Left-facing
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(0, 0, CHAR_WIDTH * s, CHAR_HEIGHT * s, CHAR_RADIUS * s);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle((CHAR_WIDTH / 2 - EYE_OFFSET_X) * s, (CHAR_RADIUS + 4) * s, EYE_RADIUS * s);
    gfx.generateTexture(`${prefix}-left`, CHAR_WIDTH * s, CHAR_HEIGHT * s);

    gfx.destroy();
  }
}
