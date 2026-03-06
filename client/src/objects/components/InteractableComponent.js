// --- InteractableComponent ---
// Generic interactable trigger. Emits an event when a player interacts.
// Used as a building block — other components (door, container) add their
// own interactable, but standalone interactable is useful for scripted objects.

import { Component } from '../Component.js';
import { componentRegistry } from '../ComponentRegistry.js';

export class InteractableComponent extends Component {
  onInteract(player) {
    this.owner.emit('interact', {
      objectId: this.owner.id,
      objectType: this.owner.type,
      playerX: player?.x,
      playerY: player?.y,
    });
  }

  onTouch(player) {
    this.owner.emit('touch', {
      objectId: this.owner.id,
      playerX: player?.x,
      playerY: player?.y,
    });
  }

  onStep(player) {
    this.owner.emit('step', {
      objectId: this.owner.id,
      playerX: player?.x,
      playerY: player?.y,
    });
  }
}

componentRegistry.register('interactable', InteractableComponent);
