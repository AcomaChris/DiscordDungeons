// --- MapEditorCanvas ---
// Main canvas for the map editor. Handles pan/zoom, resize, grid toggle,
// and dispatches mouse events to the active tool.

import { CanvasRenderer } from './CanvasRenderer.js';

export class MapEditorCanvas {
  constructor(canvasEl, viewTransform) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.view = viewTransform;
    this.renderer = new CanvasRenderer(this.ctx, this.view);

    this.showGrid = true;
    this.activeTool = null;
    this.mapDocument = null;

    // Pan state
    this._isPanning = false;
    this._panStart = null;
    this._spaceHeld = false;

    // Cursor position (tile coords, for status bar)
    this.cursorTile = { x: 0, y: 0 };
    this.onCursorMove = null;

    // Dirty flag for render loop
    this._dirty = true;
    this._animFrame = null;

    // Layer visibility state (managed by LayerPanel later)
    this._layerVisibility = {};
    this._layerOpacity = {};

    this._bindEvents();
    this._startRenderLoop();
  }

  setDocument(doc) {
    this.mapDocument = doc;
    this._dirty = true;
  }

  setTool(tool) {
    if (this.activeTool) this.activeTool.deactivate();
    this.activeTool = tool;
    if (tool) tool.activate();
    this._dirty = true;
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    this._dirty = true;
    return this.showGrid;
  }

  markDirty() {
    this._dirty = true;
  }

  // --- Event binding ---

  _bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this._onMouseLeave());
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
    window.addEventListener('resize', () => this._resize());

    this._resize();
  }

  _resize() {
    const container = this.canvas.parentElement;
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._dirty = true;
  }

  // --- Mouse events ---

  _getScreenPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  }

  _onMouseDown(e) {
    const { sx, sy } = this._getScreenPos(e);

    // Middle mouse or space+left → start pan
    if (e.button === 1 || (e.button === 0 && this._spaceHeld)) {
      this._isPanning = true;
      this._panStart = { sx, sy, ox: this.view.offsetX, oy: this.view.offsetY };
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    // Left click → tool
    if (e.button === 0 && this.activeTool) {
      const world = this.view.screenToWorld(sx, sy);
      const tile = this.view.screenToTile(sx, sy);
      this.activeTool.onMouseDown(world.x, world.y, tile.tileX, tile.tileY, e);
      this._dirty = true;
    }
  }

  _onMouseMove(e) {
    const { sx, sy } = this._getScreenPos(e);

    // Update cursor tile for status bar
    const tile = this.view.screenToTile(sx, sy);
    if (tile.tileX !== this.cursorTile.x || tile.tileY !== this.cursorTile.y) {
      this.cursorTile = { x: tile.tileX, y: tile.tileY };
      if (this.onCursorMove) this.onCursorMove(this.cursorTile);
    }

    // Panning
    if (this._isPanning && this._panStart) {
      const dx = sx - this._panStart.sx;
      const dy = sy - this._panStart.sy;
      this.view.offsetX = this._panStart.ox - dx / this.view.zoom;
      this.view.offsetY = this._panStart.oy - dy / this.view.zoom;
      this._dirty = true;
      return;
    }

    // Tool
    if (this.activeTool) {
      const world = this.view.screenToWorld(sx, sy);
      this.activeTool.onMouseMove(world.x, world.y, tile.tileX, tile.tileY, e);
      this._dirty = true;
    }
  }

  _onMouseUp(e) {
    if (this._isPanning) {
      this._isPanning = false;
      this._panStart = null;
      this.canvas.style.cursor = this._spaceHeld ? 'grab' : 'crosshair';
      return;
    }

    const { sx, sy } = this._getScreenPos(e);
    if (this.activeTool) {
      const world = this.view.screenToWorld(sx, sy);
      const tile = this.view.screenToTile(sx, sy);
      this.activeTool.onMouseUp(world.x, world.y, tile.tileX, tile.tileY, e);
      this._dirty = true;
    }
  }

  _onMouseLeave() {
    if (this._isPanning) {
      this._isPanning = false;
      this._panStart = null;
      this.canvas.style.cursor = 'crosshair';
    }
  }

  _onWheel(e) {
    e.preventDefault();
    const { sx, sy } = this._getScreenPos(e);
    const zoomFactor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.view.zoomAt(sx, sy, this.view.zoom * zoomFactor);
    this._dirty = true;
    if (this.onZoomChange) this.onZoomChange(this.view.zoom);
  }

  _onKeyDown(e) {
    if (e.code === 'Space' && !this._spaceHeld) {
      this._spaceHeld = true;
      if (!this._isPanning) this.canvas.style.cursor = 'grab';
      e.preventDefault();
    }
    // Pass to tool
    if (this.activeTool) {
      this.activeTool.onKeyDown(e);
      this._dirty = true;
    }
  }

  _onKeyUp(e) {
    if (e.code === 'Space') {
      this._spaceHeld = false;
      if (!this._isPanning) this.canvas.style.cursor = 'crosshair';
    }
    if (this.activeTool) {
      this.activeTool.onKeyUp(e);
    }
  }

  // --- Render loop ---

  _startRenderLoop() {
    const loop = () => {
      if (this._dirty) {
        this._render();
        this._dirty = false;
      }
      this._animFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  _render() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    this.renderer.clear(w, h);

    // Render tile layers (back to front)
    if (this.mapDocument) {
      const layerOrder = ['Ground', 'GroundDecor', 'Walls', 'WallTops', 'Overlay', 'Collision', 'Elevation'];
      const tilesets = this.mapDocument.tilesets;

      for (const name of layerOrder) {
        const layer = this.mapDocument.getLayer(name);
        if (!layer) continue;

        const visibility = this._layerVisibility?.[name];
        if (visibility === false) continue;

        const opacity = this._layerOpacity?.[name] ?? 1.0;
        this.renderer.renderTileLayer(layer, tilesets, w, h, opacity);
      }
    }

    if (this.showGrid) {
      this.renderer.renderGrid(w, h);
    }

    // Tool preview
    if (this.activeTool) {
      this.activeTool.renderPreview(this.ctx, this.view);
    }
  }

  setLayerVisibility(name, visible) {
    this._layerVisibility[name] = visible;
    this._dirty = true;
  }

  setLayerOpacity(name, opacity) {
    this._layerOpacity[name] = opacity;
    this._dirty = true;
  }

  destroy() {
    if (this._animFrame) cancelAnimationFrame(this._animFrame);
  }
}
