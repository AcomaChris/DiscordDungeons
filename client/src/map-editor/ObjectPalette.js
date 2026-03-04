// --- ObjectPalette ---
// Floating panel content listing available objects from loaded tilesets.
// Objects are grouped by tileset, filterable by search, and rendered
// as canvas thumbnails showing the composed tile grid.

const TILE_SIZE = 16;
const THUMB_SIZE = 32;

export class ObjectPalette {
  constructor(contentEl) {
    this._el = contentEl;
    this._tilesets = [];
    this._items = [];         // flattened list: { objectDef, tilesetEntry, el }
    this._selected = null;    // { objectDef, tilesetEntry } or null

    // Callbacks
    this.onObjectSelect = null; // (objectDef, tilesetEntry)

    this._build();
  }

  // --- DOM setup ---

  _build() {
    this._el.innerHTML = '';

    // Search input
    this._searchInput = document.createElement('input');
    this._searchInput.type = 'text';
    this._searchInput.placeholder = 'Search objects...';
    this._searchInput.className = 'object-search';
    this._searchInput.addEventListener('input', () => this._applyFilter());
    this._el.appendChild(this._searchInput);

    // Scrollable object list
    this._listEl = document.createElement('div');
    this._listEl.className = 'object-list';
    this._el.appendChild(this._listEl);
  }

  // --- Data update ---

  updateTilesets(tilesets) {
    this._tilesets = tilesets;
    this._items = [];
    this._selected = null;
    this._listEl.innerHTML = '';

    for (const ts of tilesets) {
      if (!ts.objectDefs || ts.objectDefs.length === 0) continue;

      for (const objDef of ts.objectDefs) {
        const itemEl = this._createItem(objDef, ts);
        this._items.push({ objectDef: objDef, tilesetEntry: ts, el: itemEl });
        this._listEl.appendChild(itemEl);
      }
    }

    this._applyFilter();
  }

  // --- Item rendering ---

  _createItem(objDef, tilesetEntry) {
    const item = document.createElement('div');
    item.className = 'object-list-item';
    item.dataset.objId = objDef.id;

    // Thumbnail canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'object-thumbnail';
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    this._drawThumbnail(canvas, objDef, tilesetEntry);
    item.appendChild(canvas);

    // Name label
    const nameSpan = document.createElement('span');
    nameSpan.className = 'object-name';
    nameSpan.textContent = objDef.name || objDef.id;
    item.appendChild(nameSpan);

    // Size label
    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'object-size';
    sizeSpan.textContent = `${objDef.width}\u00d7${objDef.height}`;
    item.appendChild(sizeSpan);

    item.addEventListener('click', () => this._selectItem(objDef, tilesetEntry));

    return item;
  }

  _drawThumbnail(canvas, objDef, tilesetEntry) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const img = tilesetEntry.image;
    if (!img || !objDef.tiles) return;

    // Calculate scale to fit object into THUMB_SIZE x THUMB_SIZE
    const objPixelW = objDef.width * TILE_SIZE;
    const objPixelH = objDef.height * TILE_SIZE;
    const scale = Math.min(THUMB_SIZE / objPixelW, THUMB_SIZE / objPixelH);

    // Center within thumbnail
    const drawW = objPixelW * scale;
    const drawH = objPixelH * scale;
    const offsetX = (THUMB_SIZE - drawW) / 2;
    const offsetY = (THUMB_SIZE - drawH) / 2;

    const tileDrawSize = TILE_SIZE * scale;

    for (let r = 0; r < objDef.tiles.length; r++) {
      const row = objDef.tiles[r];
      for (let c = 0; c < row.length; c++) {
        const tile = row[c];
        if (!tile) continue;

        ctx.drawImage(
          img,
          tile.col * TILE_SIZE, tile.row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
          offsetX + c * tileDrawSize, offsetY + r * tileDrawSize,
          tileDrawSize, tileDrawSize,
        );
      }
    }
  }

  // --- Selection ---

  _selectItem(objectDef, tilesetEntry) {
    // Clear previous selection
    for (const item of this._items) {
      item.el.classList.remove('selected');
    }

    // Set new selection
    this._selected = { objectDef, tilesetEntry };
    const match = this._items.find(
      (it) => it.objectDef === objectDef && it.tilesetEntry === tilesetEntry,
    );
    if (match) match.el.classList.add('selected');

    if (this.onObjectSelect) this.onObjectSelect(objectDef, tilesetEntry);
  }

  // --- Search filter ---

  _applyFilter() {
    const query = this._searchInput.value.toLowerCase().trim();

    for (const item of this._items) {
      const name = (item.objectDef.name || item.objectDef.id || '').toLowerCase();
      const visible = !query || name.includes(query);
      item.el.style.display = visible ? '' : 'none';
    }
  }

  // --- Public API ---

  getSelectedObject() {
    return this._selected;
  }
}
