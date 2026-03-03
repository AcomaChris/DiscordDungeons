// --- ConnectionEditor ---
// Compact WFC edge editor panel with next/prev navigation for rapid
// cycling through objects. Shows four edge dropdowns, auto-fill from
// tags, and a progress counter.

import { enrichEdges } from './AutoEnricher.js';

const DIRECTIONS = ['north', 'south', 'east', 'west'];

export class ConnectionEditor {
  constructor(containerEl, objectDefs, socketTypes, onEdgeChange) {
    this._container = containerEl;
    this._objectDefs = objectDefs;
    this._socketTypes = socketTypes;
    this._onEdgeChange = onEdgeChange;
    this._currentId = null;
    this._objectIds = [];
    this._el = null;
  }

  activate(startObjectId) {
    this._objectIds = Object.keys(this._objectDefs);
    this._currentId = startObjectId || this._objectIds[0] || null;
    this._container.innerHTML = '';
    this._el = document.createElement('div');
    this._el.className = 'connection-editor';
    this._container.appendChild(this._el);
    this.render();
  }

  deactivate() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
    this._currentId = null;
  }

  setObjectDefs(defs) {
    this._objectDefs = defs;
    this._objectIds = Object.keys(defs);
  }

  get currentObjectId() {
    return this._currentId;
  }

  next() {
    if (this._objectIds.length === 0) return;
    const idx = this._objectIds.indexOf(this._currentId);
    this._currentId = this._objectIds[(idx + 1) % this._objectIds.length];
    this.render();
  }

  prev() {
    if (this._objectIds.length === 0) return;
    const idx = this._objectIds.indexOf(this._currentId);
    this._currentId = this._objectIds[(idx - 1 + this._objectIds.length) % this._objectIds.length];
    this.render();
  }

  render() {
    if (!this._el) return;
    this._el.innerHTML = '';

    const total = this._objectIds.length;
    const idx = this._objectIds.indexOf(this._currentId);

    // Title + progress
    const header = document.createElement('div');
    header.className = 'batch-editor-header';

    const title = document.createElement('h3');
    title.textContent = 'Connections';
    header.appendChild(title);

    const progress = document.createElement('span');
    progress.className = 'batch-progress';
    const withEdges = this._objectIds.filter(id => {
      const d = this._objectDefs[id];
      return d?.wfc?.edges && Object.values(d.wfc.edges).some(e => e !== 'open_floor');
    }).length;
    progress.textContent = `${withEdges}/${total} have edges`;
    header.appendChild(progress);

    this._el.appendChild(header);

    if (!this._currentId || !this._objectDefs[this._currentId]) {
      const empty = document.createElement('p');
      empty.className = 'batch-empty';
      empty.textContent = 'No objects defined.';
      this._el.appendChild(empty);
      return;
    }

    // Nav bar
    const nav = document.createElement('div');
    nav.className = 'batch-nav';

    const prevB = document.createElement('button');
    prevB.className = 'btn btn-sm';
    prevB.textContent = '\u25C0 Prev';
    prevB.addEventListener('click', () => { this.prev(); this._notifyNav(); });

    const counter = document.createElement('span');
    counter.className = 'batch-counter';
    counter.textContent = `${idx + 1} / ${total}`;

    const nextB = document.createElement('button');
    nextB.className = 'btn btn-sm';
    nextB.textContent = 'Next \u25B6';
    nextB.addEventListener('click', () => { this.next(); this._notifyNav(); });

    nav.appendChild(prevB);
    nav.appendChild(counter);
    nav.appendChild(nextB);
    this._el.appendChild(nav);

    // Object name
    const def = this._objectDefs[this._currentId];
    const nameEl = document.createElement('div');
    nameEl.className = 'batch-object-name';
    nameEl.textContent = def.name || this._currentId;
    this._el.appendChild(nameEl);

    // Edge dropdowns
    const edgesContainer = document.createElement('div');
    edgesContainer.className = 'edge-dropdowns';

    const socketNames = this._socketTypes.map(s => s.name || s.id || s);

    for (const dir of DIRECTIONS) {
      const group = document.createElement('div');
      group.className = 'prop-group';

      const label = document.createElement('label');
      label.textContent = dir.charAt(0).toUpperCase() + dir.slice(1);
      group.appendChild(label);

      const select = document.createElement('select');
      const currentVal = def.wfc?.edges?.[dir] || 'open_floor';

      for (const name of socketNames) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name.replace(/_/g, ' ');
        if (name === currentVal) opt.selected = true;
        select.appendChild(opt);
      }

      select.addEventListener('change', () => {
        this._setEdge(dir, select.value);
      });

      group.appendChild(select);
      edgesContainer.appendChild(group);
    }

    this._el.appendChild(edgesContainer);

    // Auto-fill button
    const autoBtn = document.createElement('button');
    autoBtn.className = 'btn';
    autoBtn.textContent = 'Auto-fill from tags';
    autoBtn.style.marginTop = '8px';
    autoBtn.addEventListener('click', () => {
      // Reset edges to defaults so enrichEdges can work
      if (def.wfc) {
        def.wfc.edges = { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' };
      }
      const changed = enrichEdges(def);
      if (changed) {
        if (this._onEdgeChange) this._onEdgeChange(this._currentId);
        this.render();
      }
    });
    this._el.appendChild(autoBtn);
  }

  _setEdge(direction, value) {
    const def = this._objectDefs[this._currentId];
    if (!def) return;

    if (!def.wfc) {
      def.wfc = {
        edges: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
        clearance: { north: 1, south: 1, east: 1, west: 1 },
        allowedFloors: ['stone', 'wood'],
        weight: 1,
      };
    }
    if (!def.wfc.edges) {
      def.wfc.edges = { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' };
    }

    def.wfc.edges[direction] = value;
    if (this._onEdgeChange) this._onEdgeChange(this._currentId);
  }

  // Callback for nav — TileEditor can sync canvas selection
  onNavigate = null;

  _notifyNav() {
    if (this.onNavigate) this.onNavigate(this._currentId);
  }
}
