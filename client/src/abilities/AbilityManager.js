// --- AbilityManager ---
// Per-player ability state. Tracks equipped abilities, activation state,
// modifier stacks, and provides param access + network serialization.
// AGENT: One instance per Player/RemotePlayer. Not shared.

import { ABILITY_DEFS, AbilityType, DEFAULT_ABILITIES } from './AbilityDefs.js';
import { resolveParam } from './ModifierStack.js';

export class AbilityManager {
  constructor() {
    // Map<abilityId, { def, params, active, modifiers: [] }>
    this._abilities = new Map();

    for (const id of DEFAULT_ABILITIES) {
      this.equip(id);
    }
  }

  equip(abilityId) {
    const def = ABILITY_DEFS[abilityId];
    if (!def) return;
    this._abilities.set(abilityId, {
      def,
      params: { ...def.params },
      active: def.type === AbilityType.PASSIVE,
      modifiers: [],
    });
  }

  unequip(abilityId) {
    this._abilities.delete(abilityId);
  }

  has(abilityId) {
    return this._abilities.has(abilityId);
  }

  // Returns resolved params (base + modifiers applied)
  get(abilityId) {
    const entry = this._abilities.get(abilityId);
    if (!entry) return null;
    const resolved = {};
    for (const paramName of Object.keys(entry.params)) {
      resolved[paramName] = entry.modifiers.length > 0
        ? resolveParam(entry.params[paramName], entry.modifiers, paramName)
        : entry.params[paramName];
    }
    return { params: resolved, active: entry.active };
  }

  // Returns resolved value (base + modifiers)
  getParam(abilityId, paramName) {
    const entry = this._abilities.get(abilityId);
    if (!entry) return undefined;
    const base = entry.params[paramName];
    if (base === undefined) return undefined;
    if (entry.modifiers.length === 0) return base;
    return resolveParam(base, entry.modifiers, paramName);
  }

  // Returns raw base value without modifiers
  getBaseParam(abilityId, paramName) {
    const entry = this._abilities.get(abilityId);
    return entry?.params[paramName];
  }

  setParam(abilityId, paramName, value) {
    const entry = this._abilities.get(abilityId);
    if (entry) entry.params[paramName] = value;
  }

  // --- Modifiers ---

  addModifier(abilityId, modifier) {
    const entry = this._abilities.get(abilityId);
    if (!entry) return false;
    // Upsert: replace existing modifier with same id
    const idx = entry.modifiers.findIndex((m) => m.id === modifier.id);
    if (idx !== -1) {
      entry.modifiers[idx] = { ...modifier };
    } else {
      entry.modifiers.push({ ...modifier });
    }
    return true;
  }

  removeModifier(abilityId, modifierId) {
    const entry = this._abilities.get(abilityId);
    if (!entry) return false;
    const idx = entry.modifiers.findIndex((m) => m.id === modifierId);
    if (idx === -1) return false;
    entry.modifiers.splice(idx, 1);
    return true;
  }

  getModifiers(abilityId) {
    const entry = this._abilities.get(abilityId);
    return entry?.modifiers ?? [];
  }

  clearModifiers(abilityId, source) {
    const entry = this._abilities.get(abilityId);
    if (!entry) return;
    if (source) {
      entry.modifiers = entry.modifiers.filter((m) => m.source !== source);
    } else {
      entry.modifiers = [];
    }
  }

  // --- Input ---
  // Sets active/inactive state on active-type abilities based on input snapshot.
  // Passive abilities are always active and ignored here.

  updateFromInput(inputSnapshot) {
    for (const [, entry] of this._abilities) {
      if (entry.def.type === AbilityType.ACTIVE && entry.def.inputKey) {
        entry.active = !!inputSnapshot[entry.def.inputKey];
      }
    }
  }

  // --- Network Serialization ---

  getState() {
    const equipped = [];
    const active = [];
    const params = {};
    const modifiers = {};

    for (const [id, entry] of this._abilities) {
      equipped.push(id);
      if (entry.active) active.push(id);
      params[id] = { ...entry.params };
      if (entry.modifiers.length > 0) {
        modifiers[id] = entry.modifiers.map((m) => ({ ...m }));
      }
    }

    return { equipped, active, params, modifiers };
  }

  applyState(state) {
    if (!state) return;

    const remoteEquipped = new Set(state.equipped || []);
    const remoteActive = new Set(state.active || []);

    // Remove abilities not in remote state
    for (const id of this._abilities.keys()) {
      if (!remoteEquipped.has(id)) this._abilities.delete(id);
    }

    // Add/update from remote state
    for (const id of remoteEquipped) {
      if (!this._abilities.has(id)) this.equip(id);
      const entry = this._abilities.get(id);
      if (!entry) continue;
      entry.active = remoteActive.has(id);
      if (state.params?.[id]) {
        entry.params = { ...entry.params, ...state.params[id] };
      }
      // Restore modifiers (backward-compat: field may not exist)
      if (state.modifiers?.[id]) {
        entry.modifiers = state.modifiers[id].map((m) => ({ ...m }));
      } else {
        entry.modifiers = [];
      }
    }
  }
}
