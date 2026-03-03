// --- ObjectEditorList ---
// Filterable object list with thumbnails, category badges, and validation indicators.
// Renders into #object-list-panel, syncs selection with canvas and properties.

import { OBJECT_CATEGORIES, validateObjectDef } from '../map/object-def-schema.js';

const TILE_SIZE = 16;
const THUMB_SIZE = 32;

export class ObjectEditorList {
  constructor(panelEl) {
    this.panel = panelEl;
    this.objectDefs = {};
    this.selectedId = null;
    this.image = null;
    this.columns = 0;

    // Thumbnail cache: objectId → HTMLCanvasElement
    this._thumbCache = new Map();

    // Callbacks
    this.onObjectSelect = null;

    this._filterCategory = 'all';
    this._filterText = '';

    this._buildUI();
  }

  _buildUI() {
    this.panel.innerHTML = '';

    // Header
    const header = document.createElement('h3');
    header.textContent = 'Objects';
    this.panel.appendChild(header);

    // Filter controls
    const controls = document.createElement('div');
    controls.className = 'object-list-controls';

    // Category filter
    this._categorySelect = document.createElement('select');
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'All Categories';
    this._categorySelect.appendChild(allOpt);
    for (const cat of OBJECT_CATEGORIES) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      this._categorySelect.appendChild(opt);
    }
    this._categorySelect.addEventListener('change', () => {
      this._filterCategory = this._categorySelect.value;
      this._renderList();
    });

    // Text search
    this._searchInput = document.createElement('input');
    this._searchInput.type = 'text';
    this._searchInput.placeholder = 'Search...';
    this._searchInput.addEventListener('input', () => {
      this._filterText = this._searchInput.value.toLowerCase();
      this._renderList();
    });

    controls.append(this._categorySelect, this._searchInput);
    this.panel.appendChild(controls);

    // Scrollable list
    this._listEl = document.createElement('div');
    this._listEl.style.overflowY = 'auto';
    this.panel.appendChild(this._listEl);
  }

  loadDefs(objectDefs, image, columns) {
    this.objectDefs = objectDefs || {};
    this.image = image;
    this.columns = columns;
    this._thumbCache.clear();
    this._renderList();
  }

  selectObject(objectId) {
    this.selectedId = objectId;
    this._updateSelection();
  }

  // Re-render a single item (after property change) without full rebuild
  refreshObject(objectId) {
    this._thumbCache.delete(objectId);
    this._renderList();
  }

  // --- Filter + render the list ---

  _renderList() {
    this._listEl.innerHTML = '';

    const entries = Object.entries(this.objectDefs);
    let filtered = entries;

    // Category filter
    if (this._filterCategory !== 'all') {
      filtered = filtered.filter(([, def]) => def.category === this._filterCategory);
    }

    // Text search
    if (this._filterText) {
      const q = this._filterText;
      filtered = filtered.filter(([id, def]) =>
        id.toLowerCase().includes(q)
        || (def.name || '').toLowerCase().includes(q)
        || (def.tags || []).some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Sort by name
    filtered.sort(([, a], [, b]) => (a.name || '').localeCompare(b.name || ''));

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.height = 'auto';
      empty.style.padding = '16px 0';
      empty.textContent = entries.length === 0 ? 'No objects loaded' : 'No matching objects';
      this._listEl.appendChild(empty);
      return;
    }

    for (const [id, def] of filtered) {
      this._listEl.appendChild(this._createListItem(id, def));
    }
  }

  _createListItem(id, def) {
    const item = document.createElement('div');
    item.className = 'object-list-item';
    item.dataset.objectId = id;
    if (id === this.selectedId) item.classList.add('selected');

    // Thumbnail
    const thumb = this._getThumb(id, def);
    item.appendChild(thumb);

    // Info column
    const info = document.createElement('div');
    info.className = 'object-list-info';

    const name = document.createElement('div');
    name.className = 'object-list-name';
    name.textContent = def.name || id;
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'object-list-meta';

    const idLabel = document.createElement('span');
    idLabel.className = 'object-list-id';
    idLabel.textContent = id;
    meta.appendChild(idLabel);

    if (def.category) {
      const badge = document.createElement('span');
      badge.className = `category-badge ${def.category}`;
      badge.textContent = def.category;
      meta.appendChild(badge);
    }

    info.appendChild(meta);
    item.appendChild(info);

    // Validation indicator
    const validation = validateObjectDef({ ...def, id });
    const indicator = document.createElement('span');
    indicator.className = `validation-indicator ${validation.valid ? 'valid' : 'invalid'}`;
    indicator.textContent = validation.valid ? '\u2713' : '\u2717';
    indicator.title = validation.valid
      ? 'Valid'
      : validation.errors.join('\n');
    item.appendChild(indicator);

    // Click handler
    item.addEventListener('click', () => {
      this.selectedId = id;
      this._updateSelection();
      if (this.onObjectSelect) this.onObjectSelect(id);
    });

    return item;
  }

  _getThumb(id, def) {
    if (this._thumbCache.has(id)) {
      const cached = this._thumbCache.get(id);
      const img = document.createElement('img');
      img.src = cached.toDataURL();
      img.className = 'object-thumb';
      return img;
    }

    // Composite all object tiles onto a small canvas
    if (!this.image || !def.grid || !def.grid.tiles) {
      const placeholder = document.createElement('canvas');
      placeholder.width = THUMB_SIZE;
      placeholder.height = THUMB_SIZE;
      placeholder.className = 'object-thumb';
      return placeholder;
    }

    const cols = def.grid.cols || 1;
    const rows = def.grid.rows || 1;
    const scale = Math.min(THUMB_SIZE / (cols * TILE_SIZE), THUMB_SIZE / (rows * TILE_SIZE));

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Center the object in the thumbnail
    const drawW = cols * TILE_SIZE * scale;
    const drawH = rows * TILE_SIZE * scale;
    const offsetX = (THUMB_SIZE - drawW) / 2;
    const offsetY = (THUMB_SIZE - drawH) / 2;

    for (let r = 0; r < def.grid.tiles.length; r++) {
      for (let c = 0; c < def.grid.tiles[r].length; c++) {
        const tileIdx = def.grid.tiles[r][c];
        if (tileIdx === null || tileIdx === undefined) continue;

        const srcCol = tileIdx % this.columns;
        const srcRow = Math.floor(tileIdx / this.columns);

        ctx.drawImage(
          this.image,
          srcCol * TILE_SIZE, srcRow * TILE_SIZE, TILE_SIZE, TILE_SIZE,
          offsetX + c * TILE_SIZE * scale,
          offsetY + r * TILE_SIZE * scale,
          TILE_SIZE * scale,
          TILE_SIZE * scale,
        );
      }
    }

    this._thumbCache.set(id, canvas);

    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.className = 'object-thumb';
    return img;
  }

  _updateSelection() {
    const items = this._listEl.querySelectorAll('.object-list-item');
    for (const item of items) {
      item.classList.toggle('selected', item.dataset.objectId === this.selectedId);
    }
  }
}
