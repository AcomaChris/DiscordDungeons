// --- DestructibleComponent ---
// Event-driven destructible. No player trigger (trigger: none).
// Takes damage via onEvent('damage', { amount }). Emits destructible:damaged
// and destructible:destroyed with drops when health reaches 0.

import { Component } from '../Component.js';
import { componentRegistry } from '../ComponentRegistry.js';

export class DestructibleComponent extends Component {
  onEvent(eventName, data) {
    if (eventName !== 'damage') return;
    if (this.params.health <= 0) return;

    const amount = data?.amount || 0;
    if (amount <= 0) return;

    this.params.health = Math.max(0, this.params.health - amount);
    this.owner.notifyStateChanged();

    this.owner.emit('destructible:damaged', {
      objectId: this.owner.id,
      health: this.params.health,
      maxHealth: this.params.maxHealth,
      damage: amount,
    });

    if (this.params.health <= 0) {
      this.owner.emit('destructible:destroyed', {
        objectId: this.owner.id,
        drops: [...this.params.drops],
      });
    }
  }

  get isDestroyed() {
    return this.params.health <= 0;
  }

  getState() {
    return { health: this.params.health };
  }

  applyState(state) {
    if (!state) return;
    if (state.health !== undefined) this.params.health = state.health;
  }
}

componentRegistry.register('destructible', DestructibleComponent);
