// --- Stat Definitions ---
// Data-only registry of player stats and dexterity unlock table.

export const STAT_DEFS = {
  strength:     { id: 'strength',     label: 'Strength',     color: '#ff4444' },
  dexterity:    { id: 'dexterity',    label: 'Dexterity',    color: '#44ff44' },
  constitution: { id: 'constitution', label: 'Constitution', color: '#ffaa00' },
  intelligence: { id: 'intelligence', label: 'Intelligence', color: '#4488ff' },
  wisdom:       { id: 'wisdom',       label: 'Wisdom',       color: '#aa44ff' },
  charisma:     { id: 'charisma',     label: 'Charisma',     color: '#ff44aa' },
};

export const STAT_IDS = Object.keys(STAT_DEFS);
export const STAT_MIN = 1;
export const STAT_MAX = 5;
export const STAT_DEFAULT = 2;
export const STARTING_STAT_POINTS = 3;

// Dexterity unlock table — what each level grants
// AGENT: 'sprint' is a separate ability from 'movement'. Update both lists when changing.
export const DEX_UNLOCKS = {
  1: { abilities: ['movement'], description: 'Walk' },
  2: { abilities: ['movement', 'sprint', 'jump'], description: 'Run + Jump' },
  3: { abilities: ['movement', 'sprint', 'jump', 'mantle'], description: 'Mantle' },
  4: { abilities: ['movement', 'sprint', 'jump', 'mantle'], description: 'Double Jump', doubleJump: true },
  5: { abilities: ['movement', 'sprint', 'jump', 'mantle', 'float'], description: 'Float', doubleJump: true },
};
