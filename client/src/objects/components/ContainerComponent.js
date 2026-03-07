// --- ContainerComponent ---
// Holds an array of items. Opens a floating UI panel when interacted with.
// Supports loot tables (roll items on first open) and max slot limits.
//
// AGENT: Items are plain objects { id, name, quantity }. No item system
// exists yet — this is the storage layer. UI is handled by ContainerUI.

import { Component } from '../Component.js';
import { componentRegistry } from '../ComponentRegistry.js';

// @doc-creator-content 02:Components > Container Component
// Inventory container with a slot limit. Opens a floating UI panel on interact.
// On first open, rolls a `lootTable` (if defined) to populate items.
// Parameters: `items[]` (array of `{ id, name, quantity }`), `maxSlots`, `lootTable`,
// `promptText`. Loot table entries: `{ id, name, quantity, chance }` where `chance`
// is 0-1 probability (default 1). Use `takeItem(index)` and `addItem(item)` to
// modify contents programmatically. Emits `container:opened`, `container:closed`,
// and `container:itemTaken` events.

export class ContainerComponent extends Component {
  init() {
    this._isOpen = false;
    this._hasBeenLooted = false;
    this._onClose = null;
  }

  onInteract(player) {
    if (this._isOpen) {
      this.close();
      return;
    }

    // Roll loot table on first open
    if (!this._hasBeenLooted && this.params.lootTable) {
      this.params.items = this._rollLoot(this.params.lootTable);
      this._hasBeenLooted = true;
    }

    this.open(player);
  }

  open(player) {
    this._isOpen = true;
    this.owner.emit('container:opened', {
      containerId: this.owner.id,
      items: [...this.params.items],
    });
    this.owner.notifyStateChanged();
  }

  close() {
    this._isOpen = false;
    this.owner.emit('container:closed', { containerId: this.owner.id });

    if (this._onClose) {
      this._onClose();
      this._onClose = null;
    }
  }

  // Register a callback for when the container closes (used by ContainerUI)
  onCloseCallback(fn) {
    this._onClose = fn;
  }

  // Remove an item by index (e.g. player takes it)
  takeItem(index) {
    if (index < 0 || index >= this.params.items.length) return null;
    const item = this.params.items.splice(index, 1)[0];
    this.owner.notifyStateChanged();
    this.owner.emit('container:itemTaken', {
      containerId: this.owner.id,
      item,
      remainingItems: this.params.items.length,
    });
    return item;
  }

  // Add an item to the container (returns false if full)
  addItem(item) {
    if (this.params.items.length >= this.params.maxSlots) return false;
    this.params.items.push(item);
    this.owner.notifyStateChanged();
    return true;
  }

  get isOpen() { return this._isOpen; }
  get items() { return this.params.items; }
  get isFull() { return this.params.items.length >= this.params.maxSlots; }
  get isEmpty() { return this.params.items.length === 0; }

  get promptText() {
    return this._isOpen ? 'Close' : (this.params.promptText || 'Open');
  }

  // Simple loot table roller: [{ id, name, quantity, chance }]
  _rollLoot(lootTable) {
    if (!Array.isArray(lootTable)) return [];
    const items = [];
    for (const entry of lootTable) {
      const chance = entry.chance ?? 1;
      if (Math.random() < chance) {
        items.push({ id: entry.id, name: entry.name, quantity: entry.quantity || 1 });
      }
    }
    return items;
  }

  getState() {
    return {
      items: [...this.params.items],
      hasBeenLooted: this._hasBeenLooted,
      isOpen: this._isOpen,
    };
  }

  applyState(state) {
    if (!state) return;
    if (state.items) this.params.items = [...state.items];
    if (state.hasBeenLooted !== undefined) this._hasBeenLooted = state.hasBeenLooted;
    if (state.isOpen !== undefined) this._isOpen = state.isOpen;
  }

  destroy() {
    if (this._isOpen) this.close();
    super.destroy();
  }
}

componentRegistry.register('container', ContainerComponent);
