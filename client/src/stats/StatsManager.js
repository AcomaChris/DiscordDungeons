// --- StatsManager ---
// Manages player stat attributes and stat points. Syncs to server with debounced saves.

import eventBus from '../core/EventBus.js';
import { STATS_CHANGED } from '../core/Events.js';
import { STAT_IDS, STAT_MAX, STAT_DEFAULT, STARTING_STAT_POINTS } from './StatDefs.js';
import authManager from '../auth/AuthManager.js';

const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';
const SAVE_DEBOUNCE_MS = 2000;

function makeDefaultAttributes() {
  const attrs = {};
  for (const id of STAT_IDS) attrs[id] = STAT_DEFAULT;
  return attrs;
}

class StatsManager {
  constructor() {
    this._attributes = makeDefaultAttributes();
    this._statPoints = STARTING_STAT_POINTS;
    this._saveTimer = null;
    this._loaded = false;
  }

  // --- Public API ---

  getStats() {
    return { ...this._attributes };
  }

  getStat(statId) {
    return this._attributes[statId];
  }

  getPoints() {
    return this._statPoints;
  }

  canUpgrade(statId) {
    return this._statPoints > 0 && this._attributes[statId] < STAT_MAX;
  }

  upgrade(statId) {
    if (!this.canUpgrade(statId)) return false;

    this._attributes[statId]++;
    this._statPoints--;
    this._onChange();
    return true;
  }

  get loaded() {
    return this._loaded;
  }

  // --- Server Sync ---

  async loadFromServer() {
    if (!authManager.sessionToken) return;

    try {
      const res = await fetch(`${AUTH_API_URL}/api/player`, {
        headers: { Authorization: `Bearer ${authManager.sessionToken}` },
      });
      if (!res.ok) throw new Error(`GET /api/player failed: ${res.status}`);

      const data = await res.json();
      const stats = data.stats || {};
      this._attributes = stats.attributes || makeDefaultAttributes();
      this._statPoints = stats.statPoints ?? STARTING_STAT_POINTS;
      this._loaded = true;
      eventBus.emit(STATS_CHANGED, { attributes: { ...this._attributes }, statPoints: this._statPoints });
    } catch (err) {
      console.warn('[StatsManager] Failed to load stats:', err);
    }
  }

  // --- Internal ---

  _onChange() {
    eventBus.emit(STATS_CHANGED, { attributes: { ...this._attributes }, statPoints: this._statPoints });
    this._scheduleSave();
  }

  _scheduleSave() {
    if (!authManager.sessionToken) return;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), SAVE_DEBOUNCE_MS);
  }

  async _save() {
    try {
      await fetch(`${AUTH_API_URL}/api/player/stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authManager.sessionToken}`,
        },
        body: JSON.stringify({ attributes: this._attributes, statPoints: this._statPoints }),
      });
    } catch (err) {
      console.warn('[StatsManager] Failed to save stats:', err);
    }
  }
}

// Singleton
const statsManager = new StatsManager();
export default statsManager;
