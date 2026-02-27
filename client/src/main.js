import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './core/Constants.js';
import authManager from './auth/AuthManager.js';

// --- Game Configuration ---

const config = {
  type: Phaser.AUTO,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene, GameScene],
};

// --- Bootstrap ---
// Check for OAuth redirect callback before starting the game,
// so MainMenuScene sees the authenticated identity on first render.

async function boot() {
  if (!authManager.restore()) {
    await authManager.checkOAuthCallback();
  }
  new Phaser.Game(config);
}

boot();

export { config };
