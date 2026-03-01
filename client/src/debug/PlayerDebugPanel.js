import './player-debug.css';
import { acquireInputFocus, releaseInputFocus } from '../core/InputContext.js';
import { CHAR_HEIGHT, TEXTURE_SCALE } from '../core/Constants.js';

// --- Player Debug Panel ---
// Live-tweaking panel for player collision, color, and name.
// Accessed via the cog menu. Changes replicate to all connected players.

export class PlayerDebugPanel {
  constructor() {
    this._backdrop = null;
    this._dialog = null;
    this._rafId = null;
  }

  open() {
    if (this._backdrop) return;

    const game = globalThis.__PHASER_GAME__;
    if (!game) return;

    const scene = game.scene.getScene('GameScene');
    if (!scene || !scene.player) return;

    this._scene = scene;
    this._player = scene.player;

    this._createDialog();
    acquireInputFocus();
    this._startPositionUpdates();
  }

  close() {
    this._stopPositionUpdates();
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
      this._dialog = null;
      releaseInputFocus();
    }
    this._scene = null;
    this._player = null;
  }

  // --- Dialog ---

  _createDialog() {
    this._backdrop = document.createElement('div');
    this._backdrop.className = 'player-debug-backdrop';
    this._backdrop.addEventListener('click', (e) => {
      if (e.target === this._backdrop) this.close();
    });

    const player = this._player;

    // Read current collision body dimensions (in world pixels)
    // AGENT: body.width/height are the final scaled values
    const bodyW = Math.round(player.sprite.body.width);
    const bodyH = Math.round(player.sprite.body.height);

    // Extract current RGB from hex color
    const color = player.color || 0xff6600;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    this._dialog = document.createElement('div');
    this._dialog.className = 'player-debug-dialog';
    this._dialog.innerHTML = `
      <h2 class="player-debug-title">Player Debug</h2>

      <div class="player-debug-section">Collision Body</div>
      <div class="player-debug-row">
        <span class="player-debug-label">Width / Height (world px)</span>
        <div class="player-debug-inline">
          <input type="number" class="player-debug-input player-debug-input-small" data-field="bodyW" value="${bodyW}" min="1" max="64" />
          <input type="number" class="player-debug-input player-debug-input-small" data-field="bodyH" value="${bodyH}" min="1" max="64" />
        </div>
      </div>

      <div class="player-debug-section">Character Color</div>
      <div class="player-debug-row">
        <span class="player-debug-label">R / G / B</span>
        <div class="player-debug-inline">
          <input type="number" class="player-debug-input player-debug-input-small" data-field="colorR" value="${r}" min="0" max="255" />
          <input type="number" class="player-debug-input player-debug-input-small" data-field="colorG" value="${g}" min="0" max="255" />
          <input type="number" class="player-debug-input player-debug-input-small" data-field="colorB" value="${b}" min="0" max="255" />
          <input type="color" class="player-debug-swatch" data-field="colorPicker" value="${this._rgbToHex(r, g, b)}" />
        </div>
      </div>

      <div class="player-debug-section">Identity</div>
      <div class="player-debug-row">
        <span class="player-debug-label">Name</span>
        <input type="text" class="player-debug-input" data-field="name" value="${this._escapeHtml(player.nameLabel?.text || 'Player')}" maxlength="20" />
      </div>

      <div class="player-debug-section">Position (read-only)</div>
      <div class="player-debug-row">
        <div class="player-debug-inline">
          <span class="player-debug-label">X</span>
          <input type="text" class="player-debug-input player-debug-input-small" data-field="posX" value="${Math.round(player.sprite.x)}" readonly />
          <span class="player-debug-label">Y</span>
          <input type="text" class="player-debug-input player-debug-input-small" data-field="posY" value="${Math.round(player.sprite.y)}" readonly />
        </div>
      </div>

      <div class="player-debug-actions">
        <button class="player-debug-btn" data-action="close">Close</button>
      </div>
    `;

    // --- Wire up event listeners ---

    // Collision body
    const bodyWInput = this._dialog.querySelector('[data-field="bodyW"]');
    const bodyHInput = this._dialog.querySelector('[data-field="bodyH"]');
    bodyWInput.addEventListener('input', () => this._updateCollisionBody());
    bodyHInput.addEventListener('input', () => this._updateCollisionBody());

    // Color
    const colorR = this._dialog.querySelector('[data-field="colorR"]');
    const colorG = this._dialog.querySelector('[data-field="colorG"]');
    const colorB = this._dialog.querySelector('[data-field="colorB"]');
    colorR.addEventListener('input', () => this._updateColor());
    colorG.addEventListener('input', () => this._updateColor());
    colorB.addEventListener('input', () => this._updateColor());

    // Color picker — syncs back to R/G/B inputs
    const colorPicker = this._dialog.querySelector('[data-field="colorPicker"]');
    colorPicker.addEventListener('input', () => this._onPickerChange());

    // Name
    const nameInput = this._dialog.querySelector('[data-field="name"]');
    nameInput.addEventListener('change', () => this._updateName());

    // Close
    this._dialog.querySelector('[data-action="close"]')
      .addEventListener('click', () => this.close());

    this._backdrop.appendChild(this._dialog);
    document.body.appendChild(this._backdrop);
  }

  // --- Live Updates ---

  _updateCollisionBody() {
    const w = parseInt(this._dialog.querySelector('[data-field="bodyW"]').value, 10);
    const h = parseInt(this._dialog.querySelector('[data-field="bodyH"]').value, 10);
    if (!w || !h || w < 1 || h < 1) return;

    // AGENT: setSize() works in unscaled texture space — multiply by TEXTURE_SCALE
    const scaledW = w * TEXTURE_SCALE;
    const scaledH = h * TEXTURE_SCALE;
    this._player.sprite.body.setSize(scaledW, scaledH);
    this._player.sprite.body.setOffset(0, CHAR_HEIGHT * TEXTURE_SCALE - scaledH);
  }

  _updateColor() {
    const r = this._clamp(parseInt(this._dialog.querySelector('[data-field="colorR"]').value, 10) || 0);
    const g = this._clamp(parseInt(this._dialog.querySelector('[data-field="colorG"]').value, 10) || 0);
    const b = this._clamp(parseInt(this._dialog.querySelector('[data-field="colorB"]').value, 10) || 0);

    const hexColor = (r << 16) | (g << 8) | b;

    // Sync color picker
    const picker = this._dialog.querySelector('[data-field="colorPicker"]');
    picker.value = this._rgbToHex(r, g, b);

    this._player.setColor(hexColor);
  }

  _onPickerChange() {
    const hex = this._dialog.querySelector('[data-field="colorPicker"]').value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Sync R/G/B inputs
    this._dialog.querySelector('[data-field="colorR"]').value = r;
    this._dialog.querySelector('[data-field="colorG"]').value = g;
    this._dialog.querySelector('[data-field="colorB"]').value = b;

    this._player.setColor((r << 16) | (g << 8) | b);
  }

  _updateName() {
    const name = this._dialog.querySelector('[data-field="name"]').value.trim();
    if (!name) return;

    this._player.nameLabel.setText(name);

    // Send identity update to other players via NetworkManager
    if (this._scene.networkManager?.ws?.readyState === WebSocket.OPEN) {
      this._scene.networkManager.ws.send(JSON.stringify({
        type: 'identify',
        playerName: name,
        avatarUrl: null,
      }));
    }
  }

  // --- Position Updates ---

  _startPositionUpdates() {
    const update = () => {
      if (!this._dialog || !this._player) return;
      const posX = this._dialog.querySelector('[data-field="posX"]');
      const posY = this._dialog.querySelector('[data-field="posY"]');
      if (posX) posX.value = Math.round(this._player.sprite.x);
      if (posY) posY.value = Math.round(this._player.sprite.y);
      this._rafId = requestAnimationFrame(update);
    };
    this._rafId = requestAnimationFrame(update);
  }

  _stopPositionUpdates() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  // --- Helpers ---

  _clamp(val) {
    return Math.max(0, Math.min(255, val));
  }

  _rgbToHex(r, g, b) {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
