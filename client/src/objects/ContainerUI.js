// --- ContainerUI ---
// DOM-based panel that displays container contents with Take/Take All buttons.
// Integrates with InventoryManager to move items from chests into player bag.

import { acquireInputFocus, releaseInputFocus } from '../core/InputContext.js';
import inventoryManager from '../inventory/InventoryManager.js';
import { enrichItem } from '../inventory/ItemDefs.js';
import '../styles/player-menu.css';

export class ContainerUI {
  constructor() {
    this._panel = null;
    this._activeObject = null;
    this._comp = null;
  }

  // Show the container UI for a given InteractiveObject
  show(interactiveObj) {
    this.hide();

    const comp = interactiveObj.components.get('container');
    if (!comp) return;

    this._activeObject = interactiveObj;
    this._comp = comp;

    // Register close callback
    comp.onCloseCallback(() => this.hide());

    this._render();
    acquireInputFocus();
  }

  _render() {
    if (this._panel) this._panel.remove();

    const comp = this._comp;
    if (!comp) return;

    const items = comp.items;

    this._panel = document.createElement('div');
    this._panel.className = 'dd-container-panel';

    const h4 = document.createElement('h4');
    h4.textContent = 'Contents';
    this._panel.appendChild(h4);

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dd-container-empty';
      empty.textContent = '(empty)';
      this._panel.appendChild(empty);
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const enriched = enrichItem(item);
        const row = document.createElement('div');
        row.className = 'dd-container-item';

        const emoji = document.createElement('span');
        emoji.className = 'item-emoji';
        emoji.textContent = enriched.emoji;

        const label = document.createElement('span');
        label.className = 'item-label';
        label.textContent = `${item.name || item.id}${item.quantity > 1 ? ` \xd7${item.quantity}` : ''}`;

        const takeBtn = document.createElement('button');
        takeBtn.className = 'take-btn';
        takeBtn.textContent = 'Take';
        takeBtn.addEventListener('click', () => this._takeItem(i));

        row.append(emoji, label, takeBtn);
        this._panel.appendChild(row);
      }

      const actions = document.createElement('div');
      actions.className = 'dd-container-actions';

      const takeAll = document.createElement('button');
      takeAll.className = 'dd-container-takeall';
      takeAll.textContent = 'Take All';
      takeAll.addEventListener('click', () => this._takeAll());

      actions.appendChild(takeAll);
      this._panel.appendChild(actions);
    }

    document.body.appendChild(this._panel);
  }

  _takeItem(index) {
    if (!this._comp) return;
    const item = this._comp.takeItem(index);
    if (item) inventoryManager.addItem(item);

    if (this._comp.isEmpty) {
      this._comp.close();
    } else {
      this._render();
    }
  }

  _takeAll() {
    if (!this._comp) return;
    // Take from end so indices stay valid
    const items = this._comp.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = this._comp.takeItem(i);
      if (item) inventoryManager.addItem(item);
    }
    this._comp.close();
  }

  hide() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
      releaseInputFocus();
    }
    this._activeObject = null;
    this._comp = null;
  }

  get isVisible() {
    return this._panel !== null;
  }

  get activeObject() {
    return this._activeObject;
  }

  destroy() {
    this.hide();
  }
}
