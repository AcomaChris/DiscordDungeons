// --- LayerPanel ---
// Grouped layer list with active layer selection, visibility toggles,
// and opacity sliders. Lives inside a FloatingPanel.

import { LAYER_GROUPS, ALL_LAYER_NAMES } from './MapDocument.js';

export class LayerPanel {
  constructor(containerEl) {
    this._container = containerEl;
    this._activeLayer = 'Ground';
    this._visibility = {};
    this._opacity = {};

    // Initialize defaults
    for (const name of ALL_LAYER_NAMES) {
      this._visibility[name] = true;
      this._opacity[name] = 1.0;
    }

    // Callbacks
    this.onActiveLayerChange = null;  // (layerName) => void
    this.onVisibilityChange = null;   // (layerName, visible) => void
    this.onOpacityChange = null;      // (layerName, opacity) => void

    this._build();
  }

  get activeLayer() { return this._activeLayer; }

  setActiveLayer(name) {
    if (!ALL_LAYER_NAMES.includes(name)) return;
    this._activeLayer = name;
    this._updateActiveState();
    if (this.onActiveLayerChange) this.onActiveLayerChange(name);
  }

  getVisibility(name) { return this._visibility[name] !== false; }

  setVisibility(name, visible) {
    this._visibility[name] = visible;
    this._updateVisibilityIcon(name);
    if (this.onVisibilityChange) this.onVisibilityChange(name, visible);
  }

  getOpacity(name) { return this._opacity[name] ?? 1.0; }

  // --- Build DOM ---

  _build() {
    this._container.innerHTML = '';
    this._layerEls = {};

    for (const [groupName, layers] of Object.entries(LAYER_GROUPS)) {
      // Group header
      const header = document.createElement('div');
      header.className = 'layer-group-header';
      header.textContent = groupName;
      this._container.appendChild(header);

      // Layer items
      for (const layerName of layers) {
        const item = this._buildLayerItem(layerName);
        this._container.appendChild(item);
        this._layerEls[layerName] = item;
      }
    }

    this._updateActiveState();
  }

  _buildLayerItem(name) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    item.dataset.layer = name;

    // Visibility eye
    const eye = document.createElement('span');
    eye.className = 'layer-visibility';
    eye.textContent = '\u{1F441}';
    eye.title = 'Toggle visibility';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      const vis = !this._visibility[name];
      this._visibility[name] = vis;
      this._updateVisibilityIcon(name);
      if (this.onVisibilityChange) this.onVisibilityChange(name, vis);
    });
    item.appendChild(eye);

    // Layer name
    const label = document.createElement('span');
    label.className = 'layer-name';
    label.textContent = name;
    item.appendChild(label);

    // Opacity slider
    const opSlider = document.createElement('input');
    opSlider.className = 'layer-opacity';
    opSlider.type = 'range';
    opSlider.min = '0';
    opSlider.max = '100';
    opSlider.value = '100';
    opSlider.title = 'Opacity';
    opSlider.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseInt(e.target.value, 10) / 100;
      this._opacity[name] = val;
      if (this.onOpacityChange) this.onOpacityChange(name, val);
    });
    opSlider.addEventListener('click', (e) => e.stopPropagation());
    item.appendChild(opSlider);

    // Click row = set active layer
    item.addEventListener('click', () => {
      this._activeLayer = name;
      this._updateActiveState();
      if (this.onActiveLayerChange) this.onActiveLayerChange(name);
    });

    return item;
  }

  _updateActiveState() {
    for (const [name, el] of Object.entries(this._layerEls)) {
      el.classList.toggle('active', name === this._activeLayer);
    }
  }

  _updateVisibilityIcon(name) {
    const el = this._layerEls[name];
    if (!el) return;
    const eye = el.querySelector('.layer-visibility');
    if (eye) {
      eye.classList.toggle('hidden-layer', !this._visibility[name]);
    }
  }

  // Quick-switch by index (1-7 keys)
  selectByIndex(index) {
    if (index >= 0 && index < ALL_LAYER_NAMES.length) {
      this.setActiveLayer(ALL_LAYER_NAMES[index]);
    }
  }
}
