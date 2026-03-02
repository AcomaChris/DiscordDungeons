// --- TileEditor ---
// Orchestrates the tile metadata editor: loads tilesets, manages state,
// coordinates canvas and property panel, handles file I/O.

import './tile-editor.css';
import { TileEditorCanvas } from './TileEditorCanvas.js';
import { TileEditorProperties } from './TileEditorProperties.js';
import { TILE_DEFAULTS, isDefaultTile } from '../map/tile-metadata-schema.js';

// AGENT: Tileset names must match filenames in client/public/tilesets/
const PRESET_TILESETS = [
  { name: 'Interior_1st_floor', file: 'Interior_1st_floor.png' },
  { name: 'Exterior', file: 'Exterior.png' },
  { name: 'Walls_interior', file: 'Walls_interior.png' },
  { name: 'Walls_street', file: 'Walls_street.png' },
  { name: 'Interior_2nd_floor', file: 'Interior_2nd_floor.png' },
];

const TILE_SIZE = 16;

class TileEditor {
  constructor() {
    this.tilesetName = null;
    this.metadata = {};       // tileIndex (string) -> property overrides (sparse)
    this.modified = false;
    this._header = null;      // tileset header fields for export

    // DOM references
    this._tilesetSelect = document.getElementById('tileset-select');
    this._importJsonBtn = document.getElementById('import-json-btn');
    this._exportJsonBtn = document.getElementById('export-json-btn');
    this._statusTileset = document.getElementById('status-tileset');
    this._statusSelected = document.getElementById('status-selected');
    this._statusModified = document.getElementById('status-modified');

    // Canvas component
    this.canvas = new TileEditorCanvas(
      document.getElementById('tileset-canvas'),
      document.getElementById('zoom-slider'),
      document.getElementById('zoom-label'),
    );

    // Properties component
    this.properties = new TileEditorProperties(
      document.getElementById('property-panel'),
      document.getElementById('tile-preview'),
    );

    // Wire callbacks
    this.canvas.onSelectionChange = (sel) => this._onSelectionChange(sel);
    this.properties.onPropertyChange = (key, val, sel) => this._onPropertyChange(key, val, sel);
    this.properties.onClearTiles = (sel) => this._onClearTiles(sel);

    this._populateTilesetSelect();
    this._bindEvents();
    this._updateStatus();
  }

  // --- Populate the tileset dropdown ---
  _populateTilesetSelect() {
    // Default "choose" option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select Tileset --';
    this._tilesetSelect.appendChild(defaultOpt);

    for (const ts of PRESET_TILESETS) {
      const opt = document.createElement('option');
      opt.value = ts.name;
      opt.textContent = ts.name.replace(/_/g, ' ');
      this._tilesetSelect.appendChild(opt);
    }
  }

  // --- Event Bindings ---
  _bindEvents() {
    this._tilesetSelect.addEventListener('change', () => {
      const name = this._tilesetSelect.value;
      if (name) this._loadPresetTileset(name);
    });

    this._importJsonBtn.addEventListener('click', () => this._importJson());
    this._exportJsonBtn.addEventListener('click', () => this._exportJson());

    // Warn on unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.modified) {
        e.preventDefault();
      }
    });
  }

  // --- Load a preset tileset ---
  async _loadPresetTileset(name) {
    const preset = PRESET_TILESETS.find((t) => t.name === name);
    if (!preset) return;

    // Check for unsaved changes
    if (this.modified && !confirm('Discard unsaved changes?')) {
      this._tilesetSelect.value = this.tilesetName || '';
      return;
    }

    this.tilesetName = name;
    this.metadata = {};
    this.modified = false;

    // Load tileset image
    const img = new Image();
    img.src = `/tilesets/${preset.file}`;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const columns = img.width / TILE_SIZE;
    const rows = img.height / TILE_SIZE;

    this._header = {
      tileset: name,
      image: `tilesets/${preset.file}`,
      tileSize: TILE_SIZE,
      columns,
      rows,
      tileCount: columns * rows,
      version: 1,
    };

    // Load canvas
    this.canvas.loadImage(img, columns, rows);

    // Try to load existing metadata
    try {
      const res = await fetch(`/tile-metadata/${name}.json`);
      if (res.ok) {
        const json = await res.json();
        if (json.tiles) {
          this.metadata = json.tiles;
          this._header = { ...this._header, ...json, tiles: undefined };
        }
      }
    } catch {
      // No existing metadata — start fresh
    }

    this.canvas.setMetadata(this.metadata);
    this.properties.updateSelection(new Set(), this.metadata, this.canvas);
    this._updateStatus();
  }

  // --- Selection Changed ---
  _onSelectionChange(selection) {
    this.properties.updateSelection(selection, this.metadata, this.canvas);
    this._updateStatus();
  }

  // --- Property Changed ---
  _onPropertyChange(key, value, selection) {
    for (const id of selection) {
      const idStr = String(id);
      if (!this.metadata[idStr]) {
        this.metadata[idStr] = {};
      }
      this.metadata[idStr][key] = value;

      // Clean up: if tile now matches all defaults, remove it
      const fullProps = { ...TILE_DEFAULTS, ...this.metadata[idStr] };
      if (isDefaultTile(fullProps)) {
        delete this.metadata[idStr];
      }
    }

    this.modified = true;
    this.canvas.setMetadata(this.metadata);
    this.properties.updateSelection(this.canvas.selection, this.metadata, this.canvas);
    this._updateStatus();
  }

  // --- Clear Tiles ---
  _onClearTiles(selection) {
    for (const id of selection) {
      delete this.metadata[String(id)];
    }

    this.modified = true;
    this.canvas.setMetadata(this.metadata);
    this.properties.updateSelection(this.canvas.selection, this.metadata, this.canvas);
    this._updateStatus();
  }

  // --- Import JSON ---
  async _importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);

        if (!json.tiles || !json.tileset) {
          alert('Invalid tile metadata JSON: missing "tiles" or "tileset" field.');
          return;
        }

        // If a tileset is loaded, check that names match
        if (this.tilesetName && json.tileset !== this.tilesetName) {
          if (!confirm(`JSON is for "${json.tileset}" but "${this.tilesetName}" is loaded. Import anyway?`)) {
            return;
          }
        }

        // If no tileset loaded yet, try to load the matching one
        if (!this.tilesetName && json.tileset) {
          const preset = PRESET_TILESETS.find((t) => t.name === json.tileset);
          if (preset) {
            await this._loadPresetTileset(json.tileset);
          }
        }

        // Merge tiles
        this.metadata = json.tiles;
        this._header = { ...this._header, ...json, tiles: undefined };
        this.modified = true;
        this.canvas.setMetadata(this.metadata);
        this.properties.updateSelection(this.canvas.selection, this.metadata, this.canvas);
        this._updateStatus();

        // Update dropdown to match
        if (json.tileset) {
          this._tilesetSelect.value = json.tileset;
        }
      } catch (err) {
        alert(`Failed to import JSON: ${err.message}`);
      }
    });
    input.click();
  }

  // --- Export JSON ---
  _exportJson() {
    if (!this.tilesetName) {
      alert('No tileset loaded.');
      return;
    }

    const output = {
      ...this._header,
      tiles: this.metadata,
    };

    const jsonStr = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonStr + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.tilesetName}.json`;
    a.click();

    URL.revokeObjectURL(url);
    this.modified = false;
    this._updateStatus();
  }

  // --- Status Bar ---
  _updateStatus() {
    this._statusTileset.textContent = this.tilesetName
      ? `Tileset: ${this.tilesetName}`
      : 'No tileset loaded';

    this._statusSelected.textContent = this.canvas.selection.size > 0
      ? `${this.canvas.selection.size} selected`
      : '';

    const taggedCount = Object.keys(this.metadata).length;
    this._statusModified.textContent = this.modified
      ? `${taggedCount} tagged (unsaved)`
      : `${taggedCount} tagged`;
  }
}

// --- Bootstrap ---
new TileEditor();
