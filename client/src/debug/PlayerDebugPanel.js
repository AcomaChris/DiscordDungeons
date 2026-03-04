import './player-debug.css';
import { acquireInputFocus, releaseInputFocus } from '../core/InputContext.js';
import { CHAR_HEIGHT, TEXTURE_SCALE } from '../core/Constants.js';
import { ABILITY_DEFS, ABILITY_CATEGORIES } from '../abilities/AbilityDefs.js';
import { ENTRY_DOMAIN, BRAND_NAME } from '../core/BrandConfig.js';

// --- Player Debug Panel ---
// Live-tweaking panel for player collision, color, and name.
// Accessed via the cog menu. Changes replicate to all connected players.

export class PlayerDebugPanel {
  constructor() {
    this._backdrop = null;
    this._dialog = null;
    this._rafId = null;
    this._holdsFocus = false;
    this._onCanvasPointerDown = null;
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
    this._holdsFocus = true;
    acquireInputFocus();
    this._setupFocusToggle();
    this._startPositionUpdates();
  }

  close() {
    this._stopPositionUpdates();
    this._teardownFocusToggle();
    if (this._backdrop) {
      this._backdrop.remove();
      this._backdrop = null;
      this._dialog = null;
      if (this._holdsFocus) {
        releaseInputFocus();
        this._holdsFocus = false;
      }
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

      <div class="player-debug-section">Entry</div>
      <div class="player-debug-row">
        <span class="player-debug-label">Domain</span>
        <input type="text" class="player-debug-input" value="${this._escapeHtml(ENTRY_DOMAIN)}" readonly />
      </div>
      <div class="player-debug-row">
        <span class="player-debug-label">Brand</span>
        <input type="text" class="player-debug-input" value="${this._escapeHtml(BRAND_NAME)}" readonly />
      </div>

      <div class="player-debug-section">Position (read-only)</div>
      <div class="player-debug-row">
        <div class="player-debug-inline">
          <span class="player-debug-label">X</span>
          <input type="text" class="player-debug-input player-debug-input-small" data-field="posX" value="${Math.round(player.sprite.x)}" readonly />
          <span class="player-debug-label">Y</span>
          <input type="text" class="player-debug-input player-debug-input-small" data-field="posY" value="${Math.round(player._groundY ?? player.sprite.y)}" readonly />
          <span class="player-debug-label">Z</span>
          <input type="text" class="player-debug-input player-debug-input-small" data-field="posZ" value="${Math.round(player.z ?? 0)}" readonly />
        </div>
      </div>

      <div class="player-debug-section">Abilities</div>
      <div class="player-debug-abilities" data-field="abilities"></div>

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

    // Abilities
    this._renderAbilities();

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

  // --- Abilities ---

  _renderAbilities() {
    const container = this._dialog.querySelector('[data-field="abilities"]');
    if (!container || !this._player.abilities) return;

    const abilities = this._player.abilities;
    container.innerHTML = '';

    // Show only equipped abilities
    const equipped = abilities.getState().equipped;
    for (const id of equipped) {
      const entry = abilities.get(id);
      const isActive = entry?.active ?? false;

      const block = document.createElement('div');
      block.className = 'player-debug-ability-block';
      block.dataset.abilityId = id;

      // --- Header: name + active dot + X remove button ---
      const header = document.createElement('div');
      header.className = 'player-debug-ability-header';

      const name = document.createElement('span');
      name.className = 'player-debug-ability-name';
      name.textContent = id;

      const dot = document.createElement('span');
      dot.className = `player-debug-ability-dot${isActive ? ' active' : ''}`;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'player-debug-ability-remove';
      removeBtn.textContent = '\u00d7';
      removeBtn.title = `Remove ${id}`;
      removeBtn.addEventListener('click', () => {
        abilities.unequip(id);
        this._renderAbilities();
      });

      header.appendChild(name);
      header.appendChild(dot);
      header.appendChild(removeBtn);
      block.appendChild(header);

      // --- Param inputs ---
      this._renderAbilityParams(block, id);

      container.appendChild(block);
    }

    // --- Add button ---
    const addBtn = document.createElement('button');
    addBtn.className = 'player-debug-add-btn';
    addBtn.textContent = '+ Add Ability';
    addBtn.addEventListener('click', () => this._showAddAbilityMenu(container));
    container.appendChild(addBtn);
  }

  // --- Add Ability Menu ---

  _showAddAbilityMenu(container) {
    // Remove existing menu if open
    this._hideAddAbilityMenu(container);

    const abilities = this._player.abilities;
    const equippedSet = new Set(abilities.getState().equipped);

    // Collect unequipped abilities grouped by category
    const byCategory = {};
    for (const [id, def] of Object.entries(ABILITY_DEFS)) {
      if (equippedSet.has(id)) continue;
      const cat = def.category || 'Uncategorized';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(id);
    }

    // Nothing to add
    if (Object.keys(byCategory).length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'player-debug-add-menu';

    // Render categories in defined order
    for (const cat of ABILITY_CATEGORIES) {
      const ids = byCategory[cat];
      if (!ids || ids.length === 0) continue;

      const catHeader = document.createElement('div');
      catHeader.className = 'player-debug-add-category';
      catHeader.textContent = cat;
      menu.appendChild(catHeader);

      for (const id of ids) {
        const item = document.createElement('div');
        item.className = 'player-debug-add-item';
        item.textContent = id;
        item.addEventListener('click', () => {
          abilities.equip(id);
          this._renderAbilities();
        });
        menu.appendChild(item);
      }
    }

    // Handle uncategorized abilities (future-proofing)
    if (byCategory.Uncategorized) {
      const catHeader = document.createElement('div');
      catHeader.className = 'player-debug-add-category';
      catHeader.textContent = 'Uncategorized';
      menu.appendChild(catHeader);
      for (const id of byCategory.Uncategorized) {
        const item = document.createElement('div');
        item.className = 'player-debug-add-item';
        item.textContent = id;
        item.addEventListener('click', () => {
          abilities.equip(id);
          this._renderAbilities();
        });
        menu.appendChild(item);
      }
    }

    container.appendChild(menu);
  }

  _hideAddAbilityMenu(container) {
    const existing = container?.querySelector('.player-debug-add-menu');
    if (existing) existing.remove();
  }

  _renderAbilityParams(block, abilityId) {
    const existing = block.querySelector('.player-debug-ability-params');
    if (existing) existing.remove();

    const abilities = this._player.abilities;
    if (!abilities.has(abilityId)) return;

    const def = ABILITY_DEFS[abilityId];
    const paramsContainer = document.createElement('div');
    paramsContainer.className = 'player-debug-ability-params';

    for (const paramName of Object.keys(def.params)) {
      const baseValue = abilities.getBaseParam(abilityId, paramName);
      const resolvedValue = abilities.getParam(abilityId, paramName);

      const row = document.createElement('div');
      row.className = 'player-debug-ability-param-row';

      const label = document.createElement('span');
      label.className = 'player-debug-label';
      label.textContent = paramName;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'player-debug-input player-debug-input-small';
      input.dataset.abilityParam = `${abilityId}.${paramName}`;
      input.value = baseValue;
      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          abilities.setParam(abilityId, paramName, val);
        }
      });

      row.appendChild(label);
      row.appendChild(input);

      if (resolvedValue !== baseValue) {
        const resolvedSpan = document.createElement('span');
        resolvedSpan.className = 'player-debug-resolved-value';
        resolvedSpan.textContent = `= ${resolvedValue}`;
        row.appendChild(resolvedSpan);
      }

      paramsContainer.appendChild(row);
    }

    // --- Modifier list ---
    const modifiers = abilities.getModifiers(abilityId);
    if (modifiers.length > 0) {
      const modList = document.createElement('div');
      modList.className = 'player-debug-modifier-list';

      for (const mod of modifiers) {
        const modRow = document.createElement('div');
        modRow.className = 'player-debug-modifier-row';
        const opSymbol = mod.op === 'add' ? '+' : '\u00d7';
        modRow.textContent = `${mod.param}: ${opSymbol}${mod.value}`;
        if (mod.source) {
          const src = document.createElement('span');
          src.className = 'player-debug-modifier-source';
          src.textContent = ` (${mod.source})`;
          modRow.appendChild(src);
        }
        modList.appendChild(modRow);
      }
      paramsContainer.appendChild(modList);
    }

    block.appendChild(paramsContainer);
  }

  _updateAbilityIndicators() {
    if (!this._player?.abilities) return;
    const container = this._dialog.querySelector('[data-field="abilities"]');
    if (!container) return;

    const activeSet = new Set(this._player.abilities.getState().active);

    for (const block of container.querySelectorAll('.player-debug-ability-block')) {
      const dot = block.querySelector('.player-debug-ability-dot');
      if (dot) {
        dot.classList.toggle('active', activeSet.has(block.dataset.abilityId));
      }
    }
  }

  // --- Focus Toggle ---
  // Clicking the game canvas releases input focus (player can move).
  // Clicking/focusing a panel input re-acquires it (typing stays in panel).

  _setupFocusToggle() {
    const canvas = globalThis.__PHASER_GAME__?.canvas;
    if (canvas) {
      this._onCanvasPointerDown = () => {
        if (this._holdsFocus) {
          releaseInputFocus();
          this._holdsFocus = false;
        }
      };
      canvas.addEventListener('pointerdown', this._onCanvasPointerDown);
    }

    this._dialog.addEventListener('focusin', () => {
      if (!this._holdsFocus) {
        acquireInputFocus();
        this._holdsFocus = true;
      }
    });
  }

  _teardownFocusToggle() {
    if (this._onCanvasPointerDown) {
      const canvas = globalThis.__PHASER_GAME__?.canvas;
      if (canvas) {
        canvas.removeEventListener('pointerdown', this._onCanvasPointerDown);
      }
      this._onCanvasPointerDown = null;
    }
  }

  // --- Position Updates ---

  _startPositionUpdates() {
    const update = () => {
      if (!this._dialog || !this._player) return;
      const posX = this._dialog.querySelector('[data-field="posX"]');
      const posY = this._dialog.querySelector('[data-field="posY"]');
      const posZ = this._dialog.querySelector('[data-field="posZ"]');
      if (posX) posX.value = Math.round(this._player.sprite.x);
      if (posY) posY.value = Math.round(this._player._groundY ?? this._player.sprite.y);
      if (posZ) posZ.value = Math.round(this._player.z ?? 0);
      this._updateAbilityIndicators();
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
