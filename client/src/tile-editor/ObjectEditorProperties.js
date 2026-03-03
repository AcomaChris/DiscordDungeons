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

    // Section collapse state (persists across selections)
    this._collapsed = {
      basic: false, grid: false, rendering: false,
      colliders: false, nodes: false,
      parts: true, wfc: true,
    };
  }

  setSocketTypes(types) {
    this.socketTypes = types || [];
  }

  updateSelection(objectId, objectDefs, canvasComponent) {
    this.selectedId = objectId;
    this.objectDefs = objectDefs;
    this.canvasComponent = canvasComponent;
    this._render();
  }

  _render() {
    this.panel.innerHTML = '';
    this._updatePreview();

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

    // Composite thumbnail
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

      for (let r = 0; r < def.grid.tiles.length; r++) {
        for (let c = 0; c < def.grid.tiles[r].length; c++) {
          const tileCanvas = this.canvasComponent.getTileImageData(def.grid.tiles[r][c]);
          if (tileCanvas) {
            ctx.drawImage(tileCanvas, c * TILE_SIZE * scale, r * TILE_SIZE * scale, TILE_SIZE * scale, TILE_SIZE * scale);
          }
        }
      }
      this.previewEl.appendChild(thumbCanvas);
    }

    const info = document.createElement('div');
    info.className = 'tile-info';
    info.innerHTML = `
      <div class="tile-index">${def.name || this.selectedId}</div>
      <div>${this.selectedId}</div>
    `;
    this.previewEl.appendChild(info);
  }

  // --- Section: Basic ---

  _renderBasicSection(def) {
    const { header, body } = this._makeSection('basic', 'Basic');

    // ID (readonly)
    body.appendChild(this._makeTextInput('ID', this.selectedId, null, true));

    // Name
    body.appendChild(this._makeTextInput('Name', def.name || '', (val) => {
      this._emitChange('name', val);
    }));

    // Description
    body.appendChild(this._makeTextarea('Description', def.description || '', (val) => {
      this._emitChange('description', val || undefined);
    }));

    // Category
    body.appendChild(this._makeSelect('Category', OBJECT_CATEGORIES, def.category || 'decoration', (val) => {
      this._emitChange('category', val);
    }));

    // Surface
    body.appendChild(this._makeSelect('Surface', TILE_SURFACES, def.surface || 'stone', (val) => {
      this._emitChange('surface', val);
    }));

    // Tags
    body.appendChild(this._makeTagsInput('Tags', def.tags || [], (tags) => {
      this._emitChange('tags', tags);
    }));

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

    this.panel.appendChild(header);
    this.panel.appendChild(body);
  }

  // --- Section: Rendering ---

  _renderRenderingSection(def) {
    const { header, body } = this._makeSection('rendering', 'Rendering');
    const rendering = def.rendering || {};

    body.appendChild(this._makeTextInput('Layer', rendering.layer || 'Walls', (val) => {
      this._emitChange('rendering.layer', val);
    }));

    body.appendChild(this._makeSelect('Depth Mode', DEPTH_MODES, rendering.depthMode || 'ysort', (val) => {
      this._emitChange('rendering.depthMode', val);
    }));

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
    });
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
    removeBtn.addEventListener('click', () => {
      const updated = colliders.filter((_, j) => j !== index);
      this._emitChange('colliders', updated);
    });
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    // Fields
    card.appendChild(this._makeTextInput('ID', c.id || '', (val) => {
      this._emitColliderField(colliders, index, 'id', val);
    }));

    const row1 = document.createElement('div');
    row1.className = 'inline-fields';
    row1.appendChild(this._makeSelect('Shape', COLLISION_SHAPES, c.shape || 'rect', (val) => {
      this._emitColliderField(colliders, index, 'shape', val);
    }));
    row1.appendChild(this._makeSelect('Type', COLLISION_TYPES, c.type || 'solid', (val) => {
      this._emitColliderField(colliders, index, 'type', val);
    }));
    card.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'inline-fields';
    row2.appendChild(this._makeNumberInput('X', c.x, (val) => {
      this._emitColliderField(colliders, index, 'x', val);
    }));
    row2.appendChild(this._makeNumberInput('Y', c.y, (val) => {
      this._emitColliderField(colliders, index, 'y', val);
    }));
    card.appendChild(row2);

    const row3 = document.createElement('div');
    row3.className = 'inline-fields';
    row3.appendChild(this._makeNumberInput('Width', c.width, (val) => {
      this._emitColliderField(colliders, index, 'width', val);
    }, 1));
    row3.appendChild(this._makeNumberInput('Height', c.height, (val) => {
      this._emitColliderField(colliders, index, 'height', val);
    }, 1));
    card.appendChild(row3);

    const row4 = document.createElement('div');
    row4.className = 'inline-fields';
    row4.appendChild(this._makeNumberInput('Elevation', c.elevation || 0, (val) => {
      this._emitColliderField(colliders, index, 'elevation', val);
    }, 0));
    row4.appendChild(this._makeCheckbox('Stretchable', c.stretchable || false, (val) => {
      this._emitColliderField(colliders, index, 'stretchable', val);
    }));
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
    });
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
    removeBtn.addEventListener('click', () => {
      const updated = nodes.filter((_, j) => j !== index);
      this._emitChange('nodes', updated);
    });
    cardHeader.appendChild(removeBtn);
    card.appendChild(cardHeader);

    // Fields
    card.appendChild(this._makeTextInput('ID', n.id || '', (val) => {
      this._emitNodeField(nodes, index, 'id', val);
    }));

    card.appendChild(this._makeSelect('Type', NODE_TYPES, n.type || 'interact', (val) => {
      this._emitNodeField(nodes, index, 'type', val);
    }));

    const row1 = document.createElement('div');
    row1.className = 'inline-fields';
    row1.appendChild(this._makeNumberInput('X', n.x, (val) => {
      this._emitNodeField(nodes, index, 'x', val);
    }));
    row1.appendChild(this._makeNumberInput('Y', n.y, (val) => {
      this._emitNodeField(nodes, index, 'y', val);
    }));
    card.appendChild(row1);

    const row2 = document.createElement('div');
    row2.className = 'inline-fields';
    row2.appendChild(this._makeNumberInput('Elevation', n.elevation || 0, (val) => {
      this._emitNodeField(nodes, index, 'elevation', val);
    }, 0));

    const facingOptions = ['', 'up', 'down', 'left', 'right'];
    row2.appendChild(this._makeSelect('Facing', facingOptions, n.facing || '', (val) => {
      this._emitNodeField(nodes, index, 'facing', val || undefined);
    }));
    card.appendChild(row2);

    // Part role (only shown when object has parts)
    if (def.parts && def.parts.roles) {
      const roleNames = ['', ...Object.keys(def.parts.roles)];
      card.appendChild(this._makeSelect('Part Role', roleNames, n.partRole || '', (val) => {
        this._emitNodeField(nodes, index, 'partRole', val || undefined);
      }));
    }

    return card;
  }

  _emitNodeField(nodes, index, field, value) {
    const updated = nodes.map((n, i) => i === index ? { ...n, [field]: value } : n);
    this._emitChange('nodes', updated);
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
    }));

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
      });
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
    }));
    row1.appendChild(this._makeCheckbox('Repeatable', role.repeatable || false, (val) => {
      const update = { ...role, repeatable: val };
      if (val && !update.minRepeat) { update.minRepeat = 1; update.maxRepeat = 10; }
      if (!val) { delete update.minRepeat; delete update.maxRepeat; }
      const updatedRoles = { ...def.parts.roles, [roleName]: update };
      this._emitChange('parts', { ...def.parts, roles: updatedRoles });
    }));
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
    }));

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
          0,
        ));
      }
      body.appendChild(clearGrid);

      // Allowed floors
      body.appendChild(this._makeTagsInput(
        'Allowed Floors',
        wfc.allowedFloors || [],
        (tags) => this._emitChange('wfc', { ...wfc, allowedFloors: tags }),
        TILE_SURFACES,
      ));

      // Weight
      body.appendChild(this._makeNumberInput('Weight', wfc.weight || 1.0, (val) => {
        this._emitChange('wfc', { ...wfc, weight: val });
      }, 0, 100, 0.1));
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

    const deleteBtn = this._makeBtn('Delete Object', 'btn btn-danger', () => {
      if (!confirm(`Delete object "${this.selectedId}"?`)) return;
      if (this.onDeleteObject) this.onDeleteObject(this.selectedId);
    });
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

  _makeTextInput(label, value, onChange, readonly) {
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
    if (onChange) {
      input.addEventListener('change', () => onChange(input.value));
    }
    group.appendChild(input);
    return group;
  }

  _makeTextarea(label, value, onChange) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.value = value;
    if (onChange) {
      textarea.addEventListener('change', () => onChange(textarea.value));
    }
    group.appendChild(textarea);
    return group;
  }

  _makeSelect(label, options, value, onChange) {
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
    if (onChange) {
      select.addEventListener('change', () => onChange(select.value));
    }
    group.appendChild(select);
    return group;
  }

  _makeNumberInput(label, value, onChange, min, max, step) {
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
    if (onChange) {
      input.addEventListener('change', () => onChange(parseFloat(input.value) || 0));
    }
    group.appendChild(input);
    return group;
  }

  _makeCheckbox(label, checked, onChange) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const row = document.createElement('div');
    row.className = 'checkbox-row';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    const span = document.createElement('span');
    span.textContent = label;
    if (onChange) {
      input.addEventListener('change', () => onChange(input.checked));
    }
    row.append(input, span);
    group.appendChild(row);
    return group;
  }

  _makeTagsInput(label, tags, onChange, suggestions) {
    const group = document.createElement('div');
    group.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = label;
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

  _makeBtn(text, cls, onClick) {
    const btn = document.createElement('button');
    btn.className = cls;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _emitChange(path, value) {
    if (this.onPropertyChange) {
      this.onPropertyChange(this.selectedId, path, value);
    }
  }
}
