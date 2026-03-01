import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import authManager from './auth/AuthManager.js';
import { isDiscordActivity, setupDiscordActivity } from './discord/activitySdk.js';
import { BuildStatusIndicator } from './build-status/BuildStatusIndicator.js';
import { BugReporter } from './bug-report/BugReporter.js';
import { PlayerDebugPanel } from './debug/PlayerDebugPanel.js';

new BuildStatusIndicator().mount();
const bugReporter = new BugReporter();
bugReporter.mount();

const debugPanel = new PlayerDebugPanel();
bugReporter.addMenuItem('Player Debug', () => debugPanel.open());

// --- Game Configuration ---

const config = {
  type: Phaser.AUTO,
  pixelArt: true,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  render: {
    // Keeps WebGL buffer after presentation so screenshots capture content
    preserveDrawingBuffer: true,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
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
  const game = new Phaser.Game(config);
  // Expose for e2e tests — Playwright reads this to inspect game state
  globalThis.__PHASER_GAME__ = game;
}

boot();

export { config };
