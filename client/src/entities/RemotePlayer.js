import { CHAR_HEIGHT, FLOOR_HEIGHT } from '../core/Constants.js';

// --- RemotePlayer ---
// Renders a network-synced player. Position set from server state via lerp.
// AGENT: No physics simulation — position is authoritative from the server.

const LERP_FACTOR = 0.3;

export class RemotePlayer {
  constructor(scene, colorIndex) {
    this.scene = scene;
    this.texturePrefix = `remote-${colorIndex}`;

    const { width, height } = scene.scale;
    const spawnX = width / 2;
    const spawnY = height - FLOOR_HEIGHT - CHAR_HEIGHT / 2;

    this.sprite = scene.add.sprite(spawnX, spawnY, `${this.texturePrefix}-right`);
    this._targetX = spawnX;
    this._targetY = spawnY;
    this._facing = 'right';
  }

  applyState({ x, y, facing }) {
    this._targetX = x;
    this._targetY = y;

    if (facing !== this._facing) {
      this._facing = facing;
      this.sprite.setTexture(`${this.texturePrefix}-${facing}`);
    }
  }

  update() {
    this.sprite.x += (this._targetX - this.sprite.x) * LERP_FACTOR;
    this.sprite.y += (this._targetY - this.sprite.y) * LERP_FACTOR;
  }

  destroy() {
    this.sprite.destroy();
  }
}
