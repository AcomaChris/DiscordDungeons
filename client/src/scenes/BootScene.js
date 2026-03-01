import Phaser from 'phaser';
import { PLAYER_COLORS } from '../core/Constants.js';
import { generatePlayerTextures } from '../entities/PlayerTextureGenerator.js';

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
      generatePlayerTextures(this, color, `player-${i}`);
    });

    this.scene.start('MainMenuScene');
  }
}
