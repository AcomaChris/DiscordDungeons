// --- MapEditor ---
// Orchestrator for the map editor. Creates components, wires callbacks,
// and manages global editor state.

import './map-editor.css';
import { ViewTransform } from './ViewTransform.js';
import { MapEditorCanvas } from './MapEditorCanvas.js';
import { MapDocument } from './MapDocument.js';
import { FloatingPanel } from './FloatingPanel.js';
import { TilePalette } from './TilePalette.js';
import { BrushTool } from './tools/BrushTool.js';
import { EraserTool } from './tools/EraserTool.js';

// Known tilesets that can be loaded from the server
const AVAILABLE_TILESETS = [
  'Interior_1st_floor',
  'Walls_interior',
  'Animation_windows_doors',
];

export class MapEditor {
  constructor() {
    this.view = new ViewTransform();
    this.canvas = null;
    this.mapDocument = null;

    // Components
    this._palettePanel = null;
    this._palette = null;

    // Current brush state (set by palette selection)
    this.selectedGid = 0;
    this.selectedStamp = null; // {gids[][], cols, rows}
    this.activeLayerName = 'Ground';

    // DOM refs (set in init)
    this._statusCursor = null;
    this._statusZoom = null;
    this._statusLayer = null;
    this._statusInfo = null;
    this._gridToggleBtn = null;
    this._undoBtn = null;
    this._redoBtn = null;
  }

  init() {
    // Document model
    this.mapDocument = new MapDocument();

    // Canvas
    const canvasEl = document.getElementById('map-canvas');
    this.canvas = new MapEditorCanvas(canvasEl, this.view);
    this.canvas.setDocument(this.mapDocument);

    // Redraw canvas when document changes
    this.mapDocument.addListener(() => this.canvas.markDirty());
    this.mapDocument.commandStack.onChange = () => this.canvas.markDirty();

    // Status bar refs
    this._statusCursor = document.getElementById('status-cursor');
    this._statusZoom = document.getElementById('status-zoom');
    this._statusLayer = document.getElementById('status-layer');
    this._statusInfo = document.getElementById('status-info');

    // Toolbar refs
    this._gridToggleBtn = document.getElementById('grid-toggle-btn');
    this._undoBtn = document.getElementById('undo-btn');
    this._redoBtn = document.getElementById('redo-btn');

    // Wire callbacks
    this.canvas.onCursorMove = (pos) => this._updateCursorStatus(pos);
    this.canvas.onZoomChange = (zoom) => this._updateZoomStatus(zoom);

    // Toolbar buttons
    if (this._gridToggleBtn) {
      this._gridToggleBtn.addEventListener('click', () => {
        const on = this.canvas.toggleGrid();
        this._gridToggleBtn.classList.toggle('active', on);
      });
    }

    // Create floating panels
    this._createPalette();

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => this._onGlobalKeyDown(e));

    // Initial status
    this._updateZoomStatus(this.view.zoom);

    console.log('[MapEditor] Initialized');
  }

  // --- Tile Palette ---

  _createPalette() {
    this._palettePanel = new FloatingPanel({
      title: 'Tile Palette',
      id: 'palette-panel',
      x: window.innerWidth - 300,
      y: 50,
      width: 280,
    });

    this._palette = new TilePalette(this._palettePanel.getContentElement());

    this._palette.onTileSelect = (gid) => {
      this.selectedGid = gid;
      this.selectedStamp = null;
    };

    this._palette.onStampSelect = (gids, cols, rows) => {
      this.selectedGid = 0;
      this.selectedStamp = { gids, cols, rows };
    };

    this._palette.onAddTileset = () => this._showAddTilesetDialog();

    this._palette.updateTilesets(this.mapDocument.tilesets);

    // Default tool: brush
    this._brushTool = new BrushTool(this);
    this._eraserTool = new EraserTool(this);
    this.canvas.setTool(this._brushTool);
  }

  async _showAddTilesetDialog() {
    // Build list of tilesets not yet added
    const loaded = new Set(this.mapDocument.tilesets.map(ts => ts.name));
    const available = AVAILABLE_TILESETS.filter(n => !loaded.has(n));

    if (available.length === 0) {
      this.showToast('All available tilesets are already loaded');
      return;
    }

    // Simple selection via prompt (will be replaced by a proper dialog later)
    const name = available.length === 1
      ? available[0]
      : prompt(`Add tileset:\n${available.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\nEnter name:`);

    if (!name || !available.includes(name)) {
      // Try by number
      const idx = parseInt(name, 10) - 1;
      if (idx >= 0 && idx < available.length) {
        await this._loadTileset(available[idx]);
      }
      return;
    }
    await this._loadTileset(name);
  }

  async _loadTileset(name) {
    try {
      // Load image
      const img = await this._loadImage(`tilesets/${name}.png`);
      const columns = Math.floor(img.naturalWidth / 16);
      const rows = Math.floor(img.naturalHeight / 16);

      // Load tile metadata (optional)
      let metadata = null;
      try {
        const resp = await fetch(`tile-metadata/${name}.json`);
        if (resp.ok) metadata = await resp.json();
      } catch { /* no metadata available */ }

      // Load object defs (optional)
      let objectDefs = null;
      try {
        const resp = await fetch(`object-defs/${name}.objects.json`);
        if (resp.ok) {
          const data = await resp.json();
          objectDefs = data.objects || data;
        }
      } catch { /* no object defs available */ }

      // Add to document
      this.mapDocument.addTileset({
        name,
        image: img,
        imagePath: `tilesets/${name}.png`,
        columns,
        rows,
        tileCount: columns * rows,
        tileWidth: 16,
        tileHeight: 16,
        metadata,
        objectDefs,
      });

      // Update palette
      this._palette.updateTilesets(this.mapDocument.tilesets);
      this.showToast(`Loaded tileset: ${name}`);
    } catch (err) {
      this.showToast(`Failed to load tileset: ${err.message}`);
      console.error('[MapEditor] Tileset load error:', err);
    }
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  // --- Status bar ---

  _updateCursorStatus(pos) {
    if (this._statusCursor) {
      this._statusCursor.textContent = `Tile: ${pos.x}, ${pos.y}`;
    }
  }

  _updateZoomStatus(zoom) {
    if (this._statusZoom) {
      const pct = Math.round(zoom * 100);
      this._statusZoom.textContent = `Zoom: ${pct}%`;
    }
  }

  // --- Toast ---

  showToast(message, durationMs = 2000) {
    const el = document.createElement('div');
    el.className = 'map-editor-toast';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), durationMs);
  }

  // --- Global keyboard shortcuts ---

  _onGlobalKeyDown(e) {
    // Don't intercept when typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // Ctrl+G: toggle grid
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      const on = this.canvas.toggleGrid();
      if (this._gridToggleBtn) this._gridToggleBtn.classList.toggle('active', on);
      return;
    }

    // Ctrl+Z: undo
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
      e.preventDefault();
      if (this.mapDocument && this.mapDocument.commandStack) {
        this.mapDocument.commandStack.undo();
        this.canvas.markDirty();
      }
      return;
    }

    // Ctrl+Shift+Z: redo
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (this.mapDocument && this.mapDocument.commandStack) {
        this.mapDocument.commandStack.redo();
        this.canvas.markDirty();
      }
      return;
    }

    // B: brush tool
    if (e.key === 'b' || e.key === 'B') {
      this.canvas.setTool(this._brushTool);
      return;
    }

    // E: eraser tool
    if (e.key === 'e' || e.key === 'E') {
      this.canvas.setTool(this._eraserTool);
      return;
    }
  }
}
