// --- World Debug Overlay ---
// Renders elevation values as Phaser text objects on each tile with elevation > 0.
// Toggled from the cog menu. Uses game objects so labels scroll/zoom with the map.

import { ELEVATION_STEP, DEPTH_ABOVE_PLAYER } from '../core/Constants.js';

const DEBUG_TEXT_DEPTH = DEPTH_ABOVE_PLAYER + 100;

export class WorldDebugOverlay {
  constructor() {
    this._active = false;
    this._textObjects = [];
    this._onShutdown = null;
  }

  get active() {
    return this._active;
  }

  toggle() {
    if (this._active) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    if (this._active) return;

    const scene = this._getScene();
    if (!scene?.tileMapManager) return;

    this._active = true;
    this._createLabels(scene);

    // Clean up if scene restarts while overlay is active
    this._onShutdown = () => this.hide();
    scene.events.once('shutdown', this._onShutdown);
  }

  hide() {
    if (!this._active) return;
    this._active = false;

    const scene = this._getScene();
    if (scene && this._onShutdown) {
      scene.events.off('shutdown', this._onShutdown);
    }
    this._onShutdown = null;

    this._destroyLabels();
  }

  destroy() {
    this.hide();
  }

  _getScene() {
    const game = globalThis.__PHASER_GAME__;
    return game?.scene?.getScene('GameScene');
  }

  _createLabels(scene) {
    const tm = scene.tileMapManager;
    if (!tm.elevationData || !tm.tilemap) return;

    const map = tm.tilemap;
    const tw = map.tileWidth;
    const th = map.tileHeight;
    const mapW = map.width;
    const mapH = map.height;

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const level = tm.elevationData[y * mapW + x];
        if (level <= 0) continue;

        const heightPx = level * ELEVATION_STEP;
        const worldX = x * tw + tw / 2;
        const worldY = y * th + th / 2;

        const text = scene.add.text(worldX, worldY, `${heightPx}`, {
          fontSize: '7px',
          fontFamily: 'monospace',
          color: '#00ffff',
          stroke: '#000000',
          strokeThickness: 2,
          align: 'center',
        });
        text.setOrigin(0.5, 0.5);
        text.setDepth(DEBUG_TEXT_DEPTH);

        this._textObjects.push(text);
      }
    }
  }

  _destroyLabels() {
    for (const t of this._textObjects) {
      t.destroy();
    }
    this._textObjects = [];
  }
}
