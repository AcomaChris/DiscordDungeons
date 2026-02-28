import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import { INPUT_ACTION } from '../core/Events.js';
import { Actions, DEFAULT_KEY_BINDINGS } from './InputActions.js';

// --- InputManager ---
// Maps physical keyboard input to logical game actions.
// Emits a single INPUT_ACTION event per frame with the full input snapshot.

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.bindings = {};
    for (const [action, keys] of Object.entries(DEFAULT_KEY_BINDINGS)) {
      this.bindings[action] = [...keys];
    }
    this.keyObjects = {};

    this._buildKeyObjects();
  }

  _buildKeyObjects() {
    this._destroyKeyObjects();

    for (const [action, keyCodes] of Object.entries(this.bindings)) {
      this.keyObjects[action] = keyCodes.map((code) =>
        this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code]),
      );
    }
  }

  getSnapshot() {
    const leftHeld = this.keyObjects[Actions.MOVE_LEFT].some((k) => k.isDown);
    const rightHeld = this.keyObjects[Actions.MOVE_RIGHT].some((k) => k.isDown);
    const upHeld = this.keyObjects[Actions.MOVE_UP].some((k) => k.isDown);
    const downHeld = this.keyObjects[Actions.MOVE_DOWN].some((k) => k.isDown);

    let moveX = 0;
    if (leftHeld && !rightHeld) moveX = -1;
    else if (rightHeld && !leftHeld) moveX = 1;

    let moveY = 0;
    if (upHeld && !downHeld) moveY = -1;
    else if (downHeld && !upHeld) moveY = 1;

    return { moveX, moveY };
  }

  update() {
    eventBus.emit(INPUT_ACTION, this.getSnapshot());
  }

  rebind(action, newKeyCodes) {
    this.bindings[action] = newKeyCodes;
    this._buildKeyObjects();
  }

  _destroyKeyObjects() {
    for (const keys of Object.values(this.keyObjects)) {
      for (const key of keys) {
        key.removeAllListeners();
        this.scene.input.keyboard.removeKey(key);
      }
    }
    this.keyObjects = {};
  }

  destroy() {
    this._destroyKeyObjects();
  }
}
