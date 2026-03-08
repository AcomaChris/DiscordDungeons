// --- DexterityController ---
// Bridges dexterity stat level to the ability system. Listens to STATS_CHANGED
// and reconfigures the player's AbilityManager accordingly.

import eventBus from '../core/EventBus.js';
import { STATS_CHANGED } from '../core/Events.js';
import { DEX_UNLOCKS } from './StatDefs.js';
import statsManager from './StatsManager.js';

const DEX_ABILITIES = ['movement', 'sprint', 'jump', 'mantle', 'float'];

export class DexterityController {
  constructor(abilityManager) {
    this._abilities = abilityManager;
    this._onStatsChanged = ({ attributes }) => this.applyDexLevel(attributes.dexterity);
    eventBus.on(STATS_CHANGED, this._onStatsChanged);
    // Apply immediately using current stats defaults
    this.applyDexLevel(statsManager.getStat('dexterity'));
  }

  applyDexLevel(dexLevel) {
    const unlock = DEX_UNLOCKS[dexLevel];
    if (!unlock) return;

    const shouldHave = new Set(unlock.abilities);

    // Unequip abilities player shouldn't have at this level
    for (const id of DEX_ABILITIES) {
      if (!shouldHave.has(id) && this._abilities.has(id)) {
        this._abilities.unequip(id);
      }
    }

    // Equip abilities player should have
    for (const id of shouldHave) {
      if (!this._abilities.has(id)) {
        this._abilities.equip(id);
      }
    }

    // Double jump param on jump ability
    if (this._abilities.has('jump')) {
      this._abilities.setParam('jump', 'doubleJumpEnabled', !!unlock.doubleJump);
    }
  }

  destroy() {
    eventBus.off(STATS_CHANGED, this._onStatsChanged);
  }
}
