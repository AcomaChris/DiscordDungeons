// --- ContainerUI ---
// Floating panel that displays container contents when opened.
// Renders as a Phaser container with text items. Positioned above
// the object in world space. Closes on second E press or walk away.
//
// AGENT: This is a temporary UI until a proper inventory system exists.
// It shows item names in a simple list format.

import { DEPTH_ABOVE_PLAYER } from '../core/Constants.js';

export class ContainerUI {
  constructor(scene) {
    this._scene = scene;
    this._container = null;
    this._activeObject = null;
  }

  // Show the container UI for a given InteractiveObject
  show(interactiveObj) {
    this.hide(); // Close any existing panel

    const comp = interactiveObj.components.get('container');
    if (!comp) return;

    this._activeObject = interactiveObj;
    const items = comp.items;

    // Build UI elements
    const x = interactiveObj.centerX;
    const y = interactiveObj.y - 8;

    const bg = this._scene.add.rectangle(0, 0, 80, Math.max(30, 12 + items.length * 12), 0x222222, 0.9);
    bg.setStrokeStyle(1, 0xaaaaaa);
    bg.setOrigin(0.5, 1);

    const title = this._scene.add.text(0, -bg.height + 4, 'Contents:', {
      fontFamily: 'monospace', fontSize: '8px', color: '#cccccc',
    });
    title.setOrigin(0.5, 0);

    const children = [bg, title];

    if (items.length === 0) {
      const empty = this._scene.add.text(0, -bg.height + 16, '(empty)', {
        fontFamily: 'monospace', fontSize: '7px', color: '#888888',
      });
      empty.setOrigin(0.5, 0);
      children.push(empty);
    } else {
      items.forEach((item, i) => {
        const label = `${item.name || item.id}${item.quantity > 1 ? ` x${item.quantity}` : ''}`;
        const text = this._scene.add.text(0, -bg.height + 16 + i * 12, label, {
          fontFamily: 'monospace', fontSize: '7px', color: '#ffffff',
        });
        text.setOrigin(0.5, 0);
        children.push(text);
      });
    }

    this._container = this._scene.add.container(x, y, children);
    this._container.setDepth(DEPTH_ABOVE_PLAYER + 20);

    // Register close callback
    comp.onCloseCallback(() => this.hide());
  }

  hide() {
    if (this._container) {
      this._container.destroy();
      this._container = null;
    }
    this._activeObject = null;
  }

  get isVisible() {
    return this._container !== null;
  }

  get activeObject() {
    return this._activeObject;
  }

  destroy() {
    this.hide();
  }
}
