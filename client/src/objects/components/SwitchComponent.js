// --- SwitchComponent ---
// Toggle switch/lever. Flips isOn on interact, emits switch:on/switch:off
// and switch:toggled for connection routing. Prompt text changes with state.

import { Component } from '../Component.js';
import { componentRegistry } from '../ComponentRegistry.js';

// @doc-creator-content 02:Components > Switch Component
// Toggle switch (lever, button, pressure plate). Flips `isOn` on interact and
// emits `switch:on`/`switch:off` plus `switch:toggled` events. Connected objects
// (e.g. doors) can listen for these events via the connection system.
// Parameters: `isOn` (initial state), `promptOn` (text when on), `promptOff` (text when off).

export class SwitchComponent extends Component {
  onInteract(_player) {
    this.params.isOn = !this.params.isOn;
    this.owner.notifyStateChanged();

    const eventName = this.params.isOn ? 'switch:on' : 'switch:off';
    this.owner.emit(eventName, { switchId: this.owner.id, isOn: this.params.isOn });
    this.owner.emit('switch:toggled', { switchId: this.owner.id, isOn: this.params.isOn });
  }

  get promptText() {
    return this.params.isOn ? this.params.promptOff : this.params.promptOn;
  }

  getState() {
    return { isOn: this.params.isOn };
  }

  applyState(state) {
    if (!state) return;
    this.params.isOn = !!state.isOn;
  }
}

componentRegistry.register('switch', SwitchComponent);
