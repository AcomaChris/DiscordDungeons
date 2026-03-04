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
    this.selectedObjectIds = new Set();
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

    // Dim assigned tiles overlay
    this._dimAssigned = false;

    // Paint mode — click/drag assigns category via CategoryPainter
    this._paintMode = false;
    this._painter = null;

    // Edge indicator overlay for ConnectionEditor
    this._showEdgeIndicators = false;
    this._edgeObjectId = null;

    // Split mode
    this._splitMode = false;
    this._splitPreview = null;

    // Resize handle state
    this._resizeHandle = null;
    this._resizeStart = null;
    this._resizeCurrent = null;
    this._resizeBounds = null;
    this._isResizing = false;

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
    this.onObjectResize = null;
    this.onObjectSplit = null;
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
    this.selectedObjectIds.clear();
    if (objectId) this.selectedObjectIds.add(objectId);
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

  // --- Dim assigned toggle ---

  setDimAssigned(enabled) {
    this._dimAssigned = enabled;
    if (this._active) this.render();
  }

  isDimAssigned() {
    return this._dimAssigned;
  }

  // --- Paint mode ---

  setPaintMode(painter) {
    this._paintMode = !!painter;
    this._painter = painter || null;
    this.canvas.style.cursor = this._paintMode ? 'pointer' : 'crosshair';
    if (this._active) this.render();
  }

  isInPaintMode() {
    return this._paintMode;
  }

  // --- Split mode ---

  enterSplitMode() {
    this._splitMode = true;
    this._splitPreview = null;
    this.canvas.style.cursor = 'col-resize';
    this.canvas.title = 'Click inside the selected object to split along a tile line. Hold Alt for horizontal split.';
    if (this._active) this.render();
  }

  exitSplitMode() {
    this._splitMode = false;
    this._splitPreview = null;
    this.canvas.style.cursor = 'crosshair';
    this.canvas.title = 'Click to select an object. Shift+drag to define a new object from tiles.';
    if (this._active) this.render();
  }

  isInSplitMode() {
    return this._splitMode;
  }

  // --- Edge indicators ---

  setEdgeIndicators(objectId) {
    this._showEdgeIndicators = !!objectId;
    this._edgeObjectId = objectId || null;
    if (this._active) this.render();
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

    // 2. Dim assigned tiles (darkens tiles already in an object)
    if (this._dimAssigned) this._drawDimOverlay();

    // 3. Object outlines (all objects)
    this._drawObjectOutlines();

    // 4. Grid
    this._drawGrid();

    // 5. Selected object detail overlays
    for (const selId of this.selectedObjectIds) {
      const selDef = this.objectDefs[selId];
      if (!selDef) continue;
      this._drawSelectedHighlight(selDef);
      // Only draw colliders/nodes for primary selection
      if (selId === this.selectedObjectId) {
        this._drawColliders(selDef);
        this._drawNodes(selDef);
      }
    }

    // 5b. Resize handles (single selection only)
    if (this.selectedObjectIds.size === 1 && this.selectedObjectId) {
      const rDef = this.objectDefs[this.selectedObjectId];
      if (rDef) this._drawResizeHandles(rDef);
    }

    // 5c. Edge indicators for ConnectionEditor
    if (this._showEdgeIndicators && this._edgeObjectId) {
      const edgeDef = this.objectDefs[this._edgeObjectId];
      if (edgeDef) this._drawEdgeIndicators(edgeDef);
    }

    // 6. Drag rect
    this._drawDragRect();

    // 6b. Resize preview
    this._drawResizePreview();

    // 7. Hover
    this._drawHover();

    // 7b. Split preview
    this._drawSplitPreview();

    // 8. Mode banners
    if (this._reassignMode) this._drawModeBanner(`Draw new tiles for: ${this._reassignObjectId}`, '#ff9f43');
    if (this._wizardMode) this._drawModeBanner('Draw a rectangle to select object tiles', '#00ccff');
    if (this._paintMode && this._painter?.activeBrush) {
      this._drawModeBanner(`Painting: ${this._painter.activeBrush} — click objects to assign`, '#10ac84');
    }
    if (this._splitMode) {
      this._drawModeBanner('Split mode — click to split object (Alt for horizontal)', '#ff6b9d');
    }
    if (this.selectedObjectIds.size > 1) {
      this._drawModeBanner(`${this.selectedObjectIds.size} objects selected — Ctrl+click to add/remove`, '#c44dff');
    }
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

  _drawDimOverlay() {
    const { ctx, columns, rows, zoom } = this;
    const s = TILE_SIZE * zoom;

    // Darken every tile that's assigned to an object
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const idx = row * columns + col;
        if (this._tileToObject.has(idx)) {
          ctx.fillRect(col * s, row * s, s, s);
        }
      }
    }
  }

  _drawObjectOutlines() {
    const { ctx, zoom, columns } = this;
    const s = TILE_SIZE * zoom;

    for (const [objId, def] of Object.entries(this.objectDefs)) {
      if (!def.grid || !def.grid.tiles) continue;
      if (this.selectedObjectIds.has(objId)) continue; // drawn separately

      const color = CATEGORY_COLORS[def.category] || '#888888';

      // Draw semi-transparent fill over each tile (stronger in paint mode)
      ctx.fillStyle = this._hexToRgba(color, this._paintMode ? 0.35 : 0.15);
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

  _drawEdgeIndicators(def) {
    if (!def.wfc || !def.wfc.edges) return;
    const { ctx, zoom } = this;
    const bounds = this._getObjectBounds(def);
    if (!bounds) return;

    const s = TILE_SIZE * zoom;
    const x = bounds.x * s;
    const y = bounds.y * s;
    const w = bounds.w * s;
    const h = bounds.h * s;
    const stripW = Math.max(3, zoom * 1.5);

    const edgeColors = {
      open_floor: '#444466',
      wall_face: '#54a0ff',
      shelf_mount: '#54a0ff',
      counter_end: '#00d2d3',
      counter_mid: '#00d2d3',
      furniture_edge: '#ff9f43',
      nature_edge: '#10ac84',
      stair_entry: '#feca57',
      void: '#ff4444',
    };

    const edges = def.wfc.edges;
    const fontSize = Math.max(8, zoom * 2);
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textBaseline = 'middle';

    // North strip
    ctx.fillStyle = edgeColors[edges.north] || '#888';
    ctx.fillRect(x, y, w, stripW);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(edges.north.replace(/_/g, ' '), x + w / 2, y + stripW + fontSize / 2 + 1);

    // South strip
    ctx.fillStyle = edgeColors[edges.south] || '#888';
    ctx.fillRect(x, y + h - stripW, w, stripW);
    ctx.fillStyle = '#fff';
    ctx.fillText(edges.south.replace(/_/g, ' '), x + w / 2, y + h - stripW - fontSize / 2 - 1);

    // East strip
    ctx.fillStyle = edgeColors[edges.east] || '#888';
    ctx.fillRect(x + w - stripW, y, stripW, h);

    // West strip
    ctx.fillStyle = edgeColors[edges.west] || '#888';
    ctx.fillRect(x, y, stripW, h);

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // --- Resize handles ---

  _getHandleAt(col, row) {
    if (this.selectedObjectIds.size !== 1 || !this.selectedObjectId) return null;
    const def = this.objectDefs[this.selectedObjectId];
    if (!def) return null;
    const b = this._getObjectBounds(def);
    if (!b) return null;

    const onTop = (row === b.y - 1);
    const onBottom = (row === b.y + b.h);
    const onLeft = (col === b.x - 1);
    const onRight = (col === b.x + b.w);
    const inHRange = (col >= b.x && col < b.x + b.w);
    const inVRange = (row >= b.y && row < b.y + b.h);

    // Corners
    if (onTop && onLeft) return 'nw';
    if (onTop && onRight) return 'ne';
    if (onBottom && onLeft) return 'sw';
    if (onBottom && onRight) return 'se';
    // Edges
    if (onTop && inHRange) return 'n';
    if (onBottom && inHRange) return 's';
    if (onLeft && inVRange) return 'w';
    if (onRight && inVRange) return 'e';
    return null;
  }

  _drawResizeHandles(def) {
    const b = this._getObjectBounds(def);
    if (!b) return;
    const { ctx, zoom } = this;
    const s = TILE_SIZE * zoom;
    const hs = Math.max(6, zoom * 2);

    const positions = [
      { x: b.x * s, y: b.y * s },                               // nw
      { x: (b.x + b.w / 2) * s, y: b.y * s },                   // n
      { x: (b.x + b.w) * s, y: b.y * s },                       // ne
      { x: (b.x + b.w) * s, y: (b.y + b.h / 2) * s },           // e
      { x: (b.x + b.w) * s, y: (b.y + b.h) * s },               // se
      { x: (b.x + b.w / 2) * s, y: (b.y + b.h) * s },           // s
      { x: b.x * s, y: (b.y + b.h) * s },                       // sw
      { x: b.x * s, y: (b.y + b.h / 2) * s },                   // w
    ];

    for (const { x, y } of positions) {
      ctx.fillStyle = '#00ccff';
      ctx.fillRect(x - hs / 2, y - hs / 2, hs, hs);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - hs / 2, y - hs / 2, hs, hs);
    }
  }

  _drawResizePreview() {
    if (!this._isResizing || !this._resizeCurrent) return;
    const { ctx, zoom } = this;
    const s = TILE_SIZE * zoom;
    const b = this._resizeBounds;
    const handle = this._resizeHandle;
    const deltaCol = this._resizeCurrent.col - this._resizeStart.col;
    const deltaRow = this._resizeCurrent.row - this._resizeStart.row;

    let newX = b.x, newY = b.y, newW = b.w, newH = b.h;
    if (handle.includes('n')) { newY += deltaRow; newH -= deltaRow; }
    if (handle.includes('s')) { newH += deltaRow; }
    if (handle.includes('w')) { newX += deltaCol; newW -= deltaCol; }
    if (handle.includes('e')) { newW += deltaCol; }
    if (newW < 1) { newW = 1; newX = b.x; }
    if (newH < 1) { newH = 1; newY = b.y; }

    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(newX * s, newY * s, newW * s, newH * s);
    ctx.setLineDash([]);
  }

  _computeAndEmitResize(endCol, endRow) {
    const b = this._resizeBounds;
    const handle = this._resizeHandle;
    const deltaCol = endCol - this._resizeStart.col;
    const deltaRow = endRow - this._resizeStart.row;

    let newX = b.x, newY = b.y, newW = b.w, newH = b.h;
    if (handle.includes('n')) { newY += deltaRow; newH -= deltaRow; }
    if (handle.includes('s')) { newH += deltaRow; }
    if (handle.includes('w')) { newX += deltaCol; newW -= deltaCol; }
    if (handle.includes('e')) { newW += deltaCol; }
    if (newW < 1) { newW = 1; newX = b.x; }
    if (newH < 1) { newH = 1; newY = b.y; }

    // Clamp to tileset bounds
    newX = Math.max(0, Math.min(newX, this.columns - 1));
    newY = Math.max(0, Math.min(newY, this.rows - 1));
    newW = Math.min(newW, this.columns - newX);
    newH = Math.min(newH, this.rows - newY);

    // Build new tile grid
    const tiles = [];
    for (let r = 0; r < newH; r++) {
      const row = [];
      for (let c = 0; c < newW; c++) {
        row.push((newY + r) * this.columns + (newX + c));
      }
      tiles.push(row);
    }

    if (this.onObjectResize) {
      this.onObjectResize({
        objectId: this.selectedObjectId,
        cols: newW, rows: newH, tiles,
      });
    }
  }

  _drawSplitPreview() {
    if (!this._splitMode || !this._splitPreview) return;
    const { ctx, zoom } = this;
    const s = TILE_SIZE * zoom;
    const { axis, position, bounds } = this._splitPreview;

    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    if (axis === 'v') {
      const x = position * s;
      ctx.beginPath();
      ctx.moveTo(x, bounds.y * s);
      ctx.lineTo(x, (bounds.y + bounds.h) * s);
      ctx.stroke();
    } else {
      const y = position * s;
      ctx.beginPath();
      ctx.moveTo(bounds.x * s, y);
      ctx.lineTo((bounds.x + bounds.w) * s, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Light fill on each half
    ctx.globalAlpha = 0.1;
    if (axis === 'v') {
      ctx.fillStyle = '#ff6b9d';
      ctx.fillRect(bounds.x * s, bounds.y * s, (position - bounds.x) * s, bounds.h * s);
      ctx.fillStyle = '#00ccff';
      ctx.fillRect(position * s, bounds.y * s, (bounds.x + bounds.w - position) * s, bounds.h * s);
    } else {
      ctx.fillStyle = '#ff6b9d';
      ctx.fillRect(bounds.x * s, bounds.y * s, bounds.w * s, (position - bounds.y) * s);
      ctx.fillStyle = '#00ccff';
      ctx.fillRect(bounds.x * s, position * s, bounds.w * s, (bounds.y + bounds.h - position) * s);
    }
    ctx.globalAlpha = 1;
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

    // Split mode: compute preview line
    if (this._splitMode && this.selectedObjectId) {
      const def = this.objectDefs[this.selectedObjectId];
      const bounds = def ? this._getObjectBounds(def) : null;
      this._splitPreview = null;
      if (bounds && col >= bounds.x && col < bounds.x + bounds.w
        && row >= bounds.y && row < bounds.y + bounds.h) {
        const useHorizontal = e.altKey;
        if (useHorizontal && row > bounds.y && bounds.h > 1) {
          this._splitPreview = { axis: 'h', position: row, bounds };
          this.canvas.style.cursor = 'row-resize';
        } else if (!useHorizontal && col > bounds.x && bounds.w > 1) {
          this._splitPreview = { axis: 'v', position: col, bounds };
          this.canvas.style.cursor = 'col-resize';
        }
      }
      this.hoveredTile = id;
      this.render();
      return;
    }

    // Active resize drag
    if (this._isResizing) {
      this._resizeCurrent = { col, row };
      this.render();
      return;
    }

    // Paint mode: drag-paint on mousemove while button is held
    if (this._paintMode && this._isPainting && id >= 0) {
      this._tryPaint(id);
      return;
    }

    if (this._isDragging) {
      this._dragCurrent = { col, row };
      this.render();
      return;
    }

    // Resize handle cursor hint (only for single selection, not in special modes)
    if (!this._reassignMode && !this._wizardMode && !this._paintMode) {
      const handle = this._getHandleAt(col, row);
      if (handle) {
        const cursorMap = {
          n: 'ns-resize', s: 'ns-resize',
          e: 'ew-resize', w: 'ew-resize',
          nw: 'nwse-resize', se: 'nwse-resize',
          ne: 'nesw-resize', sw: 'nesw-resize',
        };
        this.canvas.style.cursor = cursorMap[handle];
      } else if (!this._paintMode) {
        this.canvas.style.cursor = 'crosshair';
      }
    }

    if (id !== this.hoveredTile) {
      this.hoveredTile = id;
      this.render();
    }
  }

  _onMouseDown(e) {
    const { id, col, row } = this._getTileAt(e);
    if (id < 0) return;

    // Split mode: execute split at preview line
    if (this._splitMode && this._splitPreview) {
      if (this.onObjectSplit) {
        this.onObjectSplit({
          objectId: this.selectedObjectId,
          axis: this._splitPreview.axis,
          position: this._splitPreview.position,
        });
      }
      return;
    }

    // Paint mode: click to assign category
    if (this._paintMode) {
      this._isPainting = true;
      this._tryPaint(id);
      return;
    }

    // Reassign or wizard mode: any click starts drag
    if (this._reassignMode || this._wizardMode) {
      this._isDragging = true;
      this._dragStart = { col, row };
      this._dragCurrent = { col, row };
      return;
    }

    // Resize handle: start resize drag
    if (!e.shiftKey && !(e.ctrlKey || e.metaKey)) {
      const handle = this._getHandleAt(col, row);
      if (handle) {
        const def = this.objectDefs[this.selectedObjectId];
        this._isResizing = true;
        this._resizeHandle = handle;
        this._resizeStart = { col, row };
        this._resizeCurrent = { col, row };
        this._resizeBounds = { ...this._getObjectBounds(def) };
        return;
      }
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

    // Ctrl+click: toggle in multi-select
    if ((e.ctrlKey || e.metaKey) && objectId) {
      if (this.selectedObjectIds.has(objectId)) {
        this.selectedObjectIds.delete(objectId);
      } else {
        this.selectedObjectIds.add(objectId);
      }
      this.selectedObjectId = this.selectedObjectIds.size > 0
        ? [...this.selectedObjectIds][0] : null;
      this.render();
      if (this.onObjectSelect) this.onObjectSelect(this.selectedObjectId, this.selectedObjectIds);
      return;
    }

    if (objectId && objectId !== this.selectedObjectId) {
      this.selectedObjectId = objectId;
      this.selectedObjectIds.clear();
      this.selectedObjectIds.add(objectId);
      this.render();
      if (this.onObjectSelect) this.onObjectSelect(objectId, this.selectedObjectIds);
    } else if (!objectId && this.selectedObjectId) {
      // Click on empty tile: deselect
      this.selectedObjectId = null;
      this.selectedObjectIds.clear();
      this.render();
      if (this.onObjectSelect) this.onObjectSelect(null, this.selectedObjectIds);
    }
  }

  _tryPaint(tileId) {
    if (!this._painter) return;
    const changed = this._painter.paintObjectAtTile(tileId, this._tileToObject);
    if (changed) this.render();
  }

  _onMouseUp(e) {
    // Resize completion
    if (this._isResizing) {
      this._isResizing = false;
      const { col, row } = this._getTileAt(e);
      this._computeAndEmitResize(col, row);
      this._resizeHandle = null;
      this._resizeStart = null;
      this._resizeCurrent = null;
      this._resizeBounds = null;
      this.render();
      return;
    }

    if (this._isPainting) {
      this._isPainting = false;
      return;
    }
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
