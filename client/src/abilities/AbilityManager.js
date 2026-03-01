// --- AbilityManager ---
// Per-player ability state. Tracks equipped abilities, activation state,
// and provides param access + network serialization.
// AGENT: One instance per Player/RemotePlayer. Not shared.

import { ABILITY_DEFS, AbilityType, DEFAULT_ABILITIES } from './AbilityDefs.js';

export class AbilityManager {
  constructor() {
    // Map<abilityId, { def, params, active }>
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
    });
  }

  unequip(abilityId) {
    this._abilities.delete(abilityId);
  }

  has(abilityId) {
    return this._abilities.has(abilityId);
  }

  get(abilityId) {
    const entry = this._abilities.get(abilityId);
    if (!entry) return null;
    return { params: entry.params, active: entry.active };
  }

  getParam(abilityId, paramName) {
    const entry = this._abilities.get(abilityId);
    return entry?.params[paramName];
  }

  setParam(abilityId, paramName, value) {
    const entry = this._abilities.get(abilityId);
    if (entry) entry.params[paramName] = value;
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

    for (const [id, entry] of this._abilities) {
      equipped.push(id);
      if (entry.active) active.push(id);
      params[id] = { ...entry.params };
    }

    return { equipped, active, params };
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
    }
  }
}
