import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import authManager from './auth/AuthManager.js';
import { isDiscordActivity, setupDiscordActivity } from './discord/activitySdk.js';
import { BuildStatusIndicator } from './build-status/BuildStatusIndicator.js';

new BuildStatusIndicator().mount();

// --- Game Configuration ---

const config = {
  type: Phaser.AUTO,
  pixelArt: true,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
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

// --- HiDPI / Physical-pixel rendering ---
// Phaser's Scale.RESIZE sets canvas.width to CSS pixels only. On HiDPI screens
// (e.g. DPR=2 at 150% Windows scaling) this causes the browser to upscale the
// canvas → blurry. Fix: resize the renderer to physical pixels and let the CSS
// style keep the canvas at viewport size. Camera zoom is adjusted separately
// (in GameScene) so character visual size in CSS pixels stays constant.

function applyDPR(game) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = game.scale.width;
  const cssH = game.scale.height;
  const physW = Math.floor(cssW * dpr);
  const physH = Math.floor(cssH * dpr);
  game.renderer.resize(physW, physH);
  // AGENT: renderer.resize does NOT update scene cameras in Phaser 3.
  // Without this, the camera renders into only a portion of the canvas on HiDPI.
  game.scene.scenes.forEach((s) => {
    if (s.cameras) s.cameras.resize(physW, physH);
  });
  game.canvas.style.width = cssW + 'px';
  game.canvas.style.height = cssH + 'px';
}

// Re-registers itself each time DPR changes so moving between monitors is handled.
function watchDPR(game) {
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq.addEventListener('change', () => { applyDPR(game); watchDPR(game); }, { once: true });
}

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
  game.events.once('ready', () => {
    applyDPR(game);
    game.scale.on('resize', () => applyDPR(game));
    watchDPR(game);
  });
}

boot();

export { config };
