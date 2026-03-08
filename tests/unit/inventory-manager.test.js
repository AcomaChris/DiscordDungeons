// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock authManager before importing InventoryManager
vi.mock('../../client/src/auth/AuthManager.js', () => ({
  default: { sessionToken: null },
}));

// Must import after mocks
const { default: eventBus } = await import('../../client/src/core/EventBus.js');
const { INVENTORY_CHANGED, INVENTORY_ITEM_ADDED } = await import('../../client/src/core/Events.js');

// InventoryManager is a singleton — import the class and create fresh instances
// by reaching into the module. We'll re-import each test to get a fresh singleton.
let InventoryManager;

// Helper to create a fresh manager (bypasses singleton)
function createManager() {
  return new InventoryManager();
}

beforeEach(async () => {
  // Dynamic import to get the class — the module exports a singleton,
  // so we grab the constructor from it
  const mod = await import('../../client/src/inventory/InventoryManager.js');
  InventoryManager = mod.default.constructor;
});

describe('InventoryManager', () => {
  let mgr;

  beforeEach(() => {
    mgr = createManager();
  });

  describe('addItem', () => {
    it('adds an item to the bag', () => {
      const result = mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      expect(result).toBe(true);
      expect(mgr.getItems()).toHaveLength(1);
      expect(mgr.getItems()[0].id).toBe('sword');
    });

    it('enriches items with emoji and slot from ItemDefs', () => {
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      const items = mgr.getItems();
      expect(items[0].emoji).toBe('\u2694\uFE0F');
      expect(items[0].slot).toBe('rightHand');
    });

    it('stacks stackable items', () => {
      mgr.addItem({ id: 'gold', name: 'Gold Coin', quantity: 5 });
      mgr.addItem({ id: 'gold', name: 'Gold Coin', quantity: 3 });
      const items = mgr.getItems();
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(8);
    });

    it('does not stack non-stackable items', () => {
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      expect(mgr.getItems()).toHaveLength(2);
    });

    it('rejects items when bag is full', () => {
      // Fill all 20 slots with non-stackable items
      for (let i = 0; i < 20; i++) {
        mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      }
      const result = mgr.addItem({ id: 'shield', name: 'Wooden Shield', quantity: 1 });
      expect(result).toBe(false);
      expect(mgr.getItems()).toHaveLength(20);
    });

    it('still stacks when bag is full', () => {
      for (let i = 0; i < 20; i++) {
        mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      }
      // Add a gold first to have something to stack onto — need to remove a sword first
      mgr.removeItem(0);
      mgr.addItem({ id: 'gold', name: 'Gold Coin', quantity: 1 });
      // Bag is full (20 items), but gold should still stack
      const result = mgr.addItem({ id: 'gold', name: 'Gold Coin', quantity: 5 });
      expect(result).toBe(true);
      expect(mgr.getItems().find(i => i.id === 'gold').quantity).toBe(6);
    });

    it('emits INVENTORY_ITEM_ADDED event', () => {
      const handler = vi.fn();
      eventBus.on(INVENTORY_ITEM_ADDED, handler);
      mgr.addItem({ id: 'potion', name: 'Health Potion', quantity: 1 });
      expect(handler).toHaveBeenCalledOnce();
      eventBus.off(INVENTORY_ITEM_ADDED, handler);
    });

    it('emits INVENTORY_CHANGED event', () => {
      const handler = vi.fn();
      eventBus.on(INVENTORY_CHANGED, handler);
      mgr.addItem({ id: 'potion', name: 'Health Potion', quantity: 1 });
      expect(handler).toHaveBeenCalledOnce();
      eventBus.off(INVENTORY_CHANGED, handler);
    });
  });

  describe('removeItem', () => {
    it('removes item at index', () => {
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      mgr.addItem({ id: 'shield', name: 'Wooden Shield', quantity: 1 });
      const removed = mgr.removeItem(0);
      expect(removed.id).toBe('sword');
      expect(mgr.getItems()).toHaveLength(1);
      expect(mgr.getItems()[0].id).toBe('shield');
    });

    it('returns null for invalid index', () => {
      expect(mgr.removeItem(-1)).toBeNull();
      expect(mgr.removeItem(0)).toBeNull();
      expect(mgr.removeItem(99)).toBeNull();
    });
  });

  describe('equipItem', () => {
    it('equips an item from bag to slot', () => {
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      const result = mgr.equipItem(0);
      expect(result).toBe(true);
      expect(mgr.getItems()).toHaveLength(0);
      expect(mgr.getEquipment().rightHand.id).toBe('sword');
    });

    it('swaps equipped item back to bag', () => {
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      mgr.equipItem(0);
      // Add another sword and equip it — first sword should go back to bag
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      mgr.equipItem(0);
      expect(mgr.getItems()).toHaveLength(1);
      expect(mgr.getItems()[0].id).toBe('sword');
      expect(mgr.getEquipment().rightHand.id).toBe('sword');
    });

    it('fails for items without a slot', () => {
      mgr.addItem({ id: 'gold', name: 'Gold Coin', quantity: 1 });
      const result = mgr.equipItem(0);
      expect(result).toBe(false);
      expect(mgr.getItems()).toHaveLength(1);
    });

    it('fails when bag is full and slot is occupied (no room for swap)', () => {
      mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      mgr.equipItem(0);
      // Fill bag to max
      for (let i = 0; i < 20; i++) {
        mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      }
      // Try to equip another sword — should fail because unequipped sword has no bag room
      const result = mgr.equipItem(0);
      expect(result).toBe(false);
    });
  });

  describe('unequipItem', () => {
    it('moves equipped item back to bag', () => {
      mgr.addItem({ id: 'helm', name: 'Leather Helm', quantity: 1 });
      mgr.equipItem(0);
      expect(mgr.getEquipment().head.id).toBe('helm');

      const result = mgr.unequipItem('head');
      expect(result).toBe(true);
      expect(mgr.getEquipment().head).toBeUndefined();
      expect(mgr.getItems()).toHaveLength(1);
      expect(mgr.getItems()[0].id).toBe('helm');
    });

    it('fails for empty slot', () => {
      expect(mgr.unequipItem('head')).toBe(false);
    });

    it('fails when bag is full', () => {
      mgr.addItem({ id: 'helm', name: 'Leather Helm', quantity: 1 });
      mgr.equipItem(0);
      for (let i = 0; i < 20; i++) {
        mgr.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
      }
      expect(mgr.unequipItem('head')).toBe(false);
    });
  });

  describe('getItems / getEquipment', () => {
    it('returns copies (not references)', () => {
      mgr.addItem({ id: 'gold', name: 'Gold Coin', quantity: 1 });
      const items1 = mgr.getItems();
      const items2 = mgr.getItems();
      expect(items1).not.toBe(items2);

      const eq1 = mgr.getEquipment();
      const eq2 = mgr.getEquipment();
      expect(eq1).not.toBe(eq2);
    });
  });

  describe('unknown items', () => {
    it('uses fallback emoji for unknown item IDs', () => {
      mgr.addItem({ id: 'mystery', name: 'Mystery Item', quantity: 1 });
      expect(mgr.getItems()[0].emoji).toBe('\u{1F4E6}');
      expect(mgr.getItems()[0].slot).toBeNull();
    });
  });
});
