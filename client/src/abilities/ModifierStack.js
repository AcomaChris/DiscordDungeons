// --- ModifierStack ---
// Resolves a base param value through additive and multiplicative modifiers.
// Resolution order: base + sum(additive), then × product(multiplicative).
// AGENT: Pure function, no side effects, no Phaser dependency.

// @doc-creator-content 01:Abilities > Modifier System
// Modifiers are buffs/debuffs that dynamically alter ability parameters at runtime.
// Resolution formula: `(base + sum(additives)) * product(multiplicatives)`.
// Each modifier is an object: `{ id, param, op: 'add'|'mul', value, source }`.
// - `id` — unique identifier (upserted if duplicate)
// - `param` — which ability param to modify (e.g. `'speed'`, `'stepHeight'`)
// - `op` — `'add'` for flat bonus, `'mul'` for percentage multiplier
// - `value` — numeric modifier value
// - `source` — string tag for bulk removal via `clearModifiers(abilityId, source)`

export const ModifierOp = {
  ADD: 'add',
  MUL: 'mul',
};

export function resolveParam(baseValue, modifiers, paramName) {
  let additiveSum = 0;
  let multiplicativeProduct = 1;

  for (const mod of modifiers) {
    if (mod.param !== paramName) continue;
    if (mod.op === ModifierOp.ADD) {
      additiveSum += mod.value;
    } else if (mod.op === ModifierOp.MUL) {
      multiplicativeProduct *= mod.value;
    }
  }

  return (baseValue + additiveSum) * multiplicativeProduct;
}
