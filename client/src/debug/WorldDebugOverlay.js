// --- World Debug Overlay ---
// Floating panel toggled from the cog menu. Contains checkboxes for
// individual debug views. Currently supports "Show Height Data" which
// renders elevation values as color-coded Phaser text objects on each
// elevated tile (labels scroll/zoom with the map).

import { ELEVATION_STEP, DEPTH_ABOVE_PLAYER } from '../core/Constants.js';

const DEBUG_TEXT_DEPTH = DEPTH_ABOVE_PLAYER + 100;

// --- Color gradient: grey (lowest) → green → orange → red (highest) ---
const COLOR_STOPS = [
  { t: 0.00, r: 128, g: 128, b: 128 },  // grey
  { t: 0.33, r:   0, g: 200, b:  68 },  // green
  { t: 0.67, r: 255, g: 153, b:   0 },  // orange
  { t: 1.00, r: 255, g:  34, b:   0 },  // red
];

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// Returns a CSS hex color for a value in [0, 1].
function elevationColor(normalizedValue) {
  const v = Math.max(0, Math.min(1, normalizedValue));
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (v <= COLOR_STOPS[i + 1].t) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }
  const span = hi.t - lo.t;
  const t = span === 0 ? 0 : (v - lo.t) / span;
  const r = lerpChannel(lo.r, hi.r, t);
  const g = lerpChannel(lo.g, hi.g, t);
  const b = lerpChannel(lo.b, hi.b, t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export class WorldDebugOverlay {
  constructor() {
    this._active = false;
    this._heightEnabled = false;
    this._textObjects = [];
    this._panel = null;
    this._checkbox = null;
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
    this._active = true;
    this._mountPanel();
  }

  hide() {
    if (!this._active) return;
    this._active = false;
    this._unmountPanel();
    this._destroyLabels();
    const scene = this._getScene();
    if (scene && this._onShutdown) {
      scene.events.off('shutdown', this._onShutdown);
      this._onShutdown = null;
    }
  }

  destroy() {
    this.hide();
  }

  // --- Panel ---

  _mountPanel() {
    if (this._panel) return;

    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.80);
      color: #e0e0e0;
      padding: 8px 12px 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      z-index: 9999;
      user-select: none;
      min-width: 160px;
      line-height: 1.4;
    `;

    const title = document.createElement('div');
    title.textContent = 'World Debug';
    title.style.cssText = 'font-weight: bold; margin-bottom: 8px; color: #ffffff; border-bottom: 1px solid #444; padding-bottom: 4px;';
    panel.appendChild(title);

    // --- Height Debug section (collapsible via native <details>) ---
    const details = document.createElement('details');
    details.style.cssText = 'margin-top: 4px;';

    const summary = document.createElement('summary');
    summary.textContent = 'Height Debug';
    summary.style.cssText = 'cursor: pointer; color: #cccccc; padding: 2px 0;';
    details.appendChild(summary);

    const checkboxRow = document.createElement('div');
    checkboxRow.style.cssText = 'padding: 4px 0 0 14px;';

    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this._heightEnabled;
    checkbox.style.cursor = 'pointer';
    checkbox.addEventListener('change', () => this._onHeightToggle(checkbox.checked));

    const labelText = document.createElement('span');
    labelText.textContent = 'Show Height Data';

    label.appendChild(checkbox);
    label.appendChild(labelText);
    checkboxRow.appendChild(label);
    details.appendChild(checkboxRow);
    panel.appendChild(details);

    this._panel = panel;
    this._checkbox = checkbox;
    document.body.appendChild(panel);
  }

  _unmountPanel() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
      this._checkbox = null;
    }
  }

  _onHeightToggle(enabled) {
    this._heightEnabled = enabled;
    const scene = this._getScene();

    if (enabled && scene) {
      this._createLabels(scene);
      // Destroy labels when the scene restarts; user can re-check to rebuild
      if (!this._onShutdown) {
        this._onShutdown = () => {
          this._destroyLabels();
          this._onShutdown = null;
        };
        scene.events.once('shutdown', this._onShutdown);
      }
    } else {
      this._destroyLabels();
      if (scene && this._onShutdown) {
        scene.events.off('shutdown', this._onShutdown);
        this._onShutdown = null;
      }
    }
  }

  // --- Labels ---

  _getScene() {
    const game = globalThis.__PHASER_GAME__;
    return game?.scene?.getScene('GameScene');
  }

  _createLabels(scene) {
    this._destroyLabels();

    const tm = scene.tileMapManager;
    if (!tm.elevationData || !tm.tilemap) return;

    const map = tm.tilemap;
    const tw = map.tileWidth;
    const th = map.tileHeight;
    const mapW = map.width;
    const mapH = map.height;

    // Normalize color range against the actual min/max levels in this map
    const nonZero = tm.elevationData.filter(v => v > 0);
    if (nonZero.length === 0) return;
    const minLevel = Math.min(...nonZero);
    const maxLevel = Math.max(...nonZero);
    const range = maxLevel - minLevel || 1;  // avoid divide-by-zero when all same level

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const level = tm.elevationData[y * mapW + x];
        if (level <= 0) continue;

        const heightPx = level * ELEVATION_STEP;
        const normalized = (level - minLevel) / range;
        const color = elevationColor(normalized);

        const worldX = x * tw + tw / 2;
        const worldY = y * th + th / 2;

        const text = scene.add.text(worldX, worldY, `${heightPx}`, {
          fontSize: '7px',
          fontFamily: 'monospace',
          color,
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
