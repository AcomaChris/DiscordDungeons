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

### AbilityManager API

<sub>Source: `client/src/abilities/AbilityManager.js`</sub>

Per-player manager that tracks equipped abilities, activation state, and modifiers.
- `equip(abilityId)` — equips an ability by ID (looked up from `AbilityDefs`)
- `unequip(abilityId)` — removes an equipped ability
- `get(id)` — returns `{ params, active }` with all modifier-resolved param values
- `getParam(abilityId, paramName)` — returns a single resolved param value (base + modifiers)
- `updateFromInput(input)` — activates/deactivates active-type abilities based on input snapshot keys
- `addModifier(abilityId, modifier)` / `removeModifier(abilityId, modifierId)` — apply or remove buffs/debuffs
- `getState()` / `applyState(state)` — serialize/restore for network sync (equipped list, active list, params, modifiers)

### Modifier System

<sub>Source: `client/src/abilities/ModifierStack.js`</sub>

Modifiers are buffs/debuffs that dynamically alter ability parameters at runtime.
Resolution formula: `(base + sum(additives)) * product(multiplicatives)`.
Each modifier is an object: `{ id, param, op: 'add'|'mul', value, source }`.
- `id` — unique identifier (upserted if duplicate)
- `param` — which ability param to modify (e.g. `'speed'`, `'stepHeight'`)
- `op` — `'add'` for flat bonus, `'mul'` for percentage multiplier
- `value` — numeric modifier value
- `source` — string tag for bulk removal via `clearModifiers(abilityId, source)`

<!-- @doc-auto-end -->
