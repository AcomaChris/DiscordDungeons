// --- EventBus ---
// Standalone pub/sub for decoupled communication between game systems.
// Not tied to Phaser lifecycle — outlives individual scenes.

class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
  }

  off(event, callback) {
    const list = this._listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(callback);
    if (idx !== -1) list.splice(idx, 1);
  }

  emit(event, ...args) {
    const list = this._listeners.get(event);
    if (!list) return;
    for (const cb of list) {
      cb(...args);
    }
  }

  reset() {
    this._listeners.clear();
  }
}

const eventBus = new EventBus();
export default eventBus;
export { EventBus };
