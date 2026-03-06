// --- ObjectEditorProperties ---
// Full property form for object definitions. Uses collapsible sections
// for basic, grid, rendering, colliders, nodes, parts, and WFC properties.

import {
  OBJECT_CATEGORIES,
  COLLISION_SHAPES,
  COLLISION_TYPES,
  NODE_TYPES,
  DEPTH_MODES,
  validateObjectDef,
} from '../map/object-def-schema.js';
import { TILE_SURFACES } from '../map/tile-metadata-schema.js';
import { COMPONENT_DEFS, TriggerType } from '../objects/ComponentDefs.js';

const TILE_SIZE = 16;

export class ObjectEditorProperties {
  constructor(panelEl, previewEl) {
    this.panel = panelEl;
    this.previewEl = previewEl;

    this.objectDefs = {};
    this.selectedId = null;
    this.socketTypes = [];
    this.canvasComponent = null;

    // Callbacks
    this.onPropertyChange = null;
    this.onDeleteObject = null;
    this.onRenameObject = null;
    this.onDuplicateObject = null;
    this.onMergeObjects = null;

    // Section collapse state (persists across selections)
    this._collapsed = {
      basic: false, grid: false, rendering: false,
      colliders: false, nodes: false,
      parts: true, wfc: true, components: true,
    };
  }

  setSocketTypes(types) {
    this.socketTypes = types || [];
  }

  updateSelection(objectId, objectDefs, canvasComponent, selectedIds) {
    this.selectedId = objectId;
    this.objectDefs = objectDefs;
    this.canvasComponent = canvasComponent;
    this._selectedIds = selectedIds || new Set(objectId ? [objectId] : []);
    this._render();
  }

  _render() {
    this.panel.innerHTML = '';
    this._updatePreview();

    // Multi-select panel (merge UI)
    if (this._selectedIds && this._selectedIds.size > 1) {
      this._renderMultiSelectPanel();
      return;
    }

    if (!this.selectedId || !this.objectDefs[this.selectedId]) {
      const header = document.createElement('h3');
      header.textContent = 'Object Properties';
      this.panel.appendChild(header);

      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.style.height = 'auto';
      empty.style.padding = '32px 0';
      empty.textContent = 'Select an object to edit';
      this.panel.appendChild(empty);
      return;
    }

    const def = this.objectDefs[this.selectedId];

    const header = document.createElement('h3');
    header.textContent = 'Object Properties';
    this.panel.appendChild(header);

    this._renderBasicSection(def);
    this._renderGridSection(def);
    this._renderRenderingSection(def);
    this._renderCollidersSection(def);
    this._renderNodesSection(def);
    this._renderComponentsSection(def);
    this._renderPartsSection(def);
    this._renderWfcSection(def);
    this._renderValidation(def);
    this._renderActions();
  }

  // --- Preview ---

  _updatePreview() {
    if (!this.previewEl) return;
    this.previewEl.innerHTML = '';

    if (!this.selectedId || !this.objectDefs[this.selectedId]) {
      this.previewEl.innerHTML = '<div class="tile-info">No selection</div>';
      return;
    }

    const def = this.objectDefs[this.selectedId];

    // Composite thumbnail — swap tiles when scrubbing an animation frame
    if (this.canvasComponent && def.grid && def.grid.tiles) {
      const thumbCanvas = document.createElement('canvas');
      const cols = def.grid.cols || 1;
      const rows = def.grid.rows || 1;
      const scale = 3;
      thumbCanvas.width = cols * TILE_SIZE * scale;
      thumbCanvas.height = rows * TILE_SIZE * scale;
      thumbCanvas.style.imageRendering = 'pixelated';
      const ctx = thumbCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Build tile-swap map from the current scrub frame
      const frameMap = this._getFrameTileMap(def);

      for (let r = 0; r < def.grid.tiles.length; r++) {
        for (let c = 0; c < def.grid.tiles[r].length; c++) {
          const baseTile = def.grid.tiles[r][c];
          const tileIdx = frameMap && frameMap[baseTile] !== undefined
            ? frameMap[baseTile]
            : baseTile;
          const tileCanvas = this.canvasComponent.getTileImageData(tileIdx);
          if (tileCanvas) {
            ctx.drawImage(tileCanvas, c * TILE_SIZE * scale, r * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
          }
        }
      }
      this.previewEl.appendChild(thumbCanvas);

      // Animation frame scrubber
      if (def.animation && def.animation.frames && def.animation.frames.length > 0) {
        this.previewEl.appendChild(this._buildScrubber(def));
      }
    }

    const info = document.createElement('div');
    info.className = 'tile-info';
    info.innerHTML = `
      <div class="tile-index">${def.name || this.selectedId}</div>
      <div>${this.selectedId}</div>
    `;
    this.previewEl.appendChild(info);
  }

  // Returns a baseTile→frameTile map for the current scrub frame, or null if none
  _getFrameTileMap(def) {
    if (!def.animation || !def.animation.frames) return null;
    const frame = this._scrubFrame || 0;
    const frameData = def.animation.frames[frame];
    if (!frameData || !frameData.tiles) return null;
    return frameData.tiles;
  }

  _buildScrubber(def) {
    const frameCount = def.animation.frames.length;
    const currentFrame = this._scrubFrame || 0;

    const container = document.createElement('div');
    container.className = 'animation-scrubber';

    const label = document.createElement('span');
    label.className = 'frame-label';
    label.textContent = `Frame ${currentFrame + 1} / ${frameCount}`;
    container.appendChild(label);

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '\u25C0';
    prevBtn.title = 'Previous frame';
    prevBtn.addEventListener('click', () => {
      this._scrubFrame = ((currentFrame - 1) + frameCount) % frameCount;
      this._updatePreview();
    });
    container.appendChild(prevBtn);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = frameCount - 1;
    slider.value = currentFrame;
    slider.title = 'Scrub animation frames';
    slider.addEventListener('input', () => {
      this._scrubFrame = parseInt(slider.value, 10);
      this._updatePreview();
    });
    container.appendChild(slider);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '\u25B6';
    nextBtn.title = 'Next frame';
    nextBtn.addEventListener('click', () => {
      this._scrubFrame = (currentFrame + 1) % frameCount;
      this._updatePreview();
    });
    container.appendChild(nextBtn);

    return container;
  }

  // --- Multi-Select Panel ---

  _renderMultiSelectPanel() {
    const header = document.createElement('h3');
    header.textContent = 'Multi-Select';
    this.panel.appendChild(header);

    const info = document.createElement('div');
    info.style.cssText = 'font-size:0.85rem;color:#c0c0e0;margin-bottom:12px';
    info.textContent = `${this._selectedIds.size} objects selected`;
    this.panel.appendChild(info);

    // List selected object names
    const list = document.createElement('div');
    list.style.marginBottom = '12px';
    for (const id of this._selectedIds) {
      const def = this.objectDefs[id];
      const item = document.createElement('div');
      item.style.cssText = 'font-size:0.8rem;color:#c0c0e0;padding:2px 0';
      item.textContent = `${def?.name || id} (${id})`;
      list.appendChild(item);
    }
    this.panel.appendChild(list);

    // Primary indicator
    const primaryInfo = document.createElement('div');
    primaryInfo.style.cssText = 'font-size:0.78rem;color:#7a7aaa;margin-bottom:12px';
    primaryInfo.textContent = `Primary: ${this.selectedId} (properties kept on merge)`;
    this.panel.appendChild(primaryInfo);

    // Merge button
    const mergeBtn = this._makeBtn('Merge Objects', 'btn btn-primary', () => {
      if (!confirm(`Merge ${this._selectedIds.size} objects into "${this.selectedId}"? Non-primary objects will be deleted.`)) return;
      if (this.onMergeObjects) this.onMergeObjects(this.selectedId, this._selectedIds);
    }, 'Combine all selected objects into the primary object, keeping its properties');
    this.panel.appendChild(mergeBtn);
  }

  // --- Section: Basic ---

  _renderBasicSection(def) {
    const { header, body } = this._makeSection('basic', 'Basic');

    // ID (editable — rename on change)
    body.appendChild(this._makeTextInput('ID', this.selectedId, (val) => {
      const newId = val.trim().replace(/\s+/g, '_');
      if (!newId || newId === this.selectedId) return;
      if (this.objectDefs[newId]) {
        alert(`Object "${newId}" already exists.`);
        return;
      }
      if (this.onRenameObject) this.onRenameObject(this.selectedId, newId);
    }, false, 'Unique identifier \u2014 edit to rename this object'));

    // Name
    body.appendChild(this._makeTextInput('Name', def.name || '', (val) => {
      this._emitChange('name', val);
    }, false, 'Display name for this object'));

    // Description
    body.appendChild(this._makeTextarea('Description', def.description || '', (val) => {
      this._emitChange('description', val || undefined);
    }, 'Optional description of what this object is'));

    // Category
    body.appendChild(this._makeSelect('Category', OBJECT_CATEGORIES, def.category || 'decoration', (val) => {
      this._emitChange('category', val);
    }, 'Object category (affects list grouping)'));

    // Surface
    body.appendChild(this._makeSelect('Surface', TILE_SURFACES, def.surface || 'stone', (val) => {
      this._emitChange('surface', val);
    }, 'Surface material (affects step sounds and physics)'));

    // Tags
    body.appendChild(this._makeTagsInput('Tags', def.tags || [], (tags) => {
      this._emitChange('tags', tags);
    }, undefined, 'Add searchable tags (press Enter to add)'));

    // Starting Frame (only for animated objects)
    if (def.animation && def.animation.frames && def.animation.frames.length > 0) {
      body.appendChild(this._makeNumberInput(
        'Starting Frame',
        def.animation.startFrame || 0,
        (val) => {
          this._emitChange('animation', { ...def.animation, startFrame: val });
        },
        0,
        def.animation.frames.length - 1,
        1,
        'Which animation frame the object starts on (0-indexed)',
      ));
    }

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  // --- Section: Grid ---

  _renderGridSection(def) {
    const { header, body } = this._makeSection('grid', 'Grid',
      def.grid ? `${def.grid.cols}\u00d7${def.grid.rows}` : '');

    if (def.grid) {
      const dims = document.createElement('div');
      dims.className = 'prop-group';
      dims.innerHTML = `<label>Dimensions</label>
        <span style="font-size:0.85rem;color:#c0c0e0">${def.grid.cols} cols \u00d7 ${def.grid.rows} rows</span>`;
      body.appendChild(dims);

      // Mini grid preview
      const preview = this._makeGridPreview(def.grid);
      body.appendChild(preview);
    } else {
      const empty = document.createElement('div');
      empty.className = 'prop-group';
      empty.innerHTML = '<span style="color:#7a7aaa;font-size:0.8rem">No grid data</span>';
      body.appendChild(empty);
    }

    // Reassign tiles button
    const inReassign = this.canvasComponent?.isInReassignMode?.();
    const reassignBtn = this._makeBtn(
      inReassign ? 'Cancel Reassign' : 'Reassign Tiles',
      inReassign ? 'btn btn-danger' : 'btn',
      () => {
        if (this.canvasComponent.isInReassignMode()) {
          this.canvasComponent.exitReassignMode();
        } else {
          this.canvasComponent.enterReassignMode(this.selectedId);
        }
        this._render();
      },
      'Re-select tiles on the canvas to redefine this object\'s grid',
    );
    body.appendChild(reassignBtn);

    // Split button
    const inSplit = this.canvasComponent?.isInSplitMode?.();
    const splitBtn = this._makeBtn(
      inSplit ? 'Cancel Split' : 'Split Object',
      inSplit ? 'btn btn-danger' : 'btn',
      () => {
        if (this.canvasComponent.isInSplitMode()) {
          this.canvasComponent.exitSplitMode();
        } else {
          this.canvasComponent.enterSplitMode();
        }
        this._render();
      },
      'Enter split mode to divide this object into two along a tile line',
    );
    body.appendChild(splitBtn);

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  // --- Section: Rendering ---

  _renderRenderingSection(def) {
    const { header, body } = this._makeSection('rendering', 'Rendering');
    const rendering = def.rendering || {};

    body.appendChild(this._makeTextInput('Layer', rendering.layer || 'Walls', (val) => {
      this._emitChange('rendering.layer', val);
    }, false, 'Tiled layer name for rendering (e.g., Walls, Overlay)'));

    body.appendChild(this._makeSelect('Depth Mode', DEPTH_MODES, rendering.depthMode || 'ysort', (val) => {
      this._emitChange('rendering.depthMode', val);
    }, 'ysort: depth based on Y position, fixed: constant depth'));

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  // --- Section: Colliders ---

  _renderCollidersSection(def) {
    const colliders = def.colliders || [];
    const { header, body } = this._makeSection('colliders', 'Colliders', String(colliders.length));

    // Add button
    const addBtn = this._makeBtn('+ Add Collider', 'btn', () => {
      const newCollider = {
        id: `collider_${colliders.length}`,
        shape: 'rect',
        type: 'solid',
        x: 0,
        y: 0,
        width: def.grid ? def.grid.cols * TILE_SIZE : TILE_SIZE,
        height: def.grid ? def.grid.rows * TILE_SIZE : TILE_SIZE,
        elevation: 0,
        stretchable: false,
      };
      this._emitChange('colliders', [...colliders, newCollider]);
    }, 'Add a new collision shape');
    body.appendChild(addBtn);

    for (let i = 0; i < colliders.length; i++) {
      body.appendChild(this._makeColliderCard(colliders, i));
    }

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  _makeColliderCard(colliders, index) {
    const c = colliders[index];
    const card = document.createElement('div');
    card.className = 'item-card';

    // Header with remove button
    const cardHeader = document.createElement('div');
    cardHeader.className = 'item-card-header';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = c.id || `Collider ${index}`;
    cardHeader.appendChild(title);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Delete this collider';
    removeBtn.addEventListener('click', () => {
      const updated = colliders.filter((_, j) => j !== index);
      this._emitChange('colliders', updated);
    });
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    // Fields
    card.appendChild(this._makeTextInput('ID', c.id || '', (val) => {
      this._emitColliderField(colliders, index, 'id', val);
    }, false, 'Unique collider identifier'));

    const row1 = document.createElement('div');
    row1.className = 'inline-fields';
    row1.appendChild(this._makeSelect('Shape', COLLISION_SHAPES, c.shape || 'rect', (val) => {
      this._emitColliderField(colliders, index, 'shape', val);
    }, 'Collision shape: rect or ellipse'));
    row1.appendChild(this._makeSelect('Type', COLLISION_TYPES, c.type || 'solid', (val) => {
      this._emitColliderField(colliders, index, 'type', val);
    }, 'solid: blocks movement, trigger: passable, platform: walkable surface'));
    card.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'inline-fields';
    row2.appendChild(this._makeNumberInput('X', c.x, (val) => {
      this._emitColliderField(colliders, index, 'x', val);
    }, undefined, undefined, undefined, 'Offset from object origin in pixels'));
    row2.appendChild(this._makeNumberInput('Y', c.y, (val) => {
      this._emitColliderField(colliders, index, 'y', val);
    }, undefined, undefined, undefined, 'Offset from object origin in pixels'));
    card.appendChild(row2);

    const row3 = document.createElement('div');
    row3.className = 'inline-fields';
    row3.appendChild(this._makeNumberInput('Width', c.width, (val) => {
      this._emitColliderField(colliders, index, 'width', val);
    }, 1, undefined, undefined, 'Collider width in pixels'));
    row3.appendChild(this._makeNumberInput('Height', c.height, (val) => {
      this._emitColliderField(colliders, index, 'height', val);
    }, 1, undefined, undefined, 'Collider height in pixels'));
    card.appendChild(row3);

    const row4 = document.createElement('div');
    row4.className = 'inline-fields';
    row4.appendChild(this._makeNumberInput('Elevation', c.elevation || 0, (val) => {
      this._emitColliderField(colliders, index, 'elevation', val);
    }, 0, undefined, undefined, 'Height above ground in pixels (0 = ground level)'));
    row4.appendChild(this._makeCheckbox('Stretchable', c.stretchable || false, (val) => {
      this._emitColliderField(colliders, index, 'stretchable', val);
    }, 'Scale this collider when the object is stretched'));
    card.appendChild(row4);

    return card;
  }

  _emitColliderField(colliders, index, field, value) {
    const updated = colliders.map((c, i) => i === index ? { ...c, [field]: value } : c);
    this._emitChange('colliders', updated);
  }

  // --- Section: Nodes ---

  _renderNodesSection(def) {
    const nodes = def.nodes || [];
    const { header, body } = this._makeSection('nodes', 'Nodes', String(nodes.length));

    const addBtn = this._makeBtn('+ Add Node', 'btn', () => {
      const newNode = {
        id: `node_${nodes.length}`,
        type: 'interact',
        x: def.grid ? Math.floor(def.grid.cols * TILE_SIZE / 2) : 8,
        y: def.grid ? Math.floor(def.grid.rows * TILE_SIZE / 2) : 8,
        elevation: 0,
      };
      this._emitChange('nodes', [...nodes, newNode]);
    }, 'Add an interaction point (spawn, sit, interact, etc.)');
    body.appendChild(addBtn);

    for (let i = 0; i < nodes.length; i++) {
      body.appendChild(this._makeNodeCard(nodes, i, def));
    }

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  _makeNodeCard(nodes, index, def) {
    const n = nodes[index];
    const card = document.createElement('div');
    card.className = 'item-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'item-card-header';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = n.id || `Node ${index}`;
    cardHeader.appendChild(title);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Delete this node';
    removeBtn.addEventListener('click', () => {
      const updated = nodes.filter((_, j) => j !== index);
      this._emitChange('nodes', updated);
    });
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    // Fields
    card.appendChild(this._makeTextInput('ID', n.id || '', (val) => {
      this._emitNodeField(nodes, index, 'id', val);
    }, false, 'Unique node identifier'));

    card.appendChild(this._makeSelect('Type', NODE_TYPES, n.type || 'interact', (val) => {
      this._emitNodeField(nodes, index, 'type', val);
    }, 'interact: player action, spawn: start position, sit: seating spot, attach: mount point'));

    const row1 = document.createElement('div');
    row1.className = 'inline-fields';
    row1.appendChild(this._makeNumberInput('X', n.x, (val) => {
      this._emitNodeField(nodes, index, 'x', val);
    }, undefined, undefined, undefined, 'Position offset from object origin in pixels'));
    row1.appendChild(this._makeNumberInput('Y', n.y, (val) => {
      this._emitNodeField(nodes, index, 'y', val);
    }, undefined, undefined, undefined, 'Position offset from object origin in pixels'));
    card.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'inline-fields';
    row2.appendChild(this._makeNumberInput('Elevation', n.elevation || 0, (val) => {
      this._emitNodeField(nodes, index, 'elevation', val);
    }, 0, undefined, undefined, 'Height above ground in pixels'));

    const facingOptions = ['', 'up', 'down', 'left', 'right'];
    row2.appendChild(this._makeSelect('Facing', facingOptions, n.facing || '', (val) => {
      this._emitNodeField(nodes, index, 'facing', val || undefined);
    }, 'Direction this node faces'));
    card.appendChild(row2);

    // Part role (only shown when object has parts)
    if (def.parts && def.parts.roles) {
      const roleNames = ['', ...Object.keys(def.parts.roles)];
      card.appendChild(this._makeSelect('Part Role', roleNames, n.partRole || '', (val) => {
        this._emitNodeField(nodes, index, 'partRole', val || undefined);
      }, 'Assign this node to a part role'));
    }

    return card;
  }

  _emitNodeField(nodes, index, field, value) {
    const updated = nodes.map((n, i) => i === index ? { ...n, [field]: value } : n);
    this._emitChange('nodes', updated);
  }

  // --- Section: Components ---

  _renderComponentsSection(def) {
    const components = def.components || [];
    const { header, body } = this._makeSection('components', 'Components', String(components.length));

    // Add component dropdown
    const addRow = document.createElement('div');
    addRow.className = 'inline-fields';

    const availableIds = Object.keys(COMPONENT_DEFS)
      .filter(id => !components.some(c => c.id === id));

    const select = document.createElement('select');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Select component —';
    select.appendChild(placeholder);
    for (const id of availableIds) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${COMPONENT_DEFS[id].name} (${COMPONENT_DEFS[id].category})`;
      select.appendChild(opt);
    }
    addRow.appendChild(select);

    const addBtn = this._makeBtn('+ Add', 'btn', () => {
      if (!select.value) return;
      const compDef = COMPONENT_DEFS[select.value];
      const newComp = { id: select.value, ...structuredClone(compDef.params) };
      if (compDef.trigger !== TriggerType.INTERACT) {
        newComp.trigger = compDef.trigger;
      }
      this._emitChange('components', [...components, newComp]);
    }, 'Add selected component to this object');
    addRow.appendChild(addBtn);
    body.appendChild(addRow);

    for (let i = 0; i < components.length; i++) {
      body.appendChild(this._makeComponentCard(components, i));
    }

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  _makeComponentCard(components, index) {
    const comp = components[index];
    const compDef = COMPONENT_DEFS[comp.id];
    const card = document.createElement('div');
    card.className = 'item-card';

    // Header
    const cardHeader = document.createElement('div');
    cardHeader.className = 'item-card-header';

    const titleRow = document.createElement('span');
    titleRow.className = 'card-title';
    titleRow.textContent = compDef ? compDef.name : comp.id;

    if (compDef) {
      const badge = document.createElement('span');
      badge.className = 'section-count';
      badge.textContent = compDef.category;
      badge.style.marginLeft = '6px';
      titleRow.appendChild(badge);
    }
    cardHeader.appendChild(titleRow);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Remove this component';
    removeBtn.addEventListener('click', () => {
      const updated = components.filter((_, j) => j !== index);
      this._emitChange('components', updated);
    });
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    // Persistence badge (read-only info)
    if (compDef) {
      const info = document.createElement('div');
      info.style.cssText = 'font-size:0.75rem;color:#7a7aaa;margin-bottom:4px';
      info.textContent = `Persistence: ${compDef.persistence} · Authority: ${compDef.authority}`;
      card.appendChild(info);
    }

    // Trigger select
    const triggerOptions = Object.values(TriggerType);
    const currentTrigger = comp.trigger || (compDef ? compDef.trigger : 'interact');
    card.appendChild(this._makeSelect('Trigger', triggerOptions, currentTrigger, (val) => {
      this._emitComponentField(components, index, 'trigger', val);
    }, 'When this component activates'));

    // Dynamic param editors from the component def
    if (compDef) {
      for (const [key, defaultVal] of Object.entries(compDef.params)) {
        const currentVal = comp[key] !== undefined ? comp[key] : defaultVal;
        card.appendChild(this._makeComponentParamEditor(
          components, index, key, currentVal, defaultVal,
        ));
      }
    }

    return card;
  }

  _makeComponentParamEditor(components, index, key, value, defaultVal) {
    const type = typeof defaultVal;

    if (type === 'boolean') {
      return this._makeCheckbox(key, !!value, (val) => {
        this._emitComponentField(components, index, key, val);
      }, `Component param: ${key}`);
    }

    if (type === 'number') {
      return this._makeNumberInput(key, value ?? 0, (val) => {
        this._emitComponentField(components, index, key, val);
      }, undefined, undefined, undefined, `Component param: ${key}`);
    }

    if (type === 'string') {
      // Multi-line textarea for code param
      if (key === 'code') {
        return this._makeTextarea(key, value || '', (val) => {
          this._emitComponentField(components, index, key, val);
        }, 'Lua script code');
      }
      return this._makeTextInput(key, value || '', (val) => {
        this._emitComponentField(components, index, key, val);
      }, false, `Component param: ${key}`);
    }

    if (Array.isArray(defaultVal)) {
      // JSON textarea for array params (items, drops, lootTable)
      return this._makeTextarea(key, JSON.stringify(value || [], null, 2), (val) => {
        try {
          const parsed = JSON.parse(val);
          this._emitComponentField(components, index, key, parsed);
        } catch (_e) {
          // Invalid JSON — keep current value
        }
      }, `JSON array for ${key}`);
    }

    // null default — text input for optional references (lockId, linkedEvent, etc.)
    if (defaultVal === null) {
      return this._makeTextInput(key, value || '', (val) => {
        this._emitComponentField(components, index, key, val || null);
      }, false, `Component param: ${key} (optional)`);
    }

    // Fallback: text input
    return this._makeTextInput(key, String(value ?? ''), (val) => {
      this._emitComponentField(components, index, key, val);
    }, false, `Component param: ${key}`);
  }

  _emitComponentField(components, index, field, value) {
    const updated = components.map((c, i) => i === index ? { ...c, [field]: value } : c);
    this._emitChange('components', updated);
  }

  // --- Section: Parts ---

  _renderPartsSection(def) {
    const hasParts = def.parts !== null && def.parts !== undefined;
    const { header, body } = this._makeSection('parts', 'Parts', hasParts ? 'enabled' : 'disabled');

    // Enable/disable toggle
    body.appendChild(this._makeCheckbox('Enable Parts', hasParts, (enabled) => {
      if (enabled) {
        const cols = def.grid ? def.grid.cols : 1;
        const rows = def.grid ? def.grid.rows : 1;
        const layout = Array.from({ length: rows }, () => Array(cols).fill('main'));
        this._emitChange('parts', {
          roles: { main: { required: true, repeatable: false } },
          layout,
        });
      } else {
        this._emitChange('parts', null);
      }
    }, 'Enable multi-part composition for this object'));

    if (hasParts && def.parts.roles) {
      // Roles list
      const rolesHeader = document.createElement('div');
      rolesHeader.className = 'prop-group';
      rolesHeader.innerHTML = '<label>Roles</label>';
      body.appendChild(rolesHeader);

      for (const [roleName, role] of Object.entries(def.parts.roles)) {
        body.appendChild(this._makeRoleCard(def, roleName, role));
      }

      // Add role button
      const addRoleBtn = this._makeBtn('+ Add Role', 'btn', () => {
        const newName = `role_${Object.keys(def.parts.roles).length}`;
        const updatedRoles = { ...def.parts.roles, [newName]: { required: true, repeatable: false } };
        this._emitChange('parts', { ...def.parts, roles: updatedRoles });
      }, 'Add a new part role category');
      body.appendChild(addRoleBtn);

      // Layout grid
      if (def.parts.layout) {
        const layoutHeader = document.createElement('div');
        layoutHeader.className = 'prop-group';
        layoutHeader.style.marginTop = '8px';
        layoutHeader.innerHTML = '<label>Layout</label>';
        body.appendChild(layoutHeader);

        const roleNames = Object.keys(def.parts.roles);
        const layoutGrid = document.createElement('div');
        layoutGrid.style.display = 'grid';
        layoutGrid.style.gridTemplateColumns = `repeat(${def.grid ? def.grid.cols : 1}, 1fr)`;
        layoutGrid.style.gap = '4px';

        for (let r = 0; r < def.parts.layout.length; r++) {
          for (let c = 0; c < def.parts.layout[r].length; c++) {
            const select = document.createElement('select');
            select.style.fontSize = '0.7rem';
            select.style.padding = '2px';
            select.style.background = '#1a1a2e';
            select.style.border = '1px solid #2a2a4a';
            select.style.color = '#e0e0e0';
            select.style.borderRadius = '3px';
            for (const rn of roleNames) {
              const opt = document.createElement('option');
              opt.value = rn;
              opt.textContent = rn;
              select.appendChild(opt);
            }
            select.value = def.parts.layout[r][c] || roleNames[0];
            const row = r, col = c;
            select.addEventListener('change', () => {
              const newLayout = def.parts.layout.map((lr) => [...lr]);
              newLayout[row][col] = select.value;
              this._emitChange('parts', { ...def.parts, layout: newLayout });
            });
            layoutGrid.appendChild(select);
          }
        }
        body.appendChild(layoutGrid);
      }
    }

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  _makeRoleCard(def, roleName, role) {
    const card = document.createElement('div');
    card.className = 'item-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'item-card-header';

    const title = document.createElement('span');
    title.className = 'card-title';
    title.textContent = roleName;
    cardHeader.appendChild(title);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.title = 'Delete this part role';
    removeBtn.addEventListener('click', () => {
      const rest = Object.fromEntries(
        Object.entries(def.parts.roles).filter(([k]) => k !== roleName),
      );
      // Also clean layout references
      const newLayout = def.parts.layout.map((row) =>
        row.map((cell) => cell === roleName ? Object.keys(rest)[0] || 'main' : cell),
      );
      this._emitChange('parts', { ...def.parts, roles: rest, layout: newLayout });
    });
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    const row1 = document.createElement('div');
    row1.className = 'inline-fields';
    row1.appendChild(this._makeCheckbox('Required', role.required, (val) => {
      const updatedRoles = { ...def.parts.roles, [roleName]: { ...role, required: val } };
      this._emitChange('parts', { ...def.parts, roles: updatedRoles });
    }, 'At least one part with this role must be present'));
    row1.appendChild(this._makeCheckbox('Repeatable', role.repeatable || false, (val) => {
      const update = { ...role, repeatable: val };
      if (val && !update.minRepeat) { update.minRepeat = 1; update.maxRepeat = 10; }
      if (!val) { delete update.minRepeat; delete update.maxRepeat; }
      const updatedRoles = { ...def.parts.roles, [roleName]: update };
      this._emitChange('parts', { ...def.parts, roles: updatedRoles });
    }, 'Allow multiple parts with this role'));
    card.appendChild(row1);

    if (role.repeatable) {
      const row2 = document.createElement('div');
      row2.className = 'inline-fields';
      row2.appendChild(this._makeNumberInput('Min Repeat', role.minRepeat || 1, (val) => {
        const updatedRoles = { ...def.parts.roles, [roleName]: { ...role, minRepeat: val } };
        this._emitChange('parts', { ...def.parts, roles: updatedRoles });
      }, 0));
      row2.appendChild(this._makeNumberInput('Max Repeat', role.maxRepeat || 10, (val) => {
        const updatedRoles = { ...def.parts.roles, [roleName]: { ...role, maxRepeat: val } };
        this._emitChange('parts', { ...def.parts, roles: updatedRoles });
      }, 1));
      card.appendChild(row2);
    }

    return card;
  }

  // --- Section: WFC ---

  _renderWfcSection(def) {
    const hasWfc = def.wfc !== null && def.wfc !== undefined;
    const { header, body } = this._makeSection('wfc', 'WFC', hasWfc ? 'enabled' : 'disabled');

    body.appendChild(this._makeCheckbox('Enable WFC', hasWfc, (enabled) => {
      if (enabled) {
        this._emitChange('wfc', {
          edges: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
          clearance: { north: 0, south: 0, east: 0, west: 0 },
          allowedFloors: ['stone'],
          weight: 1.0,
        });
      } else {
        this._emitChange('wfc', null);
      }
    }, 'Enable Wave Function Collapse constraints for procedural placement'));

    if (hasWfc) {
      const wfc = def.wfc;

      // Edges
      const edgeLabel = document.createElement('div');
      edgeLabel.className = 'prop-group';
      edgeLabel.innerHTML = '<label>Edges</label>';
      body.appendChild(edgeLabel);

      const socketOptions = this.socketTypes.length > 0
        ? this.socketTypes.map((s) => s.id || s)
        : ['open_floor', 'wall_face', 'furniture_edge', 'counter_mid', 'counter_end', 'shelf_mount', 'nature_edge', 'stair_entry', 'void'];

      const edgeGrid = document.createElement('div');
      edgeGrid.className = 'inline-fields';
      for (const dir of ['north', 'south', 'east', 'west']) {
        edgeGrid.appendChild(this._makeSelect(
          dir.charAt(0).toUpperCase() + dir.slice(1),
          socketOptions,
          wfc.edges?.[dir] || 'open_floor',
          (val) => {
            this._emitChange('wfc', {
              ...wfc,
              edges: { ...wfc.edges, [dir]: val },
            });
          },
          `Socket type on ${dir} edge \u2014 must match adjacent objects`,
        ));
      }
      body.appendChild(edgeGrid);

      // Clearance
      const clearLabel = document.createElement('div');
      clearLabel.className = 'prop-group';
      clearLabel.innerHTML = '<label>Clearance</label>';
      body.appendChild(clearLabel);

      const clearGrid = document.createElement('div');
      clearGrid.className = 'inline-fields';
      for (const dir of ['north', 'south', 'east', 'west']) {
        clearGrid.appendChild(this._makeNumberInput(
          dir.charAt(0).toUpperCase() + dir.slice(1),
          wfc.clearance?.[dir] || 0,
          (val) => {
            this._emitChange('wfc', {
              ...wfc,
              clearance: { ...wfc.clearance, [dir]: val },
            });
          },
          0, undefined, undefined,
          `Minimum clearance required on ${dir} side in pixels`,
        ));
      }
      body.appendChild(clearGrid);

      // Allowed floors
      body.appendChild(this._makeTagsInput(
        'Allowed Floors',
        wfc.allowedFloors || [],
        (tags) => this._emitChange('wfc', { ...wfc, allowedFloors: tags }),
        TILE_SURFACES,
        'Floor surfaces this object can be placed on (press Enter to add)',
      ));

      // Weight
      body.appendChild(this._makeNumberInput('Weight', wfc.weight || 1.0, (val) => {
        this._emitChange('wfc', { ...wfc, weight: val });
      }, 0, 100, 0.1, 'Probability weight \u2014 higher values make this object more likely to spawn'));
    }

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  // --- Validation ---

  _renderValidation(def) {
    const result = validateObjectDef({ ...def, id: this.selectedId });
    if (result.valid) return;

    const errDiv = document.createElement('div');
    errDiv.className = 'validation-errors';
    const ul = document.createElement('ul');
    for (const err of result.errors) {
      const li = document.createElement('li');
      li.textContent = err;
      ul.appendChild(li);
    }
    errDiv.appendChild(ul);
    this.panel.appendChild(errDiv);
  }

  // --- Actions ---

  _renderActions() {
    const actions = document.createElement('div');
    actions.className = 'action-buttons';

    const dupBtn = this._makeBtn('Duplicate', 'btn', () => {
      if (this.onDuplicateObject) this.onDuplicateObject(this.selectedId);
    }, 'Create a copy of this object with a new ID');
    actions.appendChild(dupBtn);

    const deleteBtn = this._makeBtn('Delete Object', 'btn btn-danger', () => {
      if (!confirm(`Delete object "${this.selectedId}"?`)) return;
      if (this.onDeleteObject) this.onDeleteObject(this.selectedId);
    }, 'Permanently delete this object definition');
    actions.appendChild(deleteBtn);

    this.panel.appendChild(actions);
  }

  // --- DOM Builders ---

  _makeSection(key, title, countText) {
    const header = document.createElement('div');
    header.className = `section-header${this._collapsed[key] ? ' collapsed' : ''}`;

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.alignItems = 'center';

    const h4 = document.createElement('h4');
    h4.textContent = title;
    left.appendChild(h4);

    if (countText) {
      const count = document.createElement('span');
      count.className = 'section-count';
      count.textContent = countText;
      left.appendChild(count);
    }

    const arrow = document.createElement('span');
    arrow.className = 'collapse-arrow';
    arrow.textContent = '\u25BC';

    header.append(left, arrow);

    const body = document.createElement('div');
    body.className = `section-body${this._collapsed[key] ? ' collapsed' : ''}`;

    header.addEventListener('click', () => {
      this._collapsed[key] = !this._collapsed[key];
      header.classList.toggle('collapsed');
      body.classList.toggle('collapsed');
    });

    return { header, body };
  }

  _makeTextInput(label, value, onChange, readonly, tooltip) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    if (readonly) {
      input.readOnly = true;
      input.style.opacity = '0.6';
    }
    if (tooltip) input.title = tooltip;
    if (onChange) {
      input.addEventListener('change', () => onChange(input.value));
    }
    group.appendChild(input);
    return group;
  }

  _makeTextarea(label, value, onChange, tooltip) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.value = value;
    if (tooltip) textarea.title = tooltip;
    if (onChange) {
      textarea.addEventListener('change', () => onChange(textarea.value));
    }
    group.appendChild(textarea);
    return group;
  }

  _makeSelect(label, options, value, onChange, tooltip) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const select = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    }
    select.value = value;
    if (tooltip) select.title = tooltip;
    if (onChange) {
      select.addEventListener('change', () => onChange(select.value));
    }
    group.appendChild(select);
    return group;
  }

  _makeNumberInput(label, value, onChange, min, max, step, tooltip) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    if (min !== undefined) input.min = min;
    if (max !== undefined) input.max = max;
    if (step !== undefined) input.step = step;
    if (tooltip) input.title = tooltip;
    if (onChange) {
      input.addEventListener('change', () => onChange(parseFloat(input.value) || 0));
    }
    group.appendChild(input);
    return group;
  }

  _makeCheckbox(label, checked, onChange, tooltip) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const span = document.createElement('span');
    span.textContent = label;
    if (tooltip) row.title = tooltip;
    if (onChange) {
      input.addEventListener('change', () => onChange(input.checked));
    }
    row.append(input, span);
    group.appendChild(row);
    return group;
  }

  _makeTagsInput(label, tags, onChange, suggestions, tooltip) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    if (tooltip) lbl.title = tooltip;
    group.appendChild(lbl);

    const container = document.createElement('div');
    container.className = 'tags-container';
    for (const tag of tags) {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${tag}<span class="tag-remove">\u00d7</span>`;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        onChange(tags.filter((t) => t !== tag));
      });
      container.appendChild(chip);
    }
    group.appendChild(container);

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Add tag...';
    if (suggestions) {
      const datalist = document.createElement('datalist');
      datalist.id = `tags-dl-${label.replace(/\s/g, '')}`;
      for (const s of suggestions) {
        const opt = document.createElement('option');
        opt.value = s;
        datalist.appendChild(opt);
      }
      group.appendChild(datalist);
      input.setAttribute('list', datalist.id);
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value.trim();
        if (val && !tags.includes(val)) {
          onChange([...tags, val]);
        }
        input.value = '';
      }
    });
    group.appendChild(input);
    return group;
  }

  _makeGridPreview(grid) {
    const wrapper = document.createElement('div');
    wrapper.className = 'prop-group';

    const preview = document.createElement('div');
    preview.className = 'grid-preview';
    preview.style.gridTemplateColumns = `repeat(${grid.cols}, 12px)`;

    for (let r = 0; r < grid.tiles.length; r++) {
      for (let c = 0; c < grid.tiles[r].length; c++) {
        const cell = document.createElement('div');
        cell.className = `grid-cell ${grid.tiles[r][c] !== null ? 'filled' : 'empty'}`;
        preview.appendChild(cell);
      }
    }

    wrapper.appendChild(preview);
    return wrapper;
  }

  _makeBtn(text, cls, onClick, tooltip) {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = text;
    if (tooltip) btn.title = tooltip;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _emitChange(path, value) {
    if (this.onPropertyChange) {
      this.onPropertyChange(this.selectedId, path, value);
    }
  }
}
