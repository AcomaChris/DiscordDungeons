import { CHAR_HEIGHT, FLOOR_HEIGHT } from '../core/Constants.js';

// --- RemotePlayer ---
// Renders a network-synced player. Position set from server state via lerp.
// AGENT: No physics simulation — position is authoritative from the server.

const LERP_FACTOR = 0.3;

export class RemotePlayer {
  constructor(scene, colorIndex, playerName) {
    this.scene = scene;
    this.texturePrefix = `player-${colorIndex}`;

    const { width, height } = scene.scale;
    const spawnX = width / 2;
    const spawnY = height - FLOOR_HEIGHT - CHAR_HEIGHT / 2;

    this.sprite = scene.add.sprite(spawnX, spawnY, `${this.texturePrefix}-right`);
    this._targetX = spawnX;
    this._targetY = spawnY;
    this._facing = 'right';

    this.nameLabel = scene.add.text(spawnX, spawnY - CHAR_HEIGHT / 2 - 4, playerName || 'Player', {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);
  }

  setPlayerName(name) {
    this.nameLabel.setText(name);
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
    this.nameLabel.setPosition(this.sprite.x, this.sprite.y - CHAR_HEIGHT / 2 - 4);
  }

  destroy() {
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
