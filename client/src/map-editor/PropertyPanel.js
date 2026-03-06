// --- PropertyPanel ---
// Floating panel showing editable properties for the selected map object.
// Updates live as the user types; commits changes via MoveObjectCommand.

import { MoveObjectCommand } from './CommandStack.js';
import { COMPONENT_DEFS, TriggerType } from '../objects/ComponentDefs.js';

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

    // Components
    this._addComponentsSection(obj);

    // Connections
    this._addConnectionsSection(obj);

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

  // --- Components Section ---

  _addComponentsSection(obj) {
    if (!obj.properties) obj.properties = {};

    let components = [];
    try {
      components = obj.properties.__components ? JSON.parse(obj.properties.__components) : [];
    } catch (_e) { /* invalid JSON — start fresh */ }

    const section = document.createElement('div');
    section.className = 'prop-group';

    const lbl = document.createElement('label');
    lbl.textContent = `Components (${components.length})`;
    section.appendChild(lbl);

    // Component cards
    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      const compDef = COMPONENT_DEFS[comp.id];
      const card = document.createElement('div');
      card.style.cssText = 'background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 4px; padding: 6px; margin: 4px 0;';

      // Header
      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';
      const title = document.createElement('span');
      title.style.cssText = 'font-size: 0.8rem; font-weight: bold; color: #c0c0e0;';
      title.textContent = compDef ? compDef.name : comp.id;
      header.appendChild(title);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn';
      removeBtn.textContent = 'Remove';
      removeBtn.style.cssText = 'font-size: 0.65rem; padding: 1px 6px;';
      removeBtn.addEventListener('click', () => {
        components.splice(i, 1);
        this._saveComponents(obj, components);
        this._render();
      });
      header.appendChild(removeBtn);
      card.appendChild(header);

      // Trigger select
      const triggerRow = document.createElement('div');
      triggerRow.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-bottom: 4px;';
      const triggerLabel = document.createElement('span');
      triggerLabel.style.cssText = 'font-size: 0.7rem; color: #7a7aaa; min-width: 50px;';
      triggerLabel.textContent = 'Trigger';
      triggerRow.appendChild(triggerLabel);

      const triggerSelect = document.createElement('select');
      triggerSelect.style.cssText = 'flex: 1; padding: 2px; background: #0d0d1a; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.75rem;';
      for (const t of Object.values(TriggerType)) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        triggerSelect.appendChild(opt);
      }
      triggerSelect.value = comp.trigger || (compDef ? compDef.trigger : 'interact');
      triggerSelect.addEventListener('change', () => {
        comp.trigger = triggerSelect.value;
        this._saveComponents(obj, components);
      });
      triggerRow.appendChild(triggerSelect);
      card.appendChild(triggerRow);

      // Param editors
      if (compDef) {
        for (const [key, defaultVal] of Object.entries(compDef.params)) {
          const currentVal = comp[key] !== undefined ? comp[key] : defaultVal;
          const paramRow = document.createElement('div');
          paramRow.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-top: 2px;';

          const paramLabel = document.createElement('span');
          paramLabel.style.cssText = 'font-size: 0.7rem; color: #7a7aaa; min-width: 50px;';
          paramLabel.textContent = key;
          paramRow.appendChild(paramLabel);

          const input = this._createParamInput(key, currentVal, defaultVal, (val) => {
            comp[key] = val;
            this._saveComponents(obj, components);
          });
          paramRow.appendChild(input);
          card.appendChild(paramRow);
        }
      }

      section.appendChild(card);
    }

    // Add component dropdown + button
    const addRow = document.createElement('div');
    addRow.style.cssText = 'display: flex; gap: 4px; margin-top: 6px;';

    const availableIds = Object.keys(COMPONENT_DEFS)
      .filter(id => !components.some(c => c.id === id));

    const select = document.createElement('select');
    select.style.cssText = 'flex: 1; padding: 2px; background: #1a1a2e; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.75rem;';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Add component —';
    select.appendChild(placeholder);
    for (const id of availableIds) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = COMPONENT_DEFS[id].name;
      select.appendChild(opt);
    }
    addRow.appendChild(select);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn';
    addBtn.textContent = '+';
    addBtn.style.cssText = 'font-size: 0.75rem; padding: 2px 8px;';
    addBtn.addEventListener('click', () => {
      if (!select.value) return;
      const compDef = COMPONENT_DEFS[select.value];
      const newComp = { id: select.value, ...structuredClone(compDef.params) };
      if (compDef.trigger !== TriggerType.INTERACT) {
        newComp.trigger = compDef.trigger;
      }
      components.push(newComp);
      this._saveComponents(obj, components);
      this._render();
    });
    addRow.appendChild(addBtn);
    section.appendChild(addRow);

    this._contentRoot.appendChild(section);
  }

  _createParamInput(key, value, defaultVal, onChange) {
    const type = typeof defaultVal;

    if (type === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!value;
      input.addEventListener('change', () => onChange(input.checked));
      return input;
    }

    if (type === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.value = value ?? 0;
      input.style.cssText = 'flex: 1; padding: 2px 4px; background: #0d0d1a; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.75rem;';
      input.addEventListener('change', () => onChange(parseFloat(input.value) || 0));
      return input;
    }

    if (key === 'code') {
      const textarea = document.createElement('textarea');
      textarea.rows = 4;
      textarea.value = value || '';
      textarea.style.cssText = 'flex: 1; padding: 2px 4px; background: #0d0d1a; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.75rem; font-family: monospace;';
      textarea.addEventListener('change', () => onChange(textarea.value));
      return textarea;
    }

    if (Array.isArray(defaultVal)) {
      const textarea = document.createElement('textarea');
      textarea.rows = 3;
      textarea.value = JSON.stringify(value || [], null, 2);
      textarea.style.cssText = 'flex: 1; padding: 2px 4px; background: #0d0d1a; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.75rem; font-family: monospace;';
      textarea.addEventListener('change', () => {
        try { onChange(JSON.parse(textarea.value)); } catch (_e) { /* keep current */ }
      });
      return textarea;
    }

    // String or null default — text input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.style.cssText = 'flex: 1; padding: 2px 4px; background: #0d0d1a; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.75rem;';
    input.addEventListener('change', () => onChange(input.value || (defaultVal === null ? null : '')));
    return input;
  }

  _saveComponents(obj, components) {
    if (!obj.properties) obj.properties = {};
    if (components.length > 0) {
      obj.properties.__components = JSON.stringify(components);
    } else {
      delete obj.properties.__components;
    }
  }

  // --- Connections Section ---

  _addConnectionsSection(obj) {
    if (!obj.properties) obj.properties = {};

    const section = document.createElement('div');
    section.className = 'prop-group';

    const lbl = document.createElement('label');
    lbl.textContent = 'Connections (JSON)';
    section.appendChild(lbl);

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size: 0.65rem; color: #7a7aaa; margin-bottom: 4px;';
    hint.textContent = 'Format: [{"name":"link1","targetId":"door1","event":"switch:toggled"}]';
    section.appendChild(hint);

    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.value = obj.properties.__connections || '[]';
    textarea.style.cssText = 'width: 100%; padding: 4px; background: #1a1a2e; border: 1px solid #3a3a5a; border-radius: 3px; color: #e0e0e0; font-size: 0.75rem; font-family: monospace;';
    textarea.addEventListener('change', () => {
      try {
        JSON.parse(textarea.value); // validate
        if (textarea.value === '[]') {
          delete obj.properties.__connections;
        } else {
          obj.properties.__connections = textarea.value;
        }
        textarea.style.borderColor = '#3a3a5a';
      } catch (_e) {
        textarea.style.borderColor = '#ff4444';
      }
    });
    section.appendChild(textarea);

    this._contentRoot.appendChild(section);
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
