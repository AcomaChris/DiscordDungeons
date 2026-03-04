// --- MapEditor ---
// Orchestrator for the map editor. Creates components, wires callbacks,
// and manages global editor state.

import './map-editor.css';
import { ViewTransform } from './ViewTransform.js';
import { MapEditorCanvas } from './MapEditorCanvas.js';
import { MapDocument } from './MapDocument.js';

export class MapEditor {
  constructor() {
    this.view = new ViewTransform();
    this.canvas = null;
    this.mapDocument = null;

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
    // Canvas
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

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => this._onGlobalKeyDown(e));

    // Initial status
    this._updateZoomStatus(this.view.zoom);

    console.log('[MapEditor] Initialized');
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
  }
}
