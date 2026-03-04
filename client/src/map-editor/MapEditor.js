// --- MapEditor ---
// Orchestrator for the map editor. Creates components, wires callbacks,
// and manages global editor state.

import './map-editor.css';
import { ViewTransform } from './ViewTransform.js';
import { MapEditorCanvas } from './MapEditorCanvas.js';
import { MapDocument } from './MapDocument.js';
import { FloatingPanel } from './FloatingPanel.js';
import { TilePalette } from './TilePalette.js';
import { LayerPanel } from './LayerPanel.js';
import { ToolBar } from './ToolBar.js';
import { BrushTool } from './tools/BrushTool.js';
import { EraserTool } from './tools/EraserTool.js';
import { RectangleFillTool } from './tools/RectangleFillTool.js';
import { FloodFillTool } from './tools/FloodFillTool.js';
import { LineTool } from './tools/LineTool.js';
import { SelectTool } from './tools/SelectTool.js';
import { ObjectTool } from './tools/ObjectTool.js';
import { ObjectPalette } from './ObjectPalette.js';
import { PropertyPanel } from './PropertyPanel.js';
import { exportToTiledJSON, importFromTiledJSON, downloadJSON } from './MapExporter.js';

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
    this._layerPanel = null;
    this._layerPanelPanel = null;
    this._toolbar = null;

    // Current brush state (set by palette selection)
    this.selectedGid = 0;
    this.selectedStamp = null; // {gids[][], cols, rows}
    this.activeLayerName = 'Ground';

    // Object placement state (set by ObjectPalette)
    this.selectedObjectDef = null;
    this.selectedObjectTileset = null;
    this.snapToGrid = true;

    // DOM refs (set in init)
    this._statusCursor = null;
    this._statusZoom = null;
    this._statusLayer = null;
    this._statusInfo = null;
    this._gridToggleBtn = null;
    this._undoBtn = null;
    this._redoBtn = null;
    this._exportBtn = null;
    this._importBtn = null;
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
    this._exportBtn = document.getElementById('export-btn');
    this._importBtn = document.getElementById('import-btn');

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

    // Export / Import buttons
    if (this._exportBtn) {
      this._exportBtn.addEventListener('click', () => this._exportMap());
    }
    if (this._importBtn) {
      this._importBtn.addEventListener('click', () => this._importMap());
    }

    // Create floating panels
    this._createPalette();
    this._createLayerPanel();
    this._createObjectPalette();
    this._createPropertyPanel();

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

    // Create tools
    this._brushTool = new BrushTool(this);
    this._eraserTool = new EraserTool(this);
    this._rectFillTool = new RectangleFillTool(this);
    this._floodFillTool = new FloodFillTool(this);
    this._lineTool = new LineTool(this);
    this._selectTool = new SelectTool(this);
    this._objectTool = new ObjectTool(this);
    this._objectTool.onSelectionChange = (obj) => this._onObjectSelected(obj);

    // ToolBar
    const toolBtnContainer = document.getElementById('tool-buttons');
    if (toolBtnContainer) {
      this._toolbar = new ToolBar(toolBtnContainer, [
        { name: 'Brush', shortcut: 'B', tool: this._brushTool },
        { name: 'Eraser', shortcut: 'E', tool: this._eraserTool },
        { name: 'Rect', shortcut: 'R', tool: this._rectFillTool },
        { name: 'Fill', shortcut: 'G', tool: this._floodFillTool },
        { name: 'Line', shortcut: 'L', tool: this._lineTool },
        { name: 'Select', shortcut: 'S', tool: this._selectTool },
        { name: 'Object', shortcut: 'O', tool: this._objectTool },
      ]);

      this._toolbar.onToolSelect = (tool) => {
        this.canvas.setTool(tool);
      };
    }

    // Default tool: brush
    this.canvas.setTool(this._brushTool);
    if (this._toolbar) this._toolbar.setActiveTool(this._brushTool);
  }

  // --- Layer Panel ---

  _createLayerPanel() {
    this._layerPanelPanel = new FloatingPanel({
      title: 'Layers',
      id: 'layer-panel',
      x: 10,
      y: 50,
      width: 220,
    });

    this._layerPanel = new LayerPanel(this._layerPanelPanel.getContentElement());

    this._layerPanel.onActiveLayerChange = (name) => {
      this.activeLayerName = name;
      this._updateLayerStatus();
      this.canvas.markDirty();
    };

    this._layerPanel.onVisibilityChange = (name, visible) => {
      this.canvas.setLayerVisibility(name, visible);
    };

    this._layerPanel.onOpacityChange = (name, opacity) => {
      this.canvas.setLayerOpacity(name, opacity);
    };

    this._updateLayerStatus();
  }

  // --- Object Palette ---

  _createObjectPalette() {
    this._objectPalettePanel = new FloatingPanel({
      title: 'Objects',
      id: 'object-palette-panel',
      x: window.innerWidth - 300,
      y: 400,
      width: 280,
    });

    this._objectPalette = new ObjectPalette(this._objectPalettePanel.getContentElement());

    this._objectPalette.onObjectSelect = (objectDef, tilesetEntry) => {
      this.selectedObjectDef = objectDef;
      this.selectedObjectTileset = tilesetEntry;
      // Auto-switch to object tool
      this.canvas.setTool(this._objectTool);
      if (this._toolbar) this._toolbar.setActiveTool(this._objectTool);
    };

    this._objectPalette.updateTilesets(this.mapDocument.tilesets);
  }

  // --- Property Panel ---

  _createPropertyPanel() {
    this._propertyPanelPanel = new FloatingPanel({
      title: 'Properties',
      id: 'property-panel',
      x: 10,
      y: 350,
      width: 240,
    });

    this._propertyPanel = new PropertyPanel(this._propertyPanelPanel.getContentElement());
    this._propertyPanel.setContext(this.mapDocument);
  }

  // Update the property panel when an object is selected/deselected
  _onObjectSelected(obj) {
    if (this._propertyPanel) {
      if (obj) {
        this._propertyPanel.setObject(obj);
      } else {
        this._propertyPanel.clear();
      }
    }
  }

  _updateLayerStatus() {
    if (this._statusLayer) {
      this._statusLayer.textContent = `Layer: ${this.activeLayerName}`;
    }
  }

  // --- Tileset Dialog ---

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

      // Update palettes
      this._palette.updateTilesets(this.mapDocument.tilesets);
      if (this._objectPalette) this._objectPalette.updateTilesets(this.mapDocument.tilesets);
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

  // --- Export / Import ---

  _exportMap() {
    const json = exportToTiledJSON(this.mapDocument);
    const filename = `${this.mapDocument.metadata.name || 'map'}.json`;
    downloadJSON(json, filename);
    this.showToast('Map exported');
  }

  _importMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const { tilesetNames } = importFromTiledJSON(json, this.mapDocument);

        // Load referenced tilesets
        for (const name of tilesetNames) {
          const clean = name.replace(/\.(tsx|png)$/, '').replace(/^tilesets\//, '');
          const alreadyLoaded = this.mapDocument.tilesets.some(ts => ts.name === clean);
          if (!alreadyLoaded) {
            await this._loadTileset(clean);
          }
        }

        // Update UI
        this._palette.updateTilesets(this.mapDocument.tilesets);
        if (this._objectPalette) this._objectPalette.updateTilesets(this.mapDocument.tilesets);
        if (this._layerPanel) this._layerPanel.refresh?.();
        this.canvas.markDirty();

        this.showToast(`Imported: ${file.name}`);
      } catch (err) {
        this.showToast(`Import failed: ${err.message}`);
        console.error('[MapEditor] Import error:', err);
      }
    });
    input.click();
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

    // Ctrl+S: export map
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      this._exportMap();
      return;
    }

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

    // Tool shortcuts
    const toolKeys = {
      b: this._brushTool,
      e: this._eraserTool,
      r: this._rectFillTool,
      g: this._floodFillTool,
      l: this._lineTool,
      s: this._selectTool,
      o: this._objectTool,
    };
    const toolMatch = toolKeys[e.key.toLowerCase()];
    if (toolMatch && !e.ctrlKey && !e.metaKey) {
      this.canvas.setTool(toolMatch);
      if (this._toolbar) this._toolbar.setActiveTool(toolMatch);
      return;
    }

    // 1-7: quick layer switch
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 7 && !e.ctrlKey && !e.metaKey) {
      if (this._layerPanel) this._layerPanel.selectByIndex(num - 1);
      return;
    }
  }
}
