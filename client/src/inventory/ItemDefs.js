// --- Item Definitions ---
// Registry of all item types. Items in containers use { id, name, quantity };
// emoji and slot are resolved from this registry when entering player inventory.

export const EQUIPMENT_SLOTS = [
  'head', 'neck', 'upperBody', 'back', 'belt',
  'lowerBody', 'boots', 'leftGlove', 'leftHand',
  'rightGlove', 'rightHand',
];

export const EQUIPMENT_SLOT_LABELS = {
  head: 'Head',
  neck: 'Neck',
  upperBody: 'Upper Body',
  back: 'Back',
  belt: 'Belt',
  lowerBody: 'Lower Body',
  boots: 'Boots',
  leftGlove: 'L. Glove',
  leftHand: 'L. Hand',
  rightGlove: 'R. Glove',
  rightHand: 'R. Hand',
};

export const ITEM_DEFS = {
  gold:   { name: 'Gold Coin',     emoji: '\u{1FA99}', slot: null,       stackable: true },
  potion: { name: 'Health Potion', emoji: '\u{1F9EA}', slot: null,       stackable: true },
  sword:  { name: 'Iron Sword',    emoji: '\u2694\uFE0F', slot: 'rightHand', stackable: false },
  shield: { name: 'Wooden Shield', emoji: '\u{1F6E1}\uFE0F', slot: 'leftHand',  stackable: false },
  helm:   { name: 'Leather Helm',  emoji: '\u{1FA96}', slot: 'head',      stackable: false },
  ring:   { name: 'Ruby Ring',     emoji: '\u{1F48D}', slot: 'neck',      stackable: false },
};

// Resolve item def fields onto a raw container item { id, name, quantity }
export function enrichItem(item) {
  const def = ITEM_DEFS[item.id];
  return {
    ...item,
    emoji: def?.emoji || '\u{1F4E6}',
    slot: def?.slot || null,
  };
}
