import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import authManager from './auth/AuthManager.js';
import { isDiscordActivity, setupDiscordActivity } from './discord/activitySdk.js';
import { BuildStatusIndicator } from './build-status/BuildStatusIndicator.js';
import { BugReporter } from './bug-report/BugReporter.js';
import { PlayerDebugPanel } from './debug/PlayerDebugPanel.js';
import { WorldDebugOverlay } from './debug/WorldDebugOverlay.js';
import { BehaviorEnginePanel } from './behavior-engine/BehaviorEnginePanel.js';
import { StateDisplayPanel } from './debug/StateDisplayPanel.js';
import { BRAND_TITLE } from './core/BrandConfig.js';
import { installConsoleCapture } from './bug-report/ConsoleCapture.js';
import { PlayerMenuButton } from './hud/PlayerMenuButton.js';
import inventoryManager from './inventory/InventoryManager.js';

// @doc-dev 03:URL Params > Available Parameters
// The game client supports the following URL parameters for development and testing:
// - `?map=X` -- load a specific map by ID (e.g., `?map=test`, `?map=tavern`).
//   Defaults to `test` if omitted. See **Map Selection** below.
// - `?touch=1` -- force touch/D-pad controls on desktop browsers, useful for
//   testing the mobile UI without a touch device.

installConsoleCapture();
document.title = BRAND_TITLE;

new BuildStatusIndicator().mount();
const bugReporter = new BugReporter();
bugReporter.mount();

const debugPanel = new PlayerDebugPanel();
bugReporter.addMenuItem('Player Debug', () => debugPanel.open());

bugReporter.addMenuItem('Tile Editor', () => window.open('/editor.html', '_blank'));
bugReporter.addMenuItem('Map Editor', () => window.open('/map-editor.html', '_blank'));

const worldDebug = new WorldDebugOverlay();
const worldDebugBtn = bugReporter.addMenuItem('World Debug', () => {
  worldDebug.toggle();
  worldDebugBtn.textContent = worldDebug.active ? 'World Debug \u2713' : 'World Debug';
});

const statePanel = new StateDisplayPanel();
const statePanelBtn = bugReporter.addMenuItem('Show State', () => {
  statePanel.toggle();
  statePanelBtn.textContent = statePanel.active ? 'Show State \u2713' : 'Show State';
});

const behaviorPanel = new BehaviorEnginePanel();
bugReporter.addMenuItem('Behavior Engine', () => behaviorPanel.open());

const playerMenu = new PlayerMenuButton();
playerMenu.mount();

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
      authManager.setDiscordActivityIdentity(result.user, result.sessionToken);
      authManager.activityChannelId = result.channelId;
    }
  } else {
    // OAuth ?code= takes priority over stored session (e.g. guest switching to Discord login)
    const hadOAuth = await authManager.checkOAuthCallback();
    if (!hadOAuth) {
      authManager.restore();
    }
  }
  // Load inventory from server after auth (fire-and-forget — game can start without it)
  inventoryManager.loadFromServer();

  const game = new Phaser.Game(config);
  // Expose for e2e tests — Playwright reads this to inspect game state
  globalThis.__PHASER_GAME__ = game;
}

boot();

export { config };
