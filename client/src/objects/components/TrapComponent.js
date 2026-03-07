// --- TrapComponent ---
// Step-triggered trap. When armed, emits trap:triggered with damage on step.
// Disarms after firing, then rearms after rearmDelay ms.

import { Component } from '../Component.js';
import { componentRegistry } from '../ComponentRegistry.js';

// @doc-creator-content 02:Components > Trap Component
// Step-triggered damage trap. When `armed` and a player steps on it, emits
// `trap:triggered` with the `damage` value, then disarms. Automatically rearms
// after `rearmDelay` milliseconds (0 = stays disarmed). Emits `trap:rearmed` on rearm.
// Parameters: `damage` (number), `armed` (boolean), `rearmDelay` (ms).

export class TrapComponent extends Component {
  init() {
    this._rearmTimer = null;
  }

  onStep(_player) {
    if (!this.params.armed) return;

    this.params.armed = false;
    this.owner.notifyStateChanged();

    this.owner.emit('trap:triggered', {
      trapId: this.owner.id,
      damage: this.params.damage,
    });

    // Schedule rearm
    if (this.params.rearmDelay > 0) {
      this._rearmTimer = setTimeout(() => {
        this.params.armed = true;
        this._rearmTimer = null;
        this.owner.notifyStateChanged();
        this.owner.emit('trap:rearmed', { trapId: this.owner.id });
      }, this.params.rearmDelay);
    }
  }

  getState() {
    return { armed: this.params.armed };
  }

  applyState(state) {
    if (!state) return;
    this.params.armed = !!state.armed;
  }

  destroy() {
    if (this._rearmTimer) {
      clearTimeout(this._rearmTimer);
      this._rearmTimer = null;
    }
    super.destroy();
  }
}

componentRegistry.register('trap', TrapComponent);
