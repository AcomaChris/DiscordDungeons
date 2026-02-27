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
    this._jumpRequested = false;

    this._buildKeyObjects();
  }

  _buildKeyObjects() {
    this._destroyKeyObjects();

    for (const [action, keyCodes] of Object.entries(this.bindings)) {
      this.keyObjects[action] = keyCodes.map((code) =>
        this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code]),
      );
    }

    // "Just pressed" pattern for jump — set flag on keydown, consume once per update
    for (const key of this.keyObjects[Actions.JUMP]) {
      key.on('down', this._onJumpDown, this);
    }
  }

  _onJumpDown() {
    this._jumpRequested = true;
  }

  update() {
    const leftHeld = this.keyObjects[Actions.MOVE_LEFT].some((k) => k.isDown);
    const rightHeld = this.keyObjects[Actions.MOVE_RIGHT].some((k) => k.isDown);

    let moveX = 0;
    if (leftHeld && !rightHeld) moveX = -1;
    else if (rightHeld && !leftHeld) moveX = 1;

    const jump = this._jumpRequested;
    this._jumpRequested = false;

    eventBus.emit(INPUT_ACTION, { moveX, jump });
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
