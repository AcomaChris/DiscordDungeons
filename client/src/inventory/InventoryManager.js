// --- InventoryManager ---
// Manages player bag inventory and equipment. Syncs to server with debounced saves.

import eventBus from '../core/EventBus.js';
import { INVENTORY_CHANGED, INVENTORY_ITEM_ADDED } from '../core/Events.js';
import { ITEM_DEFS, enrichItem } from './ItemDefs.js';
import authManager from '../auth/AuthManager.js';

const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';
const SAVE_DEBOUNCE_MS = 2000;

class InventoryManager {
  constructor() {
    this._items = [];
    this._equipment = {};
    this._maxSlots = 20;
    this._saveTimer = null;
    this._loaded = false;
  }

  // --- Public API ---

  addItem(rawItem) {
    const item = enrichItem(rawItem);

    // Stack onto existing item if stackable
    const def = ITEM_DEFS[item.id];
    if (def?.stackable) {
      const existing = this._items.find(i => i.id === item.id);
      if (existing) {
        existing.quantity = (existing.quantity || 1) + (item.quantity || 1);
        eventBus.emit(INVENTORY_ITEM_ADDED, item);
        this._onChange();
        return true;
      }
    }

    if (this._items.length >= this._maxSlots) return false;

    this._items.push(item);
    eventBus.emit(INVENTORY_ITEM_ADDED, item);
    this._onChange();
    return true;
  }

  removeItem(index) {
    if (index < 0 || index >= this._items.length) return null;
    const [removed] = this._items.splice(index, 1);
    this._onChange();
    return removed;
  }

  equipItem(bagIndex) {
    const item = this._items[bagIndex];
    if (!item || !item.slot) return false;

    const slot = item.slot;

    // Swap currently equipped item back to bag if slot is occupied
    if (this._equipment[slot]) {
      if (this._items.length >= this._maxSlots) return false;
      this._items.push(this._equipment[slot]);
    }

    // Move item from bag to equipment
    this._items.splice(bagIndex, 1);
    this._equipment[slot] = item;
    this._onChange();
    return true;
  }

  unequipItem(slotName) {
    const item = this._equipment[slotName];
    if (!item) return false;
    if (this._items.length >= this._maxSlots) return false;

    this._items.push(item);
    delete this._equipment[slotName];
    this._onChange();
    return true;
  }

  getItems() {
    return [...this._items];
  }

  getEquipment() {
    return { ...this._equipment };
  }

  get loaded() {
    return this._loaded;
  }

  // --- Server Sync ---

  async loadFromServer() {
    if (!authManager.sessionToken) return;

    try {
      const res = await fetch(`${AUTH_API_URL}/api/player`, {
        headers: { Authorization: `Bearer ${authManager.sessionToken}` },
      });
      if (!res.ok) throw new Error(`GET /api/player failed: ${res.status}`);

      const data = await res.json();
      const inv = data.inventory || {};
      this._items = (inv.items || []).map(enrichItem);
      this._equipment = inv.equipment || {};
      this._maxSlots = inv.maxSlots || 20;
      this._loaded = true;
      eventBus.emit(INVENTORY_CHANGED, { items: this._items, equipment: this._equipment });
    } catch (err) {
      console.warn('[InventoryManager] Failed to load inventory:', err);
    }
  }

  // --- Internal ---

  _onChange() {
    eventBus.emit(INVENTORY_CHANGED, { items: this._items, equipment: this._equipment });
    this._scheduleSave();
  }

  _scheduleSave() {
    if (!authManager.sessionToken) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), SAVE_DEBOUNCE_MS);
  }

  async _save() {
    try {
      await fetch(`${AUTH_API_URL}/api/player/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authManager.sessionToken}`,
        },
        body: JSON.stringify({ items: this._items, equipment: this._equipment }),
      });
    } catch (err) {
      console.warn('[InventoryManager] Failed to save inventory:', err);
    }
  }
}

// Singleton
const inventoryManager = new InventoryManager();
export default inventoryManager;
