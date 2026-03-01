import { CHAR_HEIGHT, TEXTURE_SCALE } from '../core/Constants.js';

// --- RemotePlayer ---
// Renders a network-synced player. Position set from server state via lerp.
// AGENT: No physics simulation — position is authoritative from the server.

const LERP_FACTOR = 0.3;

export class RemotePlayer {
  constructor(scene, colorIndex, spawnX, spawnY, playerName) {
    this.scene = scene;
    this.texturePrefix = `player-${colorIndex}`;

    this.sprite = scene.add.sprite(spawnX, spawnY, `${this.texturePrefix}-down`);
    this.sprite.setScale(1 / TEXTURE_SCALE);
    this._targetX = spawnX;
    this._targetY = spawnY;
    this._facing = 'down';

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

  // Y-sorted depth: compare base (feet) position so objects lower on screen
  // render in front. sprite.y is center; feet are CHAR_HEIGHT/2 below that.
  updateDepth() {
    const feetY = this.sprite.y + CHAR_HEIGHT / 2;
    this.sprite.setDepth(feetY);
    this.nameLabel.setDepth(feetY + 1);
  }

  destroy() {
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
