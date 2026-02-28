import eventBus from '../core/EventBus.js';
import { PLAYER_MOVED } from '../core/Events.js';
import { MOVE_SPEED, CHAR_HEIGHT, TEXTURE_SCALE } from '../core/Constants.js';

// --- Player ---
// Wraps the local player sprite, handles 4-directional input, emits state
// for network sync. Uses a feet-only hitbox for natural 3/4 view overlap.

const SQRT2 = Math.sqrt(2);

export class Player {
  constructor(scene, spawnX, spawnY, playerName) {
    this.scene = scene;
    this.facing = 'down';
    this.texturePrefix = 'player-0';

    this.sprite = scene.physics.add.sprite(spawnX, spawnY, 'player-0-down');
    this.sprite.setScale(1 / TEXTURE_SCALE);

    // Feet-only collision body: only the bottom 8px of the character collides.
    // This is standard for 3/4 view — the character's upper body overlaps
    // walls and objects naturally.
    this.sprite.body.setSize(12, 8);
    this.sprite.body.setOffset(
      (this.sprite.width - 12) / 2,
      this.sprite.height - 8,
    );

    this.nameLabel = scene.add.text(spawnX, spawnY - CHAR_HEIGHT / 2 - 4, playerName || 'Player', {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);

    // Position the label after physics so it tracks the sprite's final position
    // for the current frame. Doing this in handleInput() causes 1-frame lag
    // because physics hasn't moved the sprite yet at that point.
    this._postUpdate = () => {
      this.nameLabel.setPosition(
        this.sprite.x,
        this.sprite.y - CHAR_HEIGHT / 2 - 4,
      );
    };
    scene.events.on('postupdate', this._postUpdate);
  }

  setColorIndex(colorIndex) {
    this.texturePrefix = `player-${colorIndex}`;
    this.sprite.setTexture(`${this.texturePrefix}-${this.facing}`);
  }

  handleInput({ moveX, moveY }) {
    let vx = moveX * MOVE_SPEED;
    let vy = moveY * MOVE_SPEED;

    // Normalize diagonal so total speed equals MOVE_SPEED
    if (moveX !== 0 && moveY !== 0) {
      vx /= SQRT2;
      vy /= SQRT2;
    }

    this.sprite.setVelocity(vx, vy);

    // Update facing direction — prefer vertical when both axes active
    let newFacing = this.facing;
    if (moveY < 0) newFacing = 'up';
    else if (moveY > 0) newFacing = 'down';
    else if (moveX < 0) newFacing = 'left';
    else if (moveX > 0) newFacing = 'right';

    if (newFacing !== this.facing) {
      this.facing = newFacing;
      this.sprite.setTexture(`${this.texturePrefix}-${this.facing}`);
    }

    eventBus.emit(PLAYER_MOVED, this.getState());
  }

  // Y-sorted depth: objects lower on screen render in front
  updateDepth() {
    this.sprite.setDepth(this.sprite.y);
    this.nameLabel.setDepth(this.sprite.y + 1);
  }

  getState() {
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      facing: this.facing,
    };
  }

  destroy() {
    this.scene.events.off('postupdate', this._postUpdate);
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
