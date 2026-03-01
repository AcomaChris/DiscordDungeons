// --- Ability Definitions ---
// Data-only registry of all ability types, their parameters, and activation
// rules. Ability logic lives in AbilityManager, not here.
// AGENT: Keep entries self-contained. Add new abilities by adding a new key.

export const AbilityType = {
  ACTIVE: 'active',
  PASSIVE: 'passive',
};

export const ABILITY_DEFS = {
  movement: {
    id: 'movement',
    type: AbilityType.ACTIVE,
    inputKey: 'sprint',
    params: {
      walkSpeed: 80,    // px/sec (base movement)
      sprintSpeed: 160,  // px/sec (~2× walk)
    },
  },

  jump: {
    id: 'jump',
    type: AbilityType.ACTIVE,
    inputKey: 'jump',
    params: {
      heightPower: 200,
      horizontalPower: 100,
    },
  },

  float: {
    id: 'float',
    type: AbilityType.PASSIVE,
    inputKey: null,
    params: {
      gravityFactor: 0.5,
    },
  },
};

// Abilities equipped on every new player by default
export const DEFAULT_ABILITIES = ['movement', 'jump'];
