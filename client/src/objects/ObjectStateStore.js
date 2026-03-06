// --- ObjectStateStore ---
// Three-tier persistence for interactive object state:
//   - volatile: memory only, lost on page reload (default)
//   - session: sessionStorage, survives reload but not tab close
//   - persistent: server-stored via network (future)
//
// AGENT: Each object's persistence tier is determined by its components'
// persistence settings. The highest-priority tier wins (persistent > session > volatile).

const SESSION_KEY = 'dd_object_states';

export class ObjectStateStore {
  constructor() {
    // In-memory volatile store: Map<objectId, state>
    this._volatile = new Map();

    // Session cache loaded lazily from sessionStorage
    this._sessionCache = null;
  }

  // Save an object's state to the appropriate tier
  save(objectId, state, persistence) {
    switch (persistence) {
      case 'session':
        this._saveSession(objectId, state);
        break;
      case 'persistent':
        // TODO: send to server via network
        this._saveSession(objectId, state); // fall back to session for now
        break;
      default: // volatile
        this._volatile.set(objectId, state);
        break;
    }
  }

  // Load an object's state from any tier (checks persistent > session > volatile)
  load(objectId) {
    // Check session first (higher priority than volatile)
    const sessionState = this._loadSession(objectId);
    if (sessionState) return sessionState;

    // Fall back to volatile
    return this._volatile.get(objectId) || null;
  }

  // Remove state for an object from all tiers
  remove(objectId) {
    this._volatile.delete(objectId);
    this._removeSession(objectId);
  }

  // Clear all stored state
  clear() {
    this._volatile.clear();
    this._sessionCache = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  }

  // --- Session Storage ---

  _getSessionData() {
    if (this._sessionCache !== null) return this._sessionCache;
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      this._sessionCache = raw ? JSON.parse(raw) : {};
    } catch {
      this._sessionCache = {};
    }
    return this._sessionCache;
  }

  _flushSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(this._sessionCache || {}));
    } catch { /* quota exceeded or unavailable */ }
  }

  _saveSession(objectId, state) {
    const data = this._getSessionData();
    data[objectId] = state;
    this._flushSession();
  }

  _loadSession(objectId) {
    const data = this._getSessionData();
    return data[objectId] || null;
  }

  _removeSession(objectId) {
    const data = this._getSessionData();
    delete data[objectId];
    this._flushSession();
  }

  // --- Bulk Operations ---

  // Save all objects' states (called on map unload)
  saveAll(objectManager) {
    for (const obj of objectManager.all) {
      const persistence = this._getObjectPersistence(obj);
      if (persistence !== 'volatile') {
        this.save(obj.id, obj.getState(), persistence);
      }
    }
  }

  // Restore saved states to objects (called after map load)
  restoreAll(objectManager) {
    for (const obj of objectManager.all) {
      const state = this.load(obj.id);
      if (state) {
        obj.applyState(state);
      }
    }
  }

  // Determine the highest persistence tier among an object's components
  _getObjectPersistence(obj) {
    let highest = 'volatile';
    for (const comp of obj.components) {
      if (comp.persistence === 'persistent') return 'persistent';
      if (comp.persistence === 'session') highest = 'session';
    }
    return highest;
  }
}

// Singleton
const objectStateStore = new ObjectStateStore();
export default objectStateStore;
