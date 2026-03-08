// --- InventoryTab ---
// Renders equipment slots and bag grid inside the Player menu panel.
// Subscribes to INVENTORY_CHANGED for live updates.

import eventBus from '../core/EventBus.js';
import { INVENTORY_CHANGED } from '../core/Events.js';
import inventoryManager from '../inventory/InventoryManager.js';
import { EQUIPMENT_SLOTS, EQUIPMENT_SLOT_LABELS } from '../inventory/ItemDefs.js';

export class InventoryTab {
  constructor(containerEl) {
    this._container = containerEl;
    this._onInventoryChanged = () => this._render();
    eventBus.on(INVENTORY_CHANGED, this._onInventoryChanged);
    this._render();
  }

  _render() {
    this._container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'dd-inventory';

    wrap.appendChild(this._buildEquipment());
    wrap.appendChild(this._buildBag());

    this._container.appendChild(wrap);
  }

  // --- Equipment Slots ---

  _buildEquipment() {
    const section = document.createElement('div');
    section.className = 'dd-equip-section';

    const h4 = document.createElement('h4');
    h4.textContent = 'Equipment';
    section.appendChild(h4);

    const grid = document.createElement('div');
    grid.className = 'dd-equip-grid';

    const equipment = inventoryManager.getEquipment();

    for (const slot of EQUIPMENT_SLOTS) {
      const item = equipment[slot] || null;
      const el = document.createElement('div');
      el.className = 'dd-equip-slot' + (item ? ' filled' : '');

      const emoji = document.createElement('span');
      emoji.className = 'slot-emoji';
      emoji.textContent = item ? item.emoji : '\u2014';

      const label = document.createElement('span');
      label.className = 'slot-label';
      label.textContent = item ? item.name : EQUIPMENT_SLOT_LABELS[slot];

      el.append(emoji, label);

      if (item) {
        el.title = `Click to unequip ${item.name}`;
        el.addEventListener('click', () => {
          inventoryManager.unequipItem(slot);
        });
      }

      grid.appendChild(el);
    }

    section.appendChild(grid);
    return section;
  }

  // --- Bag Grid ---

  _buildBag() {
    const section = document.createElement('div');
    section.className = 'dd-bag-section';

    const h4 = document.createElement('h4');
    h4.textContent = 'Bag';
    section.appendChild(h4);

    const grid = document.createElement('div');
    grid.className = 'dd-bag-grid';

    const items = inventoryManager.getItems();
    const maxSlots = 20;

    for (let i = 0; i < maxSlots; i++) {
      const item = items[i] || null;
      const el = document.createElement('div');
      el.className = 'dd-bag-slot' + (item ? ' filled' : '');

      if (item) {
        const emoji = document.createElement('span');
        emoji.className = 'item-emoji';
        emoji.textContent = item.emoji;
        el.appendChild(emoji);

        if (item.quantity > 1) {
          const qty = document.createElement('span');
          qty.className = 'item-qty';
          qty.textContent = item.quantity;
          el.appendChild(qty);
        }

        // Tooltip
        const tooltip = document.createElement('span');
        tooltip.className = 'item-name';
        tooltip.textContent = item.name;
        el.appendChild(tooltip);

        // Click to equip if item has a slot
        if (item.slot) {
          el.title = `Click to equip ${item.name}`;
          el.addEventListener('click', () => {
            inventoryManager.equipItem(i);
          });
        }
      }

      grid.appendChild(el);
    }

    section.appendChild(grid);
    return section;
  }

  destroy() {
    eventBus.off(INVENTORY_CHANGED, this._onInventoryChanged);
  }
}
