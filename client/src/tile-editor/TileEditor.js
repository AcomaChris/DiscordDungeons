// --- TileEditor ---
// Orchestrates the tile metadata editor and object definition editor.
// Manages mode switching, loads tilesets, coordinates canvas and property
// panels, handles file I/O for both tile metadata and object definitions.

import './tile-editor.css';
import { TileEditorCanvas } from './TileEditorCanvas.js';
import { TileEditorProperties } from './TileEditorProperties.js';
import { ObjectEditorCanvas } from './ObjectEditorCanvas.js';
import { ObjectEditorList } from './ObjectEditorList.js';
import { ObjectEditorProperties } from './ObjectEditorProperties.js';
import { ObjectCreationWizard } from './ObjectCreationWizard.js';
import { TILE_DEFAULTS, isDefaultTile } from '../map/tile-metadata-schema.js';
import { OBJECT_DEFAULTS } from '../map/object-def-schema.js';

const API_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';

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

    // Object definition state
    this.mode = 'tile';       // 'tile' | 'object'
    this.objectDefs = {};     // objectId -> definition
    this._objectDefsModified = false;
    this._objectDefsHeader = null;
    this._socketTypes = [];

    // Tileset image + dimensions (shared across modes)
    this._tilesetImage = null;
    this._tilesetColumns = 0;
    this._tilesetRows = 0;

    // DOM references
    this._tilesetSelect = document.getElementById('tileset-select');
    this._importJsonBtn = document.getElementById('import-json-btn');
    this._exportJsonBtn = document.getElementById('export-json-btn');
    this._saveGithubBtn = document.getElementById('save-github-btn');
    this._statusTileset = document.getElementById('status-tileset');
    this._statusSelected = document.getElementById('status-selected');
    this._statusModified = document.getElementById('status-modified');
    this._modeTileBtn = document.getElementById('mode-tile-btn');
    this._modeObjectBtn = document.getElementById('mode-object-btn');
    this._objectListPanel = document.getElementById('object-list-panel');

    // --- Tile mode components ---
    this.tileCanvas = new TileEditorCanvas(
      document.getElementById('tileset-canvas'),
      document.getElementById('zoom-slider'),
      document.getElementById('zoom-label'),
    );

    this.tileProperties = new TileEditorProperties(
      document.getElementById('property-panel'),
      document.getElementById('tile-preview'),
    );

    // --- Object mode components ---
    this.objectCanvas = new ObjectEditorCanvas(
      document.getElementById('tileset-canvas'),
      document.getElementById('zoom-slider'),
      document.getElementById('zoom-label'),
    );

    this.objectList = new ObjectEditorList(
      this._objectListPanel,
    );

    this.objectProperties = new ObjectEditorProperties(
      document.getElementById('property-panel'),
      document.getElementById('tile-preview'),
    );

    // Wire tile mode callbacks
    this.tileCanvas.onSelectionChange = (sel) => this._onTileSelectionChange(sel);
    this.tileProperties.onPropertyChange = (key, val, sel) => this._onTilePropertyChange(key, val, sel);
    this.tileProperties.onClearTiles = (sel) => this._onClearTiles(sel);

    // Wire object mode callbacks
    this.objectCanvas.onObjectSelect = (id) => this._onObjectSelect(id);
    this.objectCanvas.onObjectCreate = (info) => this._onObjectCreate(info);
    this.objectCanvas.onTileReassign = (info) => this._onTileReassign(info);
    this.objectList.onObjectSelect = (id) => this._onObjectSelect(id);
    this.objectList.onNewObject = () => this._openObjectWizard();
    this.objectList.onClearAll = () => this._onClearAllObjects();
    this.objectProperties.onPropertyChange = (id, path, val) => this._onObjectPropertyChange(id, path, val);
    this.objectProperties.onDeleteObject = (id) => this._onDeleteObject(id);
    this.objectProperties.onRenameObject = (oldId, newId) => this._onRenameObject(oldId, newId);
    this.objectProperties.onDuplicateObject = (id) => this._onDuplicateObject(id);

    // --- Tooltips ---
    this._tilesetSelect.title = 'Choose a tileset to edit';
    this._modeTileBtn.title = 'Edit individual tile metadata (surface, animation, flags)';
    this._modeObjectBtn.title = 'Define composite objects with collision, nodes, and parts';
    this._importJsonBtn.title = 'Import metadata or object definitions from a JSON file';
    this._exportJsonBtn.title = 'Download current metadata/definitions as JSON';
    this._saveGithubBtn.title = 'Save changes to the GitHub repository';
    document.getElementById('zoom-slider').title = 'Adjust canvas zoom (1x\u20138x)';

    this._populateTilesetSelect();
    this._bindEvents();
    this._setMode('tile');
    this._updateStatus();
  }

  // --- Mode Switching ---

  _setMode(mode) {
    this.mode = mode;

    // Toggle button states
    this._modeTileBtn.classList.toggle('active', mode === 'tile');
    this._modeObjectBtn.classList.toggle('active', mode === 'object');

    // Toggle object list panel
    this._objectListPanel.classList.toggle('hidden', mode !== 'object');

    // Swap active canvas component
    this.tileCanvas.setActive(mode === 'tile');
    this.objectCanvas.setActive(mode === 'object');

    // Rebuild the property panel for the active mode
    if (mode === 'tile') {
      this.tileProperties.updateSelection(
        this.tileCanvas.selection, this.metadata, this.tileCanvas,
      );
    } else {
      this.objectProperties.updateSelection(
        this.objectCanvas.selectedObjectId, this.objectDefs, this.objectCanvas,
      );
    }

    // Force a render on the active canvas
    if (this._tilesetImage) {
      if (mode === 'tile') {
        this.tileCanvas.render();
      } else {
        this.objectCanvas.render();
      }
    }

    this._updateStatus();
  }

  // --- Populate the tileset dropdown ---
  _populateTilesetSelect() {
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

    this._modeTileBtn.addEventListener('click', () => this._setMode('tile'));
    this._modeObjectBtn.addEventListener('click', () => this._setMode('object'));

    this._importJsonBtn.addEventListener('click', () => this._importJson());
    this._exportJsonBtn.addEventListener('click', () => this._exportJson());
    this._saveGithubBtn.addEventListener('click', () => this._saveToGitHub());

    // Warn on unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.modified || this._objectDefsModified) {
        e.preventDefault();
      }
    });
  }

  // --- Load a preset tileset ---
  async _loadPresetTileset(name) {
    const preset = PRESET_TILESETS.find((t) => t.name === name);
    if (!preset) return;

    // Check for unsaved changes in either mode
    if ((this.modified || this._objectDefsModified) && !confirm('Discard unsaved changes?')) {
      this._tilesetSelect.value = this.tilesetName || '';
      return;
    }

    this.tilesetName = name;
    this.metadata = {};
    this.modified = false;
    this.objectDefs = {};
    this._objectDefsModified = false;

    // Load tileset image
    const img = new Image();
    img.src = `/tilesets/${preset.file}`;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const columns = img.width / TILE_SIZE;
    const rows = img.height / TILE_SIZE;

    this._tilesetImage = img;
    this._tilesetColumns = columns;
    this._tilesetRows = rows;

    this._header = {
      tileset: name,
      image: `tilesets/${preset.file}`,
      tileSize: TILE_SIZE,
      columns,
      rows,
      tileCount: columns * rows,
      version: 1,
    };

    // Load both canvases with the image
    this.tileCanvas.loadImage(img, columns, rows);
    this.objectCanvas.loadImage(img, columns, rows);

    // Load tile metadata
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
      // No existing metadata
    }

    this.tileCanvas.setMetadata(this.metadata);

    // Load object definitions
    try {
      const res = await fetch(`/object-defs/${name}.objects.json`);
      if (res.ok) {
        const json = await res.json();
        this.objectDefs = json.objects || {};
        this._objectDefsHeader = { ...json, objects: undefined };
      }
    } catch {
      // No existing object defs
    }

    // Load socket types for WFC dropdowns
    try {
      const res = await fetch('/object-defs/_sockets.json');
      if (res.ok) {
        const json = await res.json();
        this._socketTypes = json.types || [];
        this.objectProperties.setSocketTypes(this._socketTypes);
      }
    } catch {
      // No socket types
    }

    // Update object mode components
    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, img, columns);

    // Refresh the active mode's property panel
    if (this.mode === 'tile') {
      this.tileProperties.updateSelection(new Set(), this.metadata, this.tileCanvas);
    } else {
      this.objectProperties.updateSelection(null, this.objectDefs, this.objectCanvas);
    }

    this._updateStatus();
  }

  // --- Tile Mode: Selection Changed ---
  _onTileSelectionChange(selection) {
    this.tileProperties.updateSelection(selection, this.metadata, this.tileCanvas);
    this._updateStatus();
  }

  // --- Tile Mode: Property Changed ---
  _onTilePropertyChange(key, value, selection) {
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
    this.tileCanvas.setMetadata(this.metadata);
    this.tileProperties.updateSelection(this.tileCanvas.selection, this.metadata, this.tileCanvas);
    this._updateStatus();
  }

  // --- Tile Mode: Clear Tiles ---
  _onClearTiles(selection) {
    for (const id of selection) {
      delete this.metadata[String(id)];
    }

    this.modified = true;
    this.tileCanvas.setMetadata(this.metadata);
    this.tileProperties.updateSelection(this.tileCanvas.selection, this.metadata, this.tileCanvas);
    this._updateStatus();
  }

  // --- Object Mode: Object Selected ---
  _onObjectSelect(objectId) {
    // Sync selection across canvas, list, and properties
    this.objectCanvas.selectObject(objectId);
    this.objectList.selectObject(objectId);
    this.objectProperties.updateSelection(objectId, this.objectDefs, this.objectCanvas);

    if (objectId) {
      this.objectCanvas.scrollToObject(objectId);
    }

    this._updateStatus();
  }

  // --- Object Mode: Object Created (Shift+drag) ---
  _onObjectCreate(info) {
    const { cols, rows, tiles, originCol, originRow } = info;
    const id = `obj_${originCol}_${originRow}`;

    // Don't overwrite existing objects
    if (this.objectDefs[id]) {
      alert(`Object "${id}" already exists at this position.`);
      return;
    }

    this.objectDefs[id] = {
      ...structuredClone(OBJECT_DEFAULTS),
      id,
      name: id.replace(/_/g, ' '),
      grid: { cols, rows, tiles },
    };

    this._objectDefsModified = true;
    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
    this._onObjectSelect(id);
    this._updateStatus();
  }

  // --- Object Mode: Property Changed ---
  _onObjectPropertyChange(objectId, path, value) {
    const def = this.objectDefs[objectId];
    if (!def) return;

    // Apply the change using dot-path notation
    if (path.includes('.')) {
      const parts = path.split('.');
      let target = def;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!target[parts[i]]) target[parts[i]] = {};
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    } else {
      def[path] = value;
    }

    this._objectDefsModified = true;

    // Re-render all components
    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.refreshObject(objectId);
    this.objectProperties.updateSelection(objectId, this.objectDefs, this.objectCanvas);
    this._updateStatus();
  }

  // --- Object Mode: Delete Object ---
  _onDeleteObject(objectId) {
    delete this.objectDefs[objectId];
    this._objectDefsModified = true;

    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
    this.objectProperties.updateSelection(null, this.objectDefs, this.objectCanvas);
    this.objectCanvas.selectObject(null);
    this._updateStatus();
  }

  // --- Object Mode: Rename ---
  _onRenameObject(oldId, newId) {
    const def = this.objectDefs[oldId];
    if (!def) return;

    def.id = newId;
    delete this.objectDefs[oldId];
    this.objectDefs[newId] = def;
    this._objectDefsModified = true;

    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
    this._onObjectSelect(newId);
    this._updateStatus();
  }

  // --- Object Mode: Duplicate ---
  _onDuplicateObject(objectId) {
    const def = this.objectDefs[objectId];
    if (!def) return;

    let newId = `${objectId}_copy`;
    let counter = 1;
    while (this.objectDefs[newId]) {
      newId = `${objectId}_copy${counter++}`;
    }

    const clone = structuredClone(def);
    clone.id = newId;
    clone.name = `${def.name || objectId} (copy)`;

    this.objectDefs[newId] = clone;
    this._objectDefsModified = true;

    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
    this._onObjectSelect(newId);
    this._updateStatus();
  }

  // --- Object Mode: Reassign Tiles ---
  _onTileReassign({ objectId, cols, rows, tiles }) {
    const def = this.objectDefs[objectId];
    if (!def) return;

    def.grid = { cols, rows, tiles };
    this._objectDefsModified = true;

    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
    this.objectProperties.updateSelection(objectId, this.objectDefs, this.objectCanvas);
    this._updateStatus();
  }

  // --- Object Mode: Clear All ---
  _onClearAllObjects() {
    this.objectDefs = {};
    this._objectDefsModified = true;

    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
    this.objectProperties.updateSelection(null, this.objectDefs, this.objectCanvas);
    this.objectCanvas.selectObject(null);
    this._updateStatus();
  }

  // --- Object Mode: New Object Wizard ---
  _openObjectWizard() {
    if (!this._tilesetImage) {
      alert('Load a tileset first.');
      return;
    }

    if (!this._wizard) {
      this._wizard = new ObjectCreationWizard(this.objectCanvas);
      this._wizard.onComplete = (def) => this._onWizardComplete(def);
    }

    this._wizard.setExistingIds(Object.keys(this.objectDefs));
    this._wizard.open();
  }

  _onWizardComplete(def) {
    if (this.objectDefs[def.id]) {
      alert(`Object "${def.id}" already exists.`);
      return;
    }

    this.objectDefs[def.id] = def;
    this._objectDefsModified = true;

    this.objectCanvas.loadDefs(this.objectDefs);
    this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
    this._onObjectSelect(def.id);
    this._updateStatus();
  }

  // --- Import JSON ---
  async _importJson() {
    if (this.mode === 'tile') {
      this._importTileJson();
    } else {
      this._importObjectJson();
    }
  }

  _importTileJson() {
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

        if (this.tilesetName && json.tileset !== this.tilesetName) {
          if (!confirm(`JSON is for "${json.tileset}" but "${this.tilesetName}" is loaded. Import anyway?`)) {
            return;
          }
        }

        if (!this.tilesetName && json.tileset) {
          const preset = PRESET_TILESETS.find((t) => t.name === json.tileset);
          if (preset) {
            await this._loadPresetTileset(json.tileset);
          }
        }

        this.metadata = json.tiles;
        this._header = { ...this._header, ...json, tiles: undefined };
        this.modified = true;
        this.tileCanvas.setMetadata(this.metadata);
        this.tileProperties.updateSelection(this.tileCanvas.selection, this.metadata, this.tileCanvas);
        this._updateStatus();

        if (json.tileset) {
          this._tilesetSelect.value = json.tileset;
        }
      } catch (err) {
        alert(`Failed to import JSON: ${err.message}`);
      }
    });
    input.click();
  }

  _importObjectJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const json = JSON.parse(text);

        if (!json.objects || !json.tileset) {
          alert('Invalid object defs JSON: missing "objects" or "tileset" field.');
          return;
        }

        if (this.tilesetName && json.tileset !== this.tilesetName) {
          if (!confirm(`JSON is for "${json.tileset}" but "${this.tilesetName}" is loaded. Import anyway?`)) {
            return;
          }
        }

        if (!this.tilesetName && json.tileset) {
          const preset = PRESET_TILESETS.find((t) => t.name === json.tileset);
          if (preset) {
            await this._loadPresetTileset(json.tileset);
          }
        }

        this.objectDefs = json.objects;
        this._objectDefsHeader = { ...json, objects: undefined };
        this._objectDefsModified = true;

        this.objectCanvas.loadDefs(this.objectDefs);
        this.objectList.loadDefs(this.objectDefs, this._tilesetImage, this._tilesetColumns);
        this.objectProperties.updateSelection(null, this.objectDefs, this.objectCanvas);
        this._updateStatus();

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

    if (this.mode === 'tile') {
      this._exportTileJson();
    } else {
      this._exportObjectJson();
    }
  }

  _exportTileJson() {
    const output = { ...this._header, tiles: this.metadata };
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

  _exportObjectJson() {
    const output = {
      ...(this._objectDefsHeader || {}),
      version: 1,
      tileset: this.tilesetName,
      objects: this.objectDefs,
    };
    const jsonStr = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonStr + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.tilesetName}.objects.json`;
    a.click();

    URL.revokeObjectURL(url);
    this._objectDefsModified = false;
    this._updateStatus();
  }

  // --- Save to GitHub ---
  async _saveToGitHub() {
    if (!this.tilesetName) {
      alert('No tileset loaded.');
      return;
    }

    if (this.mode === 'tile') {
      await this._saveTileToGitHub();
    } else {
      await this._saveObjectsToGitHub();
    }
  }

  async _saveTileToGitHub() {
    const output = { ...this._header, tiles: this.metadata };
    const jsonStr = JSON.stringify(output, null, 2) + '\n';

    this._saveGithubBtn.disabled = true;
    this._saveGithubBtn.textContent = 'Saving...';

    try {
      const res = await fetch(`${API_URL}/api/tile-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileset: this.tilesetName, content: jsonStr }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Save failed: ${data.error || res.statusText}`);
        return;
      }

      this.modified = false;
      this._updateStatus();
      this._statusModified.textContent += ` (saved ${data.sha.slice(0, 7)})`;
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      this._saveGithubBtn.disabled = false;
      this._saveGithubBtn.textContent = 'Save to GitHub';
    }
  }

  async _saveObjectsToGitHub() {
    const output = {
      ...(this._objectDefsHeader || {}),
      version: 1,
      tileset: this.tilesetName,
      objects: this.objectDefs,
    };
    const jsonStr = JSON.stringify(output, null, 2) + '\n';

    this._saveGithubBtn.disabled = true;
    this._saveGithubBtn.textContent = 'Saving...';

    try {
      const res = await fetch(`${API_URL}/api/object-defs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tileset: this.tilesetName, content: jsonStr }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Save failed: ${data.error || res.statusText}`);
        return;
      }

      this._objectDefsModified = false;
      this._updateStatus();
      this._statusModified.textContent += ` (saved ${data.sha.slice(0, 7)})`;
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      this._saveGithubBtn.disabled = false;
      this._saveGithubBtn.textContent = 'Save to GitHub';
    }
  }

  // --- Status Bar ---
  _updateStatus() {
    this._statusTileset.textContent = this.tilesetName
      ? `Tileset: ${this.tilesetName}`
      : 'No tileset loaded';

    if (this.mode === 'tile') {
      this._statusSelected.textContent = this.tileCanvas.selection.size > 0
        ? `${this.tileCanvas.selection.size} selected`
        : '';

      const taggedCount = Object.keys(this.metadata).length;
      this._statusModified.textContent = this.modified
        ? `${taggedCount} tagged (unsaved)`
        : `${taggedCount} tagged`;
    } else {
      const selectedId = this.objectCanvas.selectedObjectId;
      this._statusSelected.textContent = selectedId
        ? `Selected: ${selectedId}`
        : '';

      const objCount = Object.keys(this.objectDefs).length;
      this._statusModified.textContent = this._objectDefsModified
        ? `${objCount} objects (unsaved)`
        : `${objCount} objects`;
    }
  }
}

// --- Bootstrap ---
new TileEditor();
