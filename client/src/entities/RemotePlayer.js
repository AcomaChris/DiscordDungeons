import { CHAR_HEIGHT, TEXTURE_SCALE, PLAYER_COLORS } from '../core/Constants.js';
import { generatePlayerTextures } from './PlayerTextureGenerator.js';

// --- RemotePlayer ---
// Renders a network-synced player. Position interpolated over the expected
// update interval so movement looks smooth between 10Hz state broadcasts.
// AGENT: No physics simulation — position is authoritative from the server.

// Duration to interpolate between state updates (matches server broadcast rate)
const INTERP_DURATION = 100; // ms

export class RemotePlayer {
  constructor(scene, colorIndex, spawnX, spawnY, playerName) {
    this.scene = scene;
    this.texturePrefix = `player-${colorIndex}`;
    this.color = PLAYER_COLORS[colorIndex];

    this.sprite = scene.add.sprite(spawnX, spawnY, `${this.texturePrefix}-down`);
    this.sprite.setScale(1 / TEXTURE_SCALE);
    this._startX = spawnX;
    this._startY = spawnY;
    this._targetX = spawnX;
    this._targetY = spawnY;
    this._elapsed = INTERP_DURATION;
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

  setColor(hexColor) {
    this.color = hexColor;
    generatePlayerTextures(this.scene, hexColor, this.texturePrefix);
    this.sprite.setTexture(`${this.texturePrefix}-${this._facing}`);
  }

  applyState({ x, y, facing, color }) {
    // Start interpolating from current position to the new target
    this._startX = this.sprite.x;
    this._startY = this.sprite.y;
    this._targetX = x;
    this._targetY = y;
    this._elapsed = 0;

    if (color !== undefined && color !== this.color) {
      this.setColor(color);
    }

    if (facing !== this._facing) {
      this._facing = facing;
      this.sprite.setTexture(`${this.texturePrefix}-${facing}`);
    }
  }

  update(delta) {
    this._elapsed += delta;
    const t = Math.min(this._elapsed / INTERP_DURATION, 1);
    this.sprite.x = this._startX + (this._targetX - this._startX) * t;
    this.sprite.y = this._startY + (this._targetY - this._startY) * t;
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
