// --- CategoryPainter ---
// Paint mode for quickly assigning categories to objects.
// Shows a category palette in the right panel; click/drag on the canvas
// to assign the selected category to objects under the cursor.

import { OBJECT_CATEGORIES } from '../map/object-def-schema.js';

const CATEGORY_COLORS = {
  furniture: '#ff9f43',
  structure: '#54a0ff',
  container: '#00d2d3',
  decoration: '#ff6b9d',
  lighting: '#feca57',
  nature: '#10ac84',
  effect: '#c44dff',
};

export class CategoryPainter {
  constructor(containerEl, objectDefs, onCategoryChange) {
    this._container = containerEl;
    this._objectDefs = objectDefs;
    this._onCategoryChange = onCategoryChange;
    this._activeBrush = null;
    this._el = null;
  }

  // Replace the panel contents with the category palette
  activate() {
    this._container.innerHTML = '';
    this._el = document.createElement('div');
    this._el.className = 'category-painter';
    this._container.appendChild(this._el);
    this.render();
  }

  deactivate() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
    this._activeBrush = null;
  }

  setObjectDefs(defs) {
    this._objectDefs = defs;
    if (this._el) this.render();
  }

  get activeBrush() {
    return this._activeBrush;
  }

  render() {
    if (!this._el) return;

    // Count objects per category
    const counts = {};
    for (const cat of OBJECT_CATEGORIES) counts[cat] = 0;
    for (const def of Object.values(this._objectDefs)) {
      const cat = def.category || 'decoration';
      counts[cat] = (counts[cat] || 0) + 1;
    }

    this._el.innerHTML = '';

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Paint Categories';
    title.className = 'painter-title';
    this._el.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'painter-hint';
    hint.textContent = 'Select a category, then click objects on the canvas to assign it.';
    this._el.appendChild(hint);

    // Category buttons
    for (const cat of OBJECT_CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = 'painter-category-btn';
      if (cat === this._activeBrush) btn.classList.add('active');

      const swatch = document.createElement('span');
      swatch.className = 'painter-swatch';
      swatch.style.background = CATEGORY_COLORS[cat] || '#888';
      btn.appendChild(swatch);

      const label = document.createElement('span');
      label.className = 'painter-label';
      label.textContent = cat;
      btn.appendChild(label);

      const count = document.createElement('span');
      count.className = 'painter-count';
      count.textContent = counts[cat] || 0;
      btn.appendChild(count);

      btn.addEventListener('click', () => {
        this._activeBrush = cat === this._activeBrush ? null : cat;
        this.render();
      });

      this._el.appendChild(btn);
    }
  }

  // Called by the canvas when a tile is clicked/dragged in paint mode.
  // Returns true if a category was changed.
  paintObjectAtTile(tileIndex, tileToObject) {
    if (!this._activeBrush) return false;

    const objectId = tileToObject.get(tileIndex);
    if (!objectId) return false;

    const def = this._objectDefs[objectId];
    if (!def) return false;

    if (def.category === this._activeBrush) return false;

    def.category = this._activeBrush;
    if (this._onCategoryChange) {
      this._onCategoryChange(objectId, this._activeBrush);
    }
    return true;
  }
}
