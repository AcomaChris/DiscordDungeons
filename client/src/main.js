import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from './core/Constants.js';
import authManager from './auth/AuthManager.js';
import { isDiscordActivity, setupDiscordActivity } from './discord/activitySdk.js';

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
// In Activity mode: SDK handles auth before Phaser starts.
// In web mode: restore session or handle OAuth redirect callback.

async function boot() {
  if (isDiscordActivity) {
    const result = await setupDiscordActivity();
    if (result) {
      authManager.setDiscordActivityIdentity(result.user);
      authManager.activityChannelId = result.channelId;
    }
  } else {
    if (!authManager.restore()) {
      await authManager.checkOAuthCallback();
    }
  }
  new Phaser.Game(config);
}

boot();

export { config };
