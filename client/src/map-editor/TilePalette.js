// --- TilePalette ---
// Floating panel showing the active tileset's tiles for brush selection.
// Supports single-tile and rectangular stamp selection.

// @doc-creator-tools 01:Map Editor > Tile Palette
// Browse and select tiles from loaded tilesets. Click a tile to select it
// for painting. Drag to select a rectangular multi-tile stamp. Use the
// tileset dropdown to switch between available tilesets.

const TILE_SIZE = 16;
const PALETTE_ZOOM = 2;

export class TilePalette {
  constructor(contentEl) {
    this._el = contentEl;
    this._tilesets = [];       // reference to MapDocument.tilesets
    this._activeIndex = -1;
    this._canvas = null;
    this._ctx = null;
    this._image = null;        // active tileset image
    this._columns = 0;
    this._rows = 0;
    this._firstgid = 1;

    // Selection state
    this._selectedTile = -1;   // local tile ID (-1 = none)
    this._stampStart = null;   // {col, row} for drag stamp select
    this._stampEnd = null;
    this._isDragging = false;

    // Category filter
    this._metadata = null;     // tile metadata for active tileset
    this._activeCategory = null; // null = show all

    // Callbacks
    this.onTileSelect = null;  // (gid)
    this.onStampSelect = null; // (gids[][], cols, rows)
    this.onAddTileset = null;  // ()

    this._build();
  }

  _build() {
    this._el.innerHTML = '';

    // Controls row: tileset dropdown + add button
    const controls = document.createElement('div');
    controls.className = 'palette-controls';

    this._select = document.createElement('select');
    this._select.addEventListener('change', () => {
      const idx = parseInt(this._select.value, 10);
      this.setActiveTileset(idx);
    });
    controls.appendChild(this._select);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = '+ Add';
    addBtn.title = 'Add a tileset';
    addBtn.addEventListener('click', () => {
      if (this.onAddTileset) this.onAddTileset();
    });
    controls.appendChild(addBtn);

    this._el.appendChild(controls);

    // Category filter chips
    this._chipContainer = document.createElement('div');
    this._chipContainer.className = 'category-chips';
    this._el.appendChild(this._chipContainer);

    // Canvas
    this._canvas = document.createElement('canvas');
    this._canvas.className = 'palette-canvas';
    this._canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this._canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this._canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this._canvas.addEventListener('mouseleave', () => this._onMouseUp(null));
    this._ctx = this._canvas.getContext('2d');
    this._el.appendChild(this._canvas);

    // Info line
    this._info = document.createElement('div');
    this._info.style.cssText = 'font-size: 0.75rem; color: #7a7aaa; margin-top: 4px;';
    this._el.appendChild(this._info);
  }

  // Called when MapDocument.tilesets changes
  updateTilesets(tilesets) {
    this._tilesets = tilesets;

    // Update dropdown
    this._select.innerHTML = '';
    if (tilesets.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = '(no tilesets)';
      opt.disabled = true;
      this._select.appendChild(opt);
      this._activeIndex = -1;
      this._clearCanvas();
      return;
    }

    for (let i = 0; i < tilesets.length; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = tilesets[i].name;
      this._select.appendChild(opt);
    }

    // Keep active index or default to 0
    if (this._activeIndex < 0 || this._activeIndex >= tilesets.length) {
      this.setActiveTileset(0);
    } else {
      this.setActiveTileset(this._activeIndex);
    }
  }

  setActiveTileset(index) {
    if (index < 0 || index >= this._tilesets.length) return;
    this._activeIndex = index;
    this._select.value = index;

    const ts = this._tilesets[index];
    this._image = ts.image;
    this._columns = ts.columns;
    this._rows = ts.rows;
    this._firstgid = ts.firstgid;
    this._metadata = ts.metadata || null;
    this._selectedTile = -1;
    this._stampStart = null;
    this._stampEnd = null;
    this._activeCategory = null;

    this._buildCategoryChips();
    this._resizeCanvas();
    this._render();
  }

  _buildCategoryChips() {
    this._chipContainer.innerHTML = '';
    if (!this._metadata || !this._metadata.tiles) return;

    // Collect unique categories
    const categories = new Set();
    for (const props of Object.values(this._metadata.tiles)) {
      if (props.category) categories.add(props.category);
    }
    if (categories.size === 0) return;

    // "All" chip
    const allChip = document.createElement('button');
    allChip.className = 'category-chip active';
    allChip.textContent = 'All';
    allChip.addEventListener('click', () => {
      this._activeCategory = null;
      this._updateChipStates();
      this._render();
    });
    this._chipContainer.appendChild(allChip);

    for (const cat of [...categories].sort()) {
      const chip = document.createElement('button');
      chip.className = 'category-chip';
      chip.textContent = cat;
      chip.dataset.category = cat;
      chip.addEventListener('click', () => {
        this._activeCategory = cat;
        this._updateChipStates();
        this._render();
      });
      this._chipContainer.appendChild(chip);
    }
  }

  _updateChipStates() {
    for (const chip of this._chipContainer.children) {
      const isCat = chip.dataset.category;
      const isAll = !isCat;
      if (isAll) {
        chip.classList.toggle('active', this._activeCategory === null);
      } else {
        chip.classList.toggle('active', this._activeCategory === isCat);
      }
    }
  }

  _resizeCanvas() {
    const s = TILE_SIZE * PALETTE_ZOOM;
    this._canvas.width = this._columns * s;
    this._canvas.height = this._rows * s;
    this._canvas.style.width = `${this._canvas.width}px`;
    this._canvas.style.height = `${this._canvas.height}px`;
  }

  _clearCanvas() {
    if (!this._ctx) return;
    this._canvas.width = 100;
    this._canvas.height = 50;
    this._ctx.fillStyle = '#1a1a2e';
    this._ctx.fillRect(0, 0, 100, 50);
    this._ctx.fillStyle = '#7a7aaa';
    this._ctx.font = '12px sans-serif';
    this._ctx.textAlign = 'center';
    this._ctx.fillText('No tileset loaded', 50, 30);
    this._info.textContent = '';
  }

  _render() {
    const { _ctx: ctx, _image: img, _columns: cols, _rows: rows } = this;
    if (!ctx || !img) return;

    const s = TILE_SIZE * PALETTE_ZOOM;
    ctx.imageSmoothingEnabled = false;

    // Clear
    ctx.fillStyle = '#121228';
    ctx.fillRect(0, 0, cols * s, rows * s);

    // Draw tiles (dimming filtered categories)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const localId = row * cols + col;
        const dimmed = this._isTileDimmed(localId);

        ctx.globalAlpha = dimmed ? 0.2 : 1.0;
        ctx.drawImage(
          img,
          col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
          col * s, row * s, s, s,
        );
      }
    }
    ctx.globalAlpha = 1.0;

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let col = 0; col <= cols; col++) {
      ctx.beginPath();
      ctx.moveTo(col * s + 0.5, 0);
      ctx.lineTo(col * s + 0.5, rows * s);
      ctx.stroke();
    }
    for (let row = 0; row <= rows; row++) {
      ctx.beginPath();
      ctx.moveTo(0, row * s + 0.5);
      ctx.lineTo(cols * s, row * s + 0.5);
      ctx.stroke();
    }

    // Selection highlight
    if (this._stampStart && this._stampEnd) {
      // Multi-tile stamp selection
      const x1 = Math.min(this._stampStart.col, this._stampEnd.col);
      const y1 = Math.min(this._stampStart.row, this._stampEnd.row);
      const x2 = Math.max(this._stampStart.col, this._stampEnd.col);
      const y2 = Math.max(this._stampStart.row, this._stampEnd.row);

      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1 * s + 1, y1 * s + 1, (x2 - x1 + 1) * s - 2, (y2 - y1 + 1) * s - 2);

      ctx.fillStyle = 'rgba(0, 204, 255, 0.15)';
      ctx.fillRect(x1 * s, y1 * s, (x2 - x1 + 1) * s, (y2 - y1 + 1) * s);
    } else if (this._selectedTile >= 0) {
      // Single tile
      const col = this._selectedTile % cols;
      const row = Math.floor(this._selectedTile / cols);
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 2;
      ctx.strokeRect(col * s + 1, row * s + 1, s - 2, s - 2);
    }

    // Info line
    if (this._selectedTile >= 0) {
      const gid = this._selectedTile + this._firstgid;
      this._info.textContent = `Tile: ${this._selectedTile} (GID ${gid})`;
    } else if (this._stampStart && this._stampEnd) {
      const w = Math.abs(this._stampEnd.col - this._stampStart.col) + 1;
      const h = Math.abs(this._stampEnd.row - this._stampStart.row) + 1;
      this._info.textContent = `Stamp: ${w}×${h}`;
    } else {
      this._info.textContent = this._tilesets[this._activeIndex]
        ? `${this._columns}×${this._rows} (${this._columns * this._rows} tiles)`
        : '';
    }
  }

  _isTileDimmed(localId) {
    if (!this._activeCategory || !this._metadata || !this._metadata.tiles) return false;
    const tileProps = this._metadata.tiles[localId];
    if (!tileProps) return this._activeCategory !== null; // no metadata = dim if filter active
    return tileProps.category !== this._activeCategory;
  }

  // --- Mouse events ---

  _getTileAt(e) {
    const rect = this._canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = TILE_SIZE * PALETTE_ZOOM;
    const col = Math.floor(x / s);
    const row = Math.floor(y / s);
    if (col < 0 || col >= this._columns || row < 0 || row >= this._rows) return null;
    return { col, row, localId: row * this._columns + col };
  }

  _onMouseDown(e) {
    const tile = this._getTileAt(e);
    if (!tile) return;
    this._isDragging = true;
    this._stampStart = { col: tile.col, row: tile.row };
    this._stampEnd = null;
    this._selectedTile = tile.localId;
    this._render();
  }

  _onMouseMove(e) {
    if (!this._isDragging || !this._stampStart) return;
    const tile = this._getTileAt(e);
    if (!tile) return;
    // If moved beyond one tile, switch to stamp mode
    if (tile.col !== this._stampStart.col || tile.row !== this._stampStart.row) {
      this._stampEnd = { col: tile.col, row: tile.row };
      this._selectedTile = -1; // clear single select in stamp mode
    }
    this._render();
  }

  _onMouseUp(_e) {
    if (!this._isDragging) return;
    this._isDragging = false;

    if (this._stampStart && this._stampEnd) {
      // Stamp selection
      const x1 = Math.min(this._stampStart.col, this._stampEnd.col);
      const y1 = Math.min(this._stampStart.row, this._stampEnd.row);
      const x2 = Math.max(this._stampStart.col, this._stampEnd.col);
      const y2 = Math.max(this._stampStart.row, this._stampEnd.row);
      const stampCols = x2 - x1 + 1;
      const stampRows = y2 - y1 + 1;

      const gids = [];
      for (let r = y1; r <= y2; r++) {
        const row = [];
        for (let c = x1; c <= x2; c++) {
          row.push(r * this._columns + c + this._firstgid);
        }
        gids.push(row);
      }

      if (this.onStampSelect) this.onStampSelect(gids, stampCols, stampRows);
    } else if (this._selectedTile >= 0) {
      // Single tile
      const gid = this._selectedTile + this._firstgid;
      if (this.onTileSelect) this.onTileSelect(gid);
    }
  }

  // --- Public API ---

  getSelectedGid() {
    if (this._selectedTile < 0) return 0;
    return this._selectedTile + this._firstgid;
  }

  getStamp() {
    if (!this._stampStart || !this._stampEnd) return null;
    const x1 = Math.min(this._stampStart.col, this._stampEnd.col);
    const y1 = Math.min(this._stampStart.row, this._stampEnd.row);
    const x2 = Math.max(this._stampStart.col, this._stampEnd.col);
    const y2 = Math.max(this._stampStart.row, this._stampEnd.row);

    const gids = [];
    for (let r = y1; r <= y2; r++) {
      const row = [];
      for (let c = x1; c <= x2; c++) {
        row.push(r * this._columns + c + this._firstgid);
      }
      gids.push(row);
    }
    return { gids, cols: x2 - x1 + 1, rows: y2 - y1 + 1 };
  }

  hasStamp() {
    return this._stampStart !== null && this._stampEnd !== null;
  }
}
