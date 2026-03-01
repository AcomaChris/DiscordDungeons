// --- ModifierStack ---
// Resolves a base param value through additive and multiplicative modifiers.
// Resolution order: base + sum(additive), then × product(multiplicative).
// AGENT: Pure function, no side effects, no Phaser dependency.

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
