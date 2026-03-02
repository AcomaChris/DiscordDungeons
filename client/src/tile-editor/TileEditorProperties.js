// --- TileEditorProperties ---
// Builds and manages the DOM property panel for tile metadata editing.
// Handles single and multi-tile selection, emits change events.

import {
  TILE_DEFAULTS,
  TILE_CATEGORIES,
  TILE_COLLISIONS,
  TILE_SURFACES,
  FOOTSTEP_SOUNDS,
  getTileProperties,
} from '../map/tile-metadata-schema.js';

export class TileEditorProperties {
  constructor(panelEl, previewEl) {
    this.panel = panelEl;
    this.previewEl = previewEl;
    this.selection = new Set();
    this.metadata = {};
    this.clipboard = null;

    // Callbacks
    this.onPropertyChange = null;
    this.onClearTiles = null;

    this._controls = {};
    this._buildUI();
  }

  // --- Build the property form ---
  _buildUI() {
    this.panel.innerHTML = '';

    // Section header
    this._headerEl = document.createElement('h3');
    this._headerEl.textContent = 'Tile Properties';
    this.panel.appendChild(this._headerEl);

    // No selection placeholder
    this._emptyEl = document.createElement('div');
    this._emptyEl.className = 'empty-state';
    this._emptyEl.textContent = 'Select a tile to edit';
    this._emptyEl.style.height = 'auto';
    this._emptyEl.style.padding = '32px 0';
    this.panel.appendChild(this._emptyEl);

    // Properties container (hidden until selection)
    this._propsContainer = document.createElement('div');
    this._propsContainer.style.display = 'none';
    this.panel.appendChild(this._propsContainer);

    // Build individual controls
    this._addSelect('category', 'Category', TILE_CATEGORIES);
    this._addSelect('collision', 'Collision', TILE_COLLISIONS);
    this._addSelect('surface', 'Surface', TILE_SURFACES);
    this._addNumber('elevationHint', 'Elevation Hint', 0, 10, 1);
    this._addRange('lightEmission', 'Light Emission', 0, 1, 0.1);
    this._addTextWithDatalist('footstepSound', 'Footstep Sound', FOOTSTEP_SOUNDS);
    this._addCheckbox('walkable', 'Walkable');
    this._addRange('transparency', 'Transparency', 0, 1, 0.1);
    this._addText('zLayerOverride', 'Z-Layer Override');

    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'action-buttons';

    const copyBtn = this._makeBtn('Copy', 'btn', () => this._copyProperties());
    const pasteBtn = this._makeBtn('Paste', 'btn', () => this._pasteProperties());
    const clearBtn = this._makeBtn('Clear', 'btn btn-danger', () => this._clearTiles());

    actions.append(copyBtn, pasteBtn, clearBtn);
    this._propsContainer.appendChild(actions);
  }

  // --- Control Builders ---

  _addSelect(key, label, options) {
    const group = this._makeGroup(key, label);
    const select = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    }
    select.addEventListener('change', () => this._onControlChange(key, select.value));
    group.appendChild(select);
    this._controls[key] = select;
    this._propsContainer.appendChild(group);
  }

  _addNumber(key, label, min, max, step) {
    const group = this._makeGroup(key, label);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = min;
    input.max = max;
    input.step = step;
    input.addEventListener('change', () => this._onControlChange(key, parseFloat(input.value) || 0));
    group.appendChild(input);
    this._controls[key] = input;
    this._propsContainer.appendChild(group);
  }

  _addRange(key, label, min, max, step) {
    const group = this._makeGroup(key, label);
    const row = document.createElement('div');
    row.className = 'range-row';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    const valueLabel = document.createElement('span');
    valueLabel.className = 'range-value';
    valueLabel.textContent = '0';
    input.addEventListener('input', () => {
      valueLabel.textContent = input.value;
      this._onControlChange(key, parseFloat(input.value));
    });
    row.append(input, valueLabel);
    group.appendChild(row);
    this._controls[key] = { input, valueLabel };
    this._propsContainer.appendChild(group);
  }

  _addCheckbox(key, label) {
    const group = this._makeGroup(key, '');
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `prop-${key}`;
    const span = document.createElement('span');
    span.textContent = label;
    input.addEventListener('change', () => this._onControlChange(key, input.checked));
    row.append(input, span);
    group.appendChild(row);
    this._controls[key] = input;
    this._propsContainer.appendChild(group);
  }

  _addText(key, label) {
    const group = this._makeGroup(key, label);
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'null';
    input.addEventListener('change', () => {
      const val = input.value.trim();
      this._onControlChange(key, val === '' ? null : val);
    });
    group.appendChild(input);
    this._controls[key] = input;
    this._propsContainer.appendChild(group);
  }

  _addTextWithDatalist(key, label, suggestions) {
    const group = this._makeGroup(key, label);
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('list', `datalist-${key}`);
    const datalist = document.createElement('datalist');
    datalist.id = `datalist-${key}`;
    for (const s of suggestions) {
      const o = document.createElement('option');
      o.value = s;
      datalist.appendChild(o);
    }
    input.addEventListener('change', () => this._onControlChange(key, input.value));
    group.append(input, datalist);
    this._controls[key] = input;
    this._propsContainer.appendChild(group);
  }

  _makeGroup(key, label) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    group.dataset.key = key;
    if (label) {
      const lbl = document.createElement('label');
      lbl.textContent = label;
      group.appendChild(lbl);
    }
    return group;
  }

  _makeBtn(text, cls, onClick) {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  // --- Update from external state ---

  updateSelection(selection, metadata, canvasComponent) {
    this.selection = selection;
    this.metadata = metadata;
    this._canvasComponent = canvasComponent;

    if (selection.size === 0) {
      this._emptyEl.style.display = 'block';
      this._propsContainer.style.display = 'none';
      this._updatePreview(null);
      return;
    }

    this._emptyEl.style.display = 'none';
    this._propsContainer.style.display = 'block';

    // Get properties for all selected tiles
    const allProps = [...selection].map((id) =>
      getTileProperties({ tiles: metadata }, id),
    );

    // For each property, show common value or 'mixed'
    for (const key of Object.keys(TILE_DEFAULTS)) {
      const values = allProps.map((p) => p[key]);
      const allSame = values.every((v) => v === values[0]);
      this._setControlValue(key, allSame ? values[0] : null, !allSame);
    }

    // Update preview with first selected tile
    const firstId = [...selection][0];
    this._updatePreview(firstId);
  }

  _setControlValue(key, value, isMixed) {
    const ctrl = this._controls[key];
    if (!ctrl) return;

    if (key === 'lightEmission' || key === 'transparency') {
      // Range control with value label
      ctrl.input.value = isMixed ? 0 : value;
      ctrl.valueLabel.textContent = isMixed ? '...' : value;
      return;
    }

    if (key === 'walkable') {
      ctrl.checked = isMixed ? false : value;
      ctrl.indeterminate = isMixed;
      return;
    }

    if (key === 'zLayerOverride') {
      ctrl.value = isMixed ? '' : (value ?? '');
      return;
    }

    ctrl.value = isMixed ? '' : value;
  }

  _updatePreview(tileIndex) {
    if (!this.previewEl) return;
    this.previewEl.innerHTML = '';

    if (tileIndex === null || tileIndex === undefined || !this._canvasComponent) {
      this.previewEl.innerHTML = '<div class="tile-info">No selection</div>';
      return;
    }

    const tileCanvas = this._canvasComponent.getTileImageData(tileIndex);
    if (tileCanvas) {
      tileCanvas.style.width = '48px';
      tileCanvas.style.height = '48px';
      tileCanvas.style.imageRendering = 'pixelated';
      this.previewEl.appendChild(tileCanvas);
    }

    const info = document.createElement('div');
    info.className = 'tile-info';
    const col = tileIndex % this._canvasComponent.columns;
    const row = Math.floor(tileIndex / this._canvasComponent.columns);
    info.innerHTML = `
      <div class="tile-index">#${tileIndex}</div>
      <div>Col ${col}, Row ${row}</div>
      <div>${this.selection.size > 1 ? `${this.selection.size} selected` : ''}</div>
    `;
    this.previewEl.appendChild(info);
  }

  // --- Control Change Handler ---

  _onControlChange(key, value) {
    if (this.selection.size === 0) return;
    if (this.onPropertyChange) {
      this.onPropertyChange(key, value, new Set(this.selection));
    }
  }

  // --- Copy / Paste / Clear ---

  _copyProperties() {
    if (this.selection.size === 0) return;
    const firstId = [...this.selection][0];
    this.clipboard = getTileProperties({ tiles: this.metadata }, firstId);
  }

  _pasteProperties() {
    if (!this.clipboard || this.selection.size === 0) return;
    for (const [key, value] of Object.entries(this.clipboard)) {
      if (this.onPropertyChange) {
        this.onPropertyChange(key, value, new Set(this.selection));
      }
    }
  }

  _clearTiles() {
    if (this.selection.size === 0) return;
    if (this.onClearTiles) {
      this.onClearTiles(new Set(this.selection));
    }
  }
}
