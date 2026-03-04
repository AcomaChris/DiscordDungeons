// --- PropertyPanel ---
// Floating panel showing editable properties for the selected map object.
// Updates live as the user types; commits changes via MoveObjectCommand.

import { MoveObjectCommand } from './CommandStack.js';

export class PropertyPanel {
  constructor(contentEl) {
    this._el = contentEl;
    this._object = null;
    this._mapDocument = null;
    this._build();
  }

  // --- Public API ---

  setContext(mapDocument) {
    this._mapDocument = mapDocument;
  }

  setObject(obj) {
    this._object = obj;
    this._render();
  }

  clear() {
    this._object = null;
    this._render();
  }

  // --- Build DOM ---

  _build() {
    this._el.innerHTML = '';
    this._contentRoot = document.createElement('div');
    this._el.appendChild(this._contentRoot);
    this._render();
  }

  _render() {
    this._contentRoot.innerHTML = '';

    if (!this._object) {
      const hint = document.createElement('div');
      hint.style.cssText = 'color: #7a7aaa; font-size: 0.8rem; padding: 8px;';
      hint.textContent = 'Select an object to view its properties.';
      this._contentRoot.appendChild(hint);
      return;
    }

    const obj = this._object;

    // Type (read-only)
    this._addReadOnlyField('Type', obj.type || '(unnamed)');

    // ID
    this._addReadOnlyField('ID', String(obj.id || ''));

    // Position
    this._addPositionFields(obj);

    // Size
    this._addReadOnlyField('Size', `${obj.width}×${obj.height} px`);

    // Tileset
    if (obj.tilesetName) {
      this._addReadOnlyField('Tileset', obj.tilesetName);
    }

    // Custom properties
    this._addCustomPropertiesSection(obj);
  }

  _addReadOnlyField(label, value) {
    const group = document.createElement('div');
    group.className = 'prop-group';

    const lbl = document.createElement('label');
    lbl.textContent = label;
    group.appendChild(lbl);

    const val = document.createElement('div');
    val.style.cssText = 'font-size: 0.85rem; padding: 4px 0; color: #c0c0d0;';
    val.textContent = value;
    group.appendChild(val);

    this._contentRoot.appendChild(group);
  }

  _addPositionFields(obj) {
    const group = document.createElement('div');
    group.className = 'prop-group';

    const lbl = document.createElement('label');
    lbl.textContent = 'Position';
    group.appendChild(lbl);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 8px;';

    const xInput = this._createNumberInput('X', obj.x, (val) => {
      this._moveObject(val, obj.y);
    });
    const yInput = this._createNumberInput('Y', obj.y, (val) => {
      this._moveObject(obj.x, val);
    });

    row.appendChild(xInput);
    row.appendChild(yInput);
    group.appendChild(row);
    this._contentRoot.appendChild(group);
  }

  _createNumberInput(label, value, onChange) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'flex: 1;';

    const small = document.createElement('span');
    small.style.cssText = 'font-size: 0.7rem; color: #7a7aaa; margin-right: 4px;';
    small.textContent = label;
    wrapper.appendChild(small);

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.style.cssText = 'width: 100%; padding: 2px 4px; background: #1a1a2e; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.8rem;';
    input.addEventListener('change', () => {
      const num = parseInt(input.value, 10);
      if (!isNaN(num)) onChange(num);
    });
    wrapper.appendChild(input);

    return wrapper;
  }

  _moveObject(newX, newY) {
    if (!this._object || !this._mapDocument) return;
    const obj = this._object;
    const oldX = obj.x;
    const oldY = obj.y;
    if (oldX === newX && oldY === newY) return;

    const cmd = new MoveObjectCommand(obj, oldX, oldY, newX, newY);
    this._mapDocument.commandStack.execute(cmd);
    this._render();
  }

  _addCustomPropertiesSection(obj) {
    const header = document.createElement('div');
    header.className = 'prop-group';
    const lbl = document.createElement('label');
    lbl.textContent = 'Custom Properties';
    header.appendChild(lbl);

    // Show existing custom properties
    const props = obj.properties || {};
    const keys = Object.keys(props);

    if (keys.length === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size: 0.75rem; color: #7a7aaa;';
      hint.textContent = 'No custom properties';
      header.appendChild(hint);
    } else {
      for (const key of keys) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-top: 4px;';

        const keyEl = document.createElement('span');
        keyEl.style.cssText = 'font-size: 0.75rem; color: #c0c0d0; min-width: 60px;';
        keyEl.textContent = key;
        row.appendChild(keyEl);

        const valInput = document.createElement('input');
        valInput.value = String(props[key]);
        valInput.style.cssText = 'flex: 1; padding: 2px 4px; background: #1a1a2e; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.8rem;';
        valInput.addEventListener('change', () => {
          obj.properties[key] = valInput.value;
        });
        row.appendChild(valInput);

        header.appendChild(row);
      }
    }

    // Add property button
    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = '+ Add Property';
    addBtn.style.cssText = 'margin-top: 6px; font-size: 0.75rem;';
    addBtn.addEventListener('click', () => {
      const key = prompt('Property name:');
      if (!key) return;
      if (!obj.properties) obj.properties = {};
      obj.properties[key] = '';
      this._render();
    });
    header.appendChild(addBtn);

    this._contentRoot.appendChild(header);
  }
}
