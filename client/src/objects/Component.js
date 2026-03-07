// --- Component Base Class ---
// All interactive object components extend this. Provides lifecycle hooks
// that the ComponentManager calls. Subclasses override the hooks they need.
//
// AGENT: Components should NOT directly modify other objects or the scene.
// Use this.owner.emit() to communicate via events. The owner is the
// InteractiveObject that holds this component.

// @doc-creator-content 02:Components > Base Class
// All interactive object components extend this class. Override lifecycle hooks as needed:
// | Hook | Trigger | Purpose |
// |------|---------|---------|
// | `init()` | Once after creation | Setup, cache references |
// | `update(delta)` | Each frame | Per-frame logic (delta in ms) |
// | `onInteract(player)` | Player presses E | `trigger: 'interact'` components |
// | `onTouch(player)` | Physics overlap | `trigger: 'touch'` components |
// | `onStep(player)` | Standing on tile | `trigger: 'step'` components |
// | `onEvent(eventName, data)` | Routed event from another object | Cross-object communication |
// | `getState()` / `applyState(state)` | Persistence/network | Serialize and restore component state |

export class Component {
  constructor(owner, def, overrides = {}) {
    this.owner = owner;
    this.def = def;
    this.id = def.id;
    this.authority = def.authority;
    this.persistence = def.persistence;
    this.trigger = overrides.trigger || def.trigger;

    // Merge default params with per-instance overrides
    this.params = { ...def.params, ...overrides };
  }

  // Called once after the owner InteractiveObject is fully initialized
  init() {}

  // Called each frame with delta in ms
  update(/* delta */) {}

  // Called when a player presses E near this object (trigger: 'interact')
  onInteract(/* player */) {}

  // Called when a player's physics body overlaps this object (trigger: 'touch')
  onTouch(/* player */) {}

  // Called when a player stands on this object's tile (trigger: 'step')
  onStep(/* player */) {}

  // Called when this object receives an event (from EventRouter)
  onEvent(/* eventName, data */) {}

  // Serialize component state for persistence/network
  getState() {
    return { ...this.params };
  }

  // Restore component state from persistence/network
  applyState(state) {
    if (!state) return;
    Object.assign(this.params, state);
  }

  // Called when the owner is destroyed
  destroy() {
    this.owner = null;
  }
}
