// --- InteractionPrompt ---
// Floating key indicator shown above interactable objects when the player
// is within range. Uses a Phaser Text object positioned in world space
// so it tracks with the camera automatically.
// AGENT: One instance reused across all objects — moves to whichever
// object is currently targeted. Set depth high so it renders above everything.

import { DEPTH_ABOVE_PLAYER } from '../core/Constants.js';

export class InteractionPrompt {
  constructor() {
    this._text = null;
    this._visible = false;
  }

  // Create the Phaser text object. Call once during scene create.
  create(scene) {
    this._text = scene.add.text(0, 0, '[E]', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: { x: 3, y: 1 },
    });
    this._text.setOrigin(0.5, 1); // center-bottom anchor → sits above object
    this._text.setDepth(DEPTH_ABOVE_PLAYER + 10);
    this._text.setVisible(false);
  }

  // Show the prompt above a world position.
  show(worldX, worldY, text) {
    if (!this._text) return;
    this._text.setText(text || '[E]');
    this._text.setPosition(worldX, worldY - 4);
    this._text.setVisible(true);
    this._visible = true;
  }

  hide() {
    if (!this._text || !this._visible) return;
    this._text.setVisible(false);
    this._visible = false;
  }

  get visible() {
    return this._visible;
  }

  destroy() {
    if (this._text) {
      this._text.destroy();
      this._text = null;
    }
    this._visible = false;
  }
}
