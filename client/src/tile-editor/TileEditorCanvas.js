// --- TileEditorCanvas ---
// Renders the tileset grid on a <canvas>, handles mouse interaction
// (hover, select, multi-select, drag-select), and draws visual indicators
// for tagged/selected tiles. Re-renders only on state change.

// @doc-creator-tools 02:Tile Editor > Tile Mode
// Displays the tileset image with a selection overlay. Click tiles to select
// them for property editing. Use the zoom slider for precise work. Shows
// tile index and coordinates for the hovered tile.

const TILE_SIZE = 16;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export class TileEditorCanvas {
  constructor(canvasEl, zoomSlider, zoomLabel) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.zoomSlider = zoomSlider;
    this.zoomLabel = zoomLabel;

    this.image = null;
    this.columns = 0;
    this.rows = 0;
    this.tileCount = 0;
    this.zoom = 4;

    this.hoveredTile = -1;
    this.selection = new Set();
    this.metadata = {};

    // Drag-select state
    this._dragStart = null;
    this._dragCurrent = null;
    this._isDragging = false;

    // Active state — when false, mouse events are no-ops
    this._active = true;

    // Callbacks
    this.onSelectionChange = null;

    this._bindEvents();
  }

  // --- Load a tileset image ---
  loadImage(img, columns, rows) {
    this.image = img;
    this.columns = columns;
    this.rows = rows;
    this.tileCount = columns * rows;
    this.selection.clear();
    this.hoveredTile = -1;
    this._resize();
    this.render();
  }

  setMetadata(metadata) {
    this.metadata = metadata;
    this.render();
  }

  setZoom(z) {
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    if (this.zoomSlider) this.zoomSlider.value = this.zoom;
    if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom}x`;
    this._resize();
    this.render();
  }

  // --- Rendering ---

  _resize() {
    if (!this.image) return;
    const w = this.columns * TILE_SIZE * this.zoom;
    const h = this.rows * TILE_SIZE * this.zoom;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.image) return;

    // Draw tileset image (pixel-perfect)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

    this._drawMetadataIndicators();
    this._drawGrid();
    this._drawSelection();
    this._drawDragRect();
    this._drawHover();
  }

  _drawGrid() {
    const { ctx, columns, rows, zoom } = this;
    const s = TILE_SIZE * zoom;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= columns; x++) {
      ctx.beginPath();
      ctx.moveTo(x * s + 0.5, 0);
      ctx.lineTo(x * s + 0.5, rows * s);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * s + 0.5);
      ctx.lineTo(columns * s, y * s + 0.5);
      ctx.stroke();
    }
  }

  _drawMetadataIndicators() {
    const { ctx, zoom, columns } = this;
    const s = TILE_SIZE * zoom;
    const dotSize = Math.max(3, zoom);

    for (const idStr of Object.keys(this.metadata)) {
      const id = parseInt(idStr, 10);
      const col = id % columns;
      const row = Math.floor(id / columns);
      // Green dot in top-right corner
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(
        (col + 1) * s - dotSize - 1,
        row * s + 1,
        dotSize,
        dotSize,
      );
    }
  }

  _drawSelection() {
    const { ctx, zoom, columns } = this;
    const s = TILE_SIZE * zoom;
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 2;

    for (const id of this.selection) {
      const col = id % columns;
      const row = Math.floor(id / columns);
      ctx.strokeRect(col * s + 1, row * s + 1, s - 2, s - 2);
    }
  }

  _drawDragRect() {
    if (!this._isDragging || !this._dragStart || !this._dragCurrent) return;
    const { ctx, zoom } = this;
    const s = TILE_SIZE * zoom;

    const x1 = Math.min(this._dragStart.col, this._dragCurrent.col);
    const y1 = Math.min(this._dragStart.row, this._dragCurrent.row);
    const x2 = Math.max(this._dragStart.col, this._dragCurrent.col);
    const y2 = Math.max(this._dragStart.row, this._dragCurrent.row);

    ctx.fillStyle = 'rgba(0, 204, 255, 0.15)';
    ctx.fillRect(x1 * s, y1 * s, (x2 - x1 + 1) * s, (y2 - y1 + 1) * s);
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x1 * s + 0.5, y1 * s + 0.5, (x2 - x1 + 1) * s - 1, (y2 - y1 + 1) * s - 1);
  }

  _drawHover() {
    if (this.hoveredTile < 0) return;
    const { ctx, zoom, columns } = this;
    const s = TILE_SIZE * zoom;
    const col = this.hoveredTile % columns;
    const row = Math.floor(this.hoveredTile / columns);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(col * s + 0.5, row * s + 0.5, s - 1, s - 1);
  }

  // --- Mouse → tile mapping ---

  _getTileAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = TILE_SIZE * this.zoom;
    const col = Math.floor(x / s);
    const row = Math.floor(y / s);
    if (col < 0 || col >= this.columns || row < 0 || row >= this.rows) return { id: -1, col: -1, row: -1 };
    return { id: row * this.columns + col, col, row };
  }

  setActive(active) {
    this._active = active;
  }

  // --- Event Handlers ---

  _bindEvents() {
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this._onMouseLeave());

    if (this.zoomSlider) {
      this.zoomSlider.addEventListener('input', (e) => {
        if (!this._active) return;
        this.setZoom(parseInt(e.target.value, 10));
      });
    }
  }

  _onMouseMove(e) {
    if (!this._active) return;
    const { id, col, row } = this._getTileAt(e);

    if (this._isDragging) {
      this._dragCurrent = { col, row };
      this.render();
      return;
    }

    if (id !== this.hoveredTile) {
      this.hoveredTile = id;
      this.render();
    }
  }

  _onMouseDown(e) {
    if (!this._active) return;
    const { id, col, row } = this._getTileAt(e);
    if (id < 0) return;

    if (e.shiftKey) {
      // Toggle individual tile in selection
      if (this.selection.has(id)) {
        this.selection.delete(id);
      } else {
        this.selection.add(id);
      }
      this.render();
      this._emitSelectionChange();
      return;
    }

    // Start drag select
    this._isDragging = true;
    this._dragStart = { col, row };
    this._dragCurrent = { col, row };
  }

  _onMouseUp(e) {
    if (!this._active || !this._isDragging) return;

    const { col, row } = this._getTileAt(e);
    this._dragCurrent = { col, row };
    this._isDragging = false;

    // Calculate selection rectangle
    const x1 = Math.min(this._dragStart.col, this._dragCurrent.col);
    const y1 = Math.min(this._dragStart.row, this._dragCurrent.row);
    const x2 = Math.max(this._dragStart.col, this._dragCurrent.col);
    const y2 = Math.max(this._dragStart.row, this._dragCurrent.row);

    // If single tile (no drag), replace selection; otherwise add rect
    const isSingleClick = x1 === x2 && y1 === y2;

    if (!e.ctrlKey && !e.metaKey) {
      this.selection.clear();
    }

    for (let r = y1; r <= y2; r++) {
      for (let c = x1; c <= x2; c++) {
        if (c >= 0 && c < this.columns && r >= 0 && r < this.rows) {
          const id = r * this.columns + c;
          if (isSingleClick && !e.ctrlKey && !e.metaKey && this.selection.has(id)) {
            // Clicking an already-selected single tile deselects it
          } else {
            this.selection.add(id);
          }
        }
      }
    }

    this._dragStart = null;
    this._dragCurrent = null;
    this.render();
    this._emitSelectionChange();
  }

  _onMouseLeave() {
    if (!this._active || this._isDragging) return;
    this.hoveredTile = -1;
    this.render();
  }

  _emitSelectionChange() {
    if (this.onSelectionChange) {
      this.onSelectionChange(new Set(this.selection));
    }
  }

  // --- Get tile pixel data for preview ---
  getTileImageData(tileIndex) {
    if (!this.image || tileIndex < 0) return null;
    const col = tileIndex % this.columns;
    const row = Math.floor(tileIndex / this.columns);

    const offscreen = document.createElement('canvas');
    offscreen.width = TILE_SIZE;
    offscreen.height = TILE_SIZE;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(
      this.image,
      col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE,
      0, 0, TILE_SIZE, TILE_SIZE,
    );
    return offscreen;
  }

  destroy() {
    this.image = null;
    this.selection.clear();
    this.metadata = {};
  }
}
