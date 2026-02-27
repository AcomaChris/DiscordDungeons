import Phaser from 'phaser';
import {
  CHAR_WIDTH,
  CHAR_HEIGHT,
  CHAR_RADIUS,
  EYE_RADIUS,
  EYE_OFFSET_X,
  FLOOR_HEIGHT,
  PLAYER_COLORS,
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
    // AGENT: Use a wide texture so it covers any screen width after resize
    const maxWidth = 4096;
    const gfx = this.add.graphics();
    gfx.fillStyle(0x4a4a4a, 1);
    gfx.fillRect(0, 0, maxWidth, FLOOR_HEIGHT);
    gfx.generateTexture('floor', maxWidth, FLOOR_HEIGHT);
    gfx.destroy();
  }

  _createPlayerTextures(color, prefix) {
    const gfx = this.add.graphics();

    // Right-facing
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(0, 0, CHAR_WIDTH, CHAR_HEIGHT, CHAR_RADIUS);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(CHAR_WIDTH / 2 + EYE_OFFSET_X, CHAR_RADIUS + 4, EYE_RADIUS);
    gfx.generateTexture(`${prefix}-right`, CHAR_WIDTH, CHAR_HEIGHT);

    // Left-facing
    gfx.clear();
    gfx.fillStyle(color, 1);
    gfx.fillRoundedRect(0, 0, CHAR_WIDTH, CHAR_HEIGHT, CHAR_RADIUS);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(CHAR_WIDTH / 2 - EYE_OFFSET_X, CHAR_RADIUS + 4, EYE_RADIUS);
    gfx.generateTexture(`${prefix}-left`, CHAR_WIDTH, CHAR_HEIGHT);

    gfx.destroy();
  }
}
