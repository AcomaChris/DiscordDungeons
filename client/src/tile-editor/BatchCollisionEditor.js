// --- BatchCollisionEditor ---
// Streamlined collision setup with next/prev navigation, preset buttons,
// and "apply to all [category]" shortcut.

const TILE_SIZE = 16;

export class BatchCollisionEditor {
  constructor(containerEl, objectDefs, onColliderChange) {
    this._container = containerEl;
    this._objectDefs = objectDefs;
    this._onColliderChange = onColliderChange;
    this._currentId = null;
    this._objectIds = [];
    this._el = null;
  }

  activate(startObjectId) {
    this._objectIds = Object.keys(this._objectDefs);
    this._currentId = startObjectId || this._objectIds[0] || null;
    this._container.innerHTML = '';
    this._el = document.createElement('div');
    this._el.className = 'batch-collision-editor';
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
    title.textContent = 'Collision';
    header.appendChild(title);

    const progress = document.createElement('span');
    progress.className = 'batch-progress';
    const withColliders = this._objectIds.filter(id => {
      const d = this._objectDefs[id];
      return d?.colliders?.length > 0;
    }).length;
    progress.textContent = `${withColliders}/${total} have colliders`;
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

    // Object info
    const def = this._objectDefs[this._currentId];
    const nameEl = document.createElement('div');
    nameEl.className = 'batch-object-name';
    nameEl.textContent = `${def.name || this._currentId} (${def.category || 'decoration'})`;
    this._el.appendChild(nameEl);

    // Current collider info
    const infoEl = document.createElement('div');
    infoEl.className = 'collision-info';
    if (def.colliders && def.colliders.length > 0) {
      infoEl.textContent = `${def.colliders.length} collider(s): ${def.colliders.map(c => c.id).join(', ')}`;
    } else {
      infoEl.textContent = 'No colliders';
    }
    this._el.appendChild(infoEl);

    // Preset buttons
    const presets = document.createElement('div');
    presets.className = 'collision-presets';

    const presetLabel = document.createElement('label');
    presetLabel.textContent = 'Presets';
    presets.appendChild(presetLabel);

    const presetBtns = document.createElement('div');
    presetBtns.className = 'preset-buttons';

    const fullBtn = document.createElement('button');
    fullBtn.className = 'btn btn-sm';
    fullBtn.textContent = 'Full';
    fullBtn.title = 'Solid collider covering the full object';
    fullBtn.addEventListener('click', () => this._applyPreset('full'));

    const bottomBtn = document.createElement('button');
    bottomBtn.className = 'btn btn-sm';
    bottomBtn.textContent = 'Bottom Half';
    bottomBtn.title = 'Solid collider on the bottom half (walkable top for Y-sorted objects)';
    bottomBtn.addEventListener('click', () => this._applyPreset('bottom_half'));

    const noneBtn = document.createElement('button');
    noneBtn.className = 'btn btn-sm';
    noneBtn.textContent = 'None';
    noneBtn.title = 'Remove all colliders';
    noneBtn.addEventListener('click', () => this._applyPreset('none'));

    presetBtns.appendChild(fullBtn);
    presetBtns.appendChild(bottomBtn);
    presetBtns.appendChild(noneBtn);
    presets.appendChild(presetBtns);
    this._el.appendChild(presets);

    // Apply to all in category
    const category = def.category || 'decoration';
    const batchBtn = document.createElement('button');
    batchBtn.className = 'btn';
    batchBtn.style.marginTop = '12px';
    batchBtn.textContent = `Apply current to all ${category}`;
    batchBtn.title = `Apply this object's collider setup to all ${category} objects that have no colliders`;
    batchBtn.addEventListener('click', () => this._applyToCategory(category));
    this._el.appendChild(batchBtn);
  }

  _applyPreset(preset) {
    const def = this._objectDefs[this._currentId];
    if (!def) return;

    const pixelW = def.grid.cols * TILE_SIZE;
    const pixelH = def.grid.rows * TILE_SIZE;

    switch (preset) {
    case 'full':
      def.colliders = [{
        id: 'main', shape: 'rect', type: 'solid',
        x: 0, y: 0, width: pixelW, height: pixelH, elevation: 0,
      }];
      break;
    case 'bottom_half':
      def.colliders = [{
        id: 'main', shape: 'rect', type: 'solid',
        x: 0, y: Math.floor(pixelH / 2), width: pixelW, height: Math.ceil(pixelH / 2), elevation: 0,
      }];
      break;
    case 'none':
      def.colliders = [];
      break;
    }

    if (this._onColliderChange) this._onColliderChange(this._currentId);
    this.render();
  }

  _applyToCategory(category) {
    const sourceDef = this._objectDefs[this._currentId];
    if (!sourceDef) return;

    for (const def of Object.values(this._objectDefs)) {
      if (def === sourceDef) continue;
      if (def.category !== category) continue;
      if (def.colliders && def.colliders.length > 0) continue; // don't overwrite

      // Clone the source colliders, scaled to this object's grid
      const srcW = sourceDef.grid.cols * TILE_SIZE;
      const srcH = sourceDef.grid.rows * TILE_SIZE;
      const dstW = def.grid.cols * TILE_SIZE;
      const dstH = def.grid.rows * TILE_SIZE;

      def.colliders = sourceDef.colliders.map(c => ({
        ...c,
        x: Math.round(c.x * dstW / srcW),
        y: Math.round(c.y * dstH / srcH),
        width: Math.round(c.width * dstW / srcW),
        height: Math.round(c.height * dstH / srcH),
      }));
    }

    if (this._onColliderChange) this._onColliderChange(null);
    this.render();
  }

  // Callback for nav — TileEditor can sync canvas selection
  onNavigate = null;

  _notifyNav() {
    if (this.onNavigate) this.onNavigate(this._currentId);
  }
}
