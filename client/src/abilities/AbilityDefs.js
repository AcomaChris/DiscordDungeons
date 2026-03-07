// --- Ability Definitions ---
// Data-only registry of all ability types, their parameters, and activation
// rules. Ability logic lives in AbilityManager, not here.
// AGENT: Keep entries self-contained. Add new abilities by adding a new key.

// @doc-creator-content 01:Abilities > Ability Definition Format
// Each ability in `ABILITY_DEFS` has these fields:
//
// | Field | Type | Description |
// |-------|------|-------------|
// | `id` | string | Unique identifier (e.g. `'movement'`, `'jump'`) |
// | `category` | string | One of: `Movement`, `Combat`, `Magic`, `Utility` |
// | `type` | string | `'active'` (player-triggered) or `'passive'` (always-on) |
// | `inputKey` | string\|null | Which input action triggers it (`'sprint'`, `'jump'`, or `null` for passive) |
// | `params` | object | Numeric parameters that can be modified by `ModifierStack` buffs/debuffs |
//
// To add a new ability, add a new key to `ABILITY_DEFS` with these fields.
// Active abilities also need input wiring in `InputManager` and activation logic in `Player`.

export const AbilityType = {
  ACTIVE: 'active',
  PASSIVE: 'passive',
};

// Theme-based categories for UI grouping
export const ABILITY_CATEGORIES = ['Movement', 'Combat', 'Magic', 'Utility'];

// @doc-player 02:Abilities > Movement
// **Walking and sprinting.** Move at 80 px/sec by default. Hold **Shift**
// (or the RUN button on mobile) to sprint at 160 px/sec. Sprinting also
// increases your auto-step-up height, letting you walk onto small ledges.

// @doc-player 02:Abilities > Jump
// Press **Space** (or the JUMP button on mobile) to jump. Jumping is
// physics-based — you launch upward and gravity pulls you back down.
// While airborne, you can trigger mantling by jumping near a ledge.

// @doc-player 02:Abilities > Float
// A passive ability that reduces gravity while you're falling. Makes
// descent slower and floatier, giving you more air control after jumps.
// Not equipped by default — equip it via the debug panel.

// @doc-player 02:Abilities > Mantle
// A passive ability that lets you **climb ledges** during a jump. When
// you jump facing a ledge that's above step-height but within mantle range,
// your character automatically climbs up onto it instead of bouncing off.

export const ABILITY_DEFS = {
  movement: {
    id: 'movement',
    category: 'Movement',
    type: AbilityType.ACTIVE,
    inputKey: 'sprint',
    params: {
      walkSpeed: 80,    // px/sec (base movement)
      sprintSpeed: 160,  // px/sec (~2× walk)
      stepHeight: 8,     // px — max elevation delta for auto-step-up (one ELEVATION_STEP)
    },
  },

  jump: {
    id: 'jump',
    category: 'Movement',
    type: AbilityType.ACTIVE,
    inputKey: 'jump',
    params: {
      heightPower: 200,
      horizontalPower: 100,
    },
  },

  float: {
    id: 'float',
    category: 'Movement',
    type: AbilityType.PASSIVE,
    inputKey: null,
    params: {
      gravityFactor: 0.5,
    },
  },

  mantle: {
    id: 'mantle',
    category: 'Movement',
    type: AbilityType.PASSIVE,
    inputKey: null,
    params: {
      mantleHeight: 16,   // px — max elevation delta above stepHeight that can be mantled
      mantleSpeed: 200,    // ms — climb interpolation duration
      mantleReach: 1,      // tiles ahead to scan in facing direction
    },
  },
};

// Abilities equipped on every new player by default
export const DEFAULT_ABILITIES = ['movement', 'jump', 'mantle'];
