import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import { INPUT_ACTION, INPUT_FOCUS_CHANGED } from '../core/Events.js';
import { Actions, DEFAULT_KEY_BINDINGS } from './InputActions.js';
import { isGameInputActive } from '../core/InputContext.js';

// --- InputManager ---
// Maps physical keyboard input to logical game actions.
// Emits a single INPUT_ACTION event per frame with the full input snapshot.
// Subscribes to INPUT_FOCUS_CHANGED to toggle keyboard capture immediately
// when UI overlays acquire/release focus.

export class InputManager {
  constructor(scene) {
    this.scene = scene;
    this.bindings = {};
    for (const [action, keys] of Object.entries(DEFAULT_KEY_BINDINGS)) {
      this.bindings[action] = [...keys];
    }
    this.keyObjects = {};

    this._onFocusChanged = ({ active }) => {
      this._gameInputActive = active;
      if (!active) {
        this.scene.input.keyboard.enabled = false;
        // Release Phaser's preventDefault captures so DOM form fields
        // receive WASD, Space, arrow keys, etc. normally.
        this.scene.input.keyboard.clearCaptures();
        eventBus.emit(INPUT_ACTION, { moveX: 0, moveY: 0, sprint: false, jump: false, interact: false });
      } else {
        this.scene.input.keyboard.enabled = true;
        this._restoreCaptures();
      }
    };
    eventBus.on(INPUT_FOCUS_CHANGED, this._onFocusChanged);

    this._buildKeyObjects();

    // Sync initial state AFTER building key objects, since addKey()
    // registers captures that must be cleared if UI is already focused.
    this._gameInputActive = isGameInputActive();
    if (!this._gameInputActive) {
      this.scene.input.keyboard.enabled = false;
      this.scene.input.keyboard.clearCaptures();
    }
  }

  _buildKeyObjects() {
    this._destroyKeyObjects();

    for (const [action, keyCodes] of Object.entries(this.bindings)) {
      this.keyObjects[action] = keyCodes.map((code) =>
        this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes[code]),
      );
    }
  }

  // Re-register preventDefault captures for all bound keys after UI releases focus.
  _restoreCaptures() {
    for (const keyCodes of Object.values(this.bindings)) {
      for (const code of keyCodes) {
        this.scene.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes[code]);
      }
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

    const sprintHeld = this.keyObjects[Actions.SPRINT]?.some((k) => k.isDown) ?? false;
    const jumpHeld = this.keyObjects[Actions.JUMP]?.some((k) => k.isDown) ?? false;
    const interactHeld = this.keyObjects[Actions.INTERACT]?.some((k) => k.isDown) ?? false;
    return { moveX, moveY, sprint: sprintHeld, jump: jumpHeld, interact: interactHeld };
  }

  update() {
    if (!this._gameInputActive) {
      eventBus.emit(INPUT_ACTION, { moveX: 0, moveY: 0, sprint: false, jump: false, interact: false });
      return;
    }

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
    eventBus.off(INPUT_FOCUS_CHANGED, this._onFocusChanged);
    this._destroyKeyObjects();
  }
}
