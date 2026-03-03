// --- ObjectEditorCanvas ---
// Renders object definition overlays on the tileset canvas.
// Draws colored outlines per object, collider/node overlays for the selected object.
// Handles click-to-select and Shift+drag to create new objects.

const TILE_SIZE = 16;

const CATEGORY_COLORS = {
  furniture: '#ff9f43',
  structure: '#54a0ff',
  container: '#00d2d3',
  decoration: '#ff6b9d',
  lighting: '#feca57',
  nature: '#10ac84',
  effect: '#c44dff',
};

const NODE_COLORS = {
  sit: '#00ccff',
  item_placement: '#feca57',
  interact: '#ff6b9d',
  spawn: '#10ac84',
  attach: '#c44dff',
};

const NODE_LETTERS = {
  sit: 'S',
  item_placement: 'P',
  interact: 'I',
  spawn: 'W',
  attach: 'A',
};

export class ObjectEditorCanvas {
  constructor(canvasEl, zoomSlider, zoomLabel) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.zoomSlider = zoomSlider;
    this.zoomLabel = zoomLabel;

    this.image = null;
    this.columns = 0;
    this.rows = 0;
    this.zoom = 4;

    this.objectDefs = {};
    this.selectedObjectId = null;
    this.hoveredTile = -1;

    // Tile index → object ID lookup for click-to-select
    this._tileToObject = new Map();

    // Drag state for creating new objects
    this._dragStart = null;
    this._dragCurrent = null;
    this._isDragging = false;

    // Reassign mode — re-select tiles for an existing object
    this._reassignMode = false;
    this._reassignObjectId = null;

    // Wizard mode — selecting tiles for the creation wizard
    this._wizardMode = false;

    // Track whether this canvas is active (controls rendering + events)
    this._active = false;
    this._boundMouseMove = (e) => this._onMouseMove(e);
    this._boundMouseDown = (e) => this._onMouseDown(e);
    this._boundMouseUp = (e) => this._onMouseUp(e);
    this._boundMouseLeave = () => this._onMouseLeave();

    // Callbacks
    this.onObjectSelect = null;
    this.onObjectCreate = null;
    this.onTileReassign = null;
    this.onWizardSelect = null;
  }

  setActive(active) {
    if (this._active === active) return;
    this._active = active;

    if (active) {
      this.canvas.title = 'Click to select an object. Shift+drag to define a new object from tiles.';
      this.canvas.addEventListener('mousemove', this._boundMouseMove);
      this.canvas.addEventListener('mousedown', this._boundMouseDown);
      this.canvas.addEventListener('mouseup', this._boundMouseUp);
      this.canvas.addEventListener('mouseleave', this._boundMouseLeave);

      if (this.zoomSlider) {
        this._boundZoom = (e) => this.setZoom(parseInt(e.target.value, 10));
        this.zoomSlider.addEventListener('input', this._boundZoom);
      }
    } else {
      this.canvas.removeEventListener('mousemove', this._boundMouseMove);
      this.canvas.removeEventListener('mousedown', this._boundMouseDown);
      this.canvas.removeEventListener('mouseup', this._boundMouseUp);
      this.canvas.removeEventListener('mouseleave', this._boundMouseLeave);

      if (this.zoomSlider && this._boundZoom) {
        this.zoomSlider.removeEventListener('input', this._boundZoom);
      }
    }
  }

  loadImage(img, columns, rows) {
    this.image = img;
    this.columns = columns;
    this.rows = rows;
    this.selectedObjectId = null;
    this.hoveredTile = -1;
    this._resize();
  }

  loadDefs(objectDefs) {
    this.objectDefs = objectDefs || {};
    this._buildTileToObjectMap();
    if (this._active) this.render();
  }

  setZoom(z) {
    this.zoom = Math.max(1, Math.min(8, z));
    if (this.zoomSlider) this.zoomSlider.value = this.zoom;
    if (this.zoomLabel) this.zoomLabel.textContent = `${this.zoom}x`;
    this._resize();
    if (this._active) this.render();
  }

  selectObject(objectId) {
    this.selectedObjectId = objectId;
    if (this._active) this.render();
  }

  // Scroll the canvas panel to center on an object
  scrollToObject(objectId) {
    const def = this.objectDefs[objectId];
    if (!def || !def.grid) return;

    // Find the first non-null tile to determine position
    const firstTile = this._findFirstTile(def);
    if (firstTile < 0) return;

    const col = firstTile % this.columns;
    const row = Math.floor(firstTile / this.columns);
    const s = TILE_SIZE * this.zoom;
    const centerX = (col + def.grid.cols / 2) * s;
    const centerY = (row + def.grid.rows / 2) * s;

    const panel = this.canvas.parentElement;
    if (panel) {
      panel.scrollLeft = centerX - panel.clientWidth / 2;
      panel.scrollTop = centerY - panel.clientHeight / 2;
    }
  }

  // --- Reassign mode ---

  enterReassignMode(objectId) {
    this._reassignMode = true;
    this._reassignObjectId = objectId;
    this.canvas.style.cursor = 'copy';
    this.canvas.title = 'Drag to select new tiles for the current object';
    if (this._active) this.render();
  }

  exitReassignMode() {
    this._reassignMode = false;
    this._reassignObjectId = null;
    this._isDragging = false;
    this._dragStart = null;
    this._dragCurrent = null;
    this.canvas.style.cursor = 'crosshair';
    this.canvas.title = 'Click to select an object. Shift+drag to define a new object from tiles.';
    if (this._active) this.render();
  }

  isInReassignMode() {
    return this._reassignMode;
  }

  // --- Wizard mode ---

  enterWizardMode() {
    this._wizardMode = true;
    this.canvas.style.cursor = 'copy';
    this.canvas.title = 'Drag to select tiles for the new object';
    if (this._active) this.render();
  }

  exitWizardMode() {
    this._wizardMode = false;
    this._isDragging = false;
    this._dragStart = null;
    this._dragCurrent = null;
    this.canvas.style.cursor = 'crosshair';
    this.canvas.title = 'Click to select an object. Shift+drag to define a new object from tiles.';
    if (this._active) this.render();
  }

  isInWizardMode() {
    return this._wizardMode;
  }

  // --- Internal: build tile → object lookup ---
  _buildTileToObjectMap() {
    this._tileToObject.clear();
    for (const [objId, def] of Object.entries(this.objectDefs)) {
      if (!def.grid || !def.grid.tiles) continue;
      for (const row of def.grid.tiles) {
        for (const tileIdx of row) {
          if (tileIdx !== null && tileIdx !== undefined) {
            this._tileToObject.set(tileIdx, objId);
          }
        }
      }
    }
  }

  _findFirstTile(def) {
    for (const row of def.grid.tiles) {
      for (const tileIdx of row) {
        if (tileIdx !== null && tileIdx !== undefined) return tileIdx;
      }
    }
    return -1;
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

    // 1. Tileset image
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0, canvas.width, canvas.height);

    // 2. Object outlines (all objects)
    this._drawObjectOutlines();

    // 3. Grid
    this._drawGrid();

    // 4. Selected object detail overlays
    if (this.selectedObjectId && this.objectDefs[this.selectedObjectId]) {
      const def = this.objectDefs[this.selectedObjectId];
      this._drawSelectedHighlight(def);
      this._drawColliders(def);
      this._drawNodes(def);
    }

    // 5. Drag rect
    this._drawDragRect();

    // 6. Hover
    this._drawHover();

    // 7. Mode banners
    if (this._reassignMode) this._drawModeBanner(`Draw new tiles for: ${this._reassignObjectId}`, '#ff9f43');
    if (this._wizardMode) this._drawModeBanner('Draw a rectangle to select object tiles', '#00ccff');
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

  _drawObjectOutlines() {
    const { ctx, zoom, columns } = this;
    const s = TILE_SIZE * zoom;

    for (const [objId, def] of Object.entries(this.objectDefs)) {
      if (!def.grid || !def.grid.tiles) continue;
      if (objId === this.selectedObjectId) continue; // drawn separately

      const color = CATEGORY_COLORS[def.category] || '#888888';

      // Draw semi-transparent fill over each tile
      ctx.fillStyle = this._hexToRgba(color, 0.15);
      for (const row of def.grid.tiles) {
        for (const tileIdx of row) {
          if (tileIdx === null || tileIdx === undefined) continue;
          const col = tileIdx % columns;
          const r = Math.floor(tileIdx / columns);
          ctx.fillRect(col * s, r * s, s, s);
        }
      }

      // Draw bounding box
      const bounds = this._getObjectBounds(def);
      if (bounds) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(
          bounds.x * s + 0.5,
          bounds.y * s + 0.5,
          bounds.w * s - 1,
          bounds.h * s - 1,
        );
      }
    }
  }

  _drawSelectedHighlight(def) {
    const { ctx, zoom, columns } = this;
    const s = TILE_SIZE * zoom;
    const color = CATEGORY_COLORS[def.category] || '#888888';

    // Brighter fill
    ctx.fillStyle = this._hexToRgba(color, 0.3);
    for (const row of def.grid.tiles) {
      for (const tileIdx of row) {
        if (tileIdx === null || tileIdx === undefined) continue;
        const col = tileIdx % columns;
        const r = Math.floor(tileIdx / columns);
        ctx.fillRect(col * s, r * s, s, s);
      }
    }

    // Thick bounding box
    const bounds = this._getObjectBounds(def);
    if (bounds) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        bounds.x * s + 1,
        bounds.y * s + 1,
        bounds.w * s - 2,
        bounds.h * s - 2,
      );
    }
  }

  _drawColliders(def) {
    const { ctx, zoom } = this;
    if (!def.colliders || !def.colliders.length) return;

    // Object origin on tileset (top-left tile position)
    const origin = this._getObjectOrigin(def);
    if (!origin) return;

    for (const collider of def.colliders) {
      const cx = (origin.col * TILE_SIZE + collider.x) * zoom;
      const cy = (origin.row * TILE_SIZE + collider.y) * zoom;
      const cw = collider.width * zoom;
      const ch = collider.height * zoom;

      ctx.strokeStyle = collider.type === 'solid' ? '#ff4444' : '#44ff44';
      ctx.lineWidth = 2;
      ctx.setLineDash([4 * Math.max(1, zoom / 2), 4 * Math.max(1, zoom / 2)]);

      if (collider.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(cx + cw / 2, cy + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(cx, cy, cw, ch);
      }

      ctx.setLineDash([]);

      // Label
      const fontSize = Math.max(9, zoom * 2.5);
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(collider.id, cx + 2, cy - 3);
    }
  }

  _drawNodes(def) {
    const { ctx, zoom } = this;
    if (!def.nodes || !def.nodes.length) return;

    const origin = this._getObjectOrigin(def);
    if (!origin) return;

    const radius = Math.max(4, zoom * 1.5);

    for (const node of def.nodes) {
      const nx = (origin.col * TILE_SIZE + node.x) * zoom;
      const ny = (origin.row * TILE_SIZE + node.y) * zoom;
      const color = NODE_COLORS[node.type] || '#ffffff';
      const letter = NODE_LETTERS[node.type] || '?';

      // Circle
      ctx.beginPath();
      ctx.arc(nx, ny, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Letter
      const fontSize = Math.max(8, zoom * 2);
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.fillStyle = '#1a1a2e';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, nx, ny);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
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

  _drawModeBanner(text, color) {
    const { ctx, canvas } = this;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(0, 0, canvas.width, 24);
    ctx.globalAlpha = 1;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillText(text, 8, 16);
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

  // --- Geometry helpers ---

  _getObjectBounds(def) {
    let minCol = Infinity, minRow = Infinity, maxCol = -1, maxRow = -1;
    for (const row of def.grid.tiles) {
      for (const tileIdx of row) {
        if (tileIdx === null || tileIdx === undefined) continue;
        const col = tileIdx % this.columns;
        const r = Math.floor(tileIdx / this.columns);
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
        if (r < minRow) minRow = r;
        if (r > maxRow) maxRow = r;
      }
    }
    if (maxCol < 0) return null;
    return { x: minCol, y: minRow, w: maxCol - minCol + 1, h: maxRow - minRow + 1 };
  }

  _getObjectOrigin(def) {
    const firstTile = this._findFirstTile(def);
    if (firstTile < 0) return null;

    // The origin is the top-left of the grid, derived from the first tile minus its grid position
    let firstTileRow = -1, firstTileCol = -1;
    outer:
    for (let r = 0; r < def.grid.tiles.length; r++) {
      for (let c = 0; c < def.grid.tiles[r].length; c++) {
        if (def.grid.tiles[r][c] !== null && def.grid.tiles[r][c] !== undefined) {
          firstTileRow = r;
          firstTileCol = c;
          break outer;
        }
      }
    }

    const tileCol = firstTile % this.columns;
    const tileRow = Math.floor(firstTile / this.columns);
    return {
      col: tileCol - firstTileCol,
      row: tileRow - firstTileRow,
    };
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // --- Mouse interaction ---

  _getTileAt(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const s = TILE_SIZE * this.zoom;
    const col = Math.floor(x / s);
    const row = Math.floor(y / s);
    if (col < 0 || col >= this.columns || row < 0 || row >= this.rows) {
      return { id: -1, col: -1, row: -1 };
    }
    return { id: row * this.columns + col, col, row };
  }

  _onMouseMove(e) {
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
    const { id, col, row } = this._getTileAt(e);
    if (id < 0) return;

    // Reassign or wizard mode: any click starts drag
    if (this._reassignMode || this._wizardMode) {
      this._isDragging = true;
      this._dragStart = { col, row };
      this._dragCurrent = { col, row };
      return;
    }

    // Shift+click starts drag for creating new objects
    if (e.shiftKey) {
      this._isDragging = true;
      this._dragStart = { col, row };
      this._dragCurrent = { col, row };
      return;
    }

    // Normal click: select the object at this tile
    const objectId = this._tileToObject.get(id);
    if (objectId && objectId !== this.selectedObjectId) {
      this.selectedObjectId = objectId;
      this.render();
      if (this.onObjectSelect) this.onObjectSelect(objectId);
    } else if (!objectId && this.selectedObjectId) {
      // Click on empty tile: deselect
      this.selectedObjectId = null;
      this.render();
      if (this.onObjectSelect) this.onObjectSelect(null);
    }
  }

  _onMouseUp(e) {
    if (!this._isDragging) return;

    const { col, row } = this._getTileAt(e);
    this._dragCurrent = { col, row };
    this._isDragging = false;

    const x1 = Math.min(this._dragStart.col, this._dragCurrent.col);
    const y1 = Math.min(this._dragStart.row, this._dragCurrent.row);
    const x2 = Math.max(this._dragStart.col, this._dragCurrent.col);
    const y2 = Math.max(this._dragStart.row, this._dragCurrent.row);

    this._dragStart = null;
    this._dragCurrent = null;

    // Build tile grid for the selected region
    const cols = x2 - x1 + 1;
    const rows = y2 - y1 + 1;
    const tiles = [];
    for (let r = y1; r <= y2; r++) {
      const tileRow = [];
      for (let c = x1; c <= x2; c++) {
        tileRow.push(r * this.columns + c);
      }
      tiles.push(tileRow);
    }

    if (this._reassignMode) {
      if (this.onTileReassign) {
        this.onTileReassign({
          objectId: this._reassignObjectId,
          cols, rows, tiles,
        });
      }
      this.exitReassignMode();
    } else if (this._wizardMode) {
      if (this.onWizardSelect) {
        this.onWizardSelect({ cols, rows, tiles, originCol: x1, originRow: y1 });
      }
    } else {
      if (this.onObjectCreate) {
        this.onObjectCreate({ cols, rows, tiles, originCol: x1, originRow: y1 });
      }
    }

    this.render();
  }

  _onMouseLeave() {
    if (this._isDragging) return;
    this.hoveredTile = -1;
    this.render();
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
}
