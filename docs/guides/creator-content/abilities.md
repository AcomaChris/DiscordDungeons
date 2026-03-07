# Abilities

The ability system is data-driven. New abilities are defined in `AbilityDefs.js` and automatically available for equipping via the debug panel.

<!-- @doc-auto-start -->
### Ability Definition Format

<sub>Source: `client/src/abilities/AbilityDefs.js`</sub>

Each ability in `ABILITY_DEFS` has these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g. `'movement'`, `'jump'`) |
| `category` | string | One of: `Movement`, `Combat`, `Magic`, `Utility` |
| `type` | string | `'active'` (player-triggered) or `'passive'` (always-on) |
| `inputKey` | string\|null | Which input action triggers it (`'sprint'`, `'jump'`, or `null` for passive) |
| `params` | object | Numeric parameters that can be modified by `ModifierStack` buffs/debuffs |

To add a new ability, add a new key to `ABILITY_DEFS` with these fields.
Active abilities also need input wiring in `InputManager` and activation logic in `Player`.

<!-- @doc-auto-end -->
