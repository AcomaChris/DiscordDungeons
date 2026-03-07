import { CHAR_HEIGHT, TEXTURE_SCALE, PLAYER_COLORS } from '../core/Constants.js';
import { generatePlayerTextures } from './PlayerTextureGenerator.js';
import { AbilityManager } from '../abilities/AbilityManager.js';
import { createShadow, updateShadow } from './ShadowHelper.js';

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
    this._startZ = 0;
    this._targetX = spawnX;
    this._targetY = spawnY;
    this._targetZ = 0;
    this._elapsed = INTERP_DURATION;
    this._facing = 'down';
    this.abilities = new AbilityManager();

    // --- Z-axis state ---
    this.z = 0;
    this._groundY = spawnY;

    // --- Shadow ---
    this._shadow = createShadow(scene, spawnX, spawnY);

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

  applyState({ x, y, z, facing, color, ghost, abilities }) {
    // Start interpolating from current position to the new target
    this._startX = this.sprite.x;
    this._startY = this._groundY;
    this._startZ = this.z;
    this._targetX = x;
    this._targetY = y;
    this._targetZ = z ?? 0;
    this._elapsed = 0;

    if (color !== undefined && color !== this.color) {
      this.setColor(color);
    }

    if (facing !== this._facing) {
      this._facing = facing;
      this.sprite.setTexture(`${this.texturePrefix}-${facing}`);
    }

    if (ghost !== undefined) {
      this.sprite.setAlpha(ghost ? 0.4 : 1);
      this.nameLabel.setAlpha(ghost ? 0.4 : 1);
    }

    if (abilities) {
      this.abilities.applyState(abilities);
    }
  }

  update(delta) {
    this._elapsed += delta;
    const t = Math.min(this._elapsed / INTERP_DURATION, 1);
    this.sprite.x = this._startX + (this._targetX - this._startX) * t;
    this._groundY = this._startY + (this._targetY - this._startY) * t;
    this.z = this._startZ + (this._targetZ - this._startZ) * t;

    // Visual Y = ground Y - Z offset
    this.sprite.y = this._groundY - this.z;
    this.nameLabel.setPosition(this.sprite.x, this.sprite.y - CHAR_HEIGHT / 2 - 4);

    // Update shadow
    updateShadow(this._shadow, this.sprite.x, this._groundY, this.z, 0, this.sprite.depth);
  }

  // Y-sorted depth: uses _groundY (not sprite.y) so jumping doesn't change
  // render order — fixes issue #4.
  updateDepth() {
    const feetY = this._groundY + CHAR_HEIGHT / 2;
    this.sprite.setDepth(feetY);
    this.nameLabel.setDepth(feetY + 1);
  }

  destroy() {
    if (this._shadow) this._shadow.destroy();
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
