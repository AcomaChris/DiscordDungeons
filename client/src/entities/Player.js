import eventBus from '../core/EventBus.js';
import { PLAYER_MOVED } from '../core/Events.js';
import { MOVE_SPEED, JUMP_VELOCITY, CHAR_HEIGHT, FLOOR_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, TEXTURE_SCALE } from '../core/Constants.js';

// --- Player ---
// Wraps the local player sprite, handles input actions, emits state for network.

export class Player {
  constructor(scene, floor, playerName) {
    this.scene = scene;
    this.facing = 'right';
    this.texturePrefix = 'player-0';

    const spawnX = WORLD_WIDTH / 2;
    const spawnY = WORLD_HEIGHT - FLOOR_HEIGHT - CHAR_HEIGHT / 2;

    this.sprite = scene.physics.add.sprite(spawnX, spawnY, 'player-0-right');
    this.sprite.setScale(1 / TEXTURE_SCALE);
    this.sprite.setCollideWorldBounds(true);
    scene.physics.add.collider(this.sprite, floor);

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
        this.sprite.y - CHAR_HEIGHT / 2 - 4
      );
    };
    scene.events.on('postupdate', this._postUpdate);
  }

  setColorIndex(colorIndex) {
    this.texturePrefix = `player-${colorIndex}`;
    this.sprite.setTexture(`${this.texturePrefix}-${this.facing}`);
  }

  handleInput({ moveX, jump }) {
    this.sprite.setVelocityX(moveX * MOVE_SPEED);

    if (moveX < 0 && this.facing !== 'left') {
      this.facing = 'left';
      this.sprite.setTexture(`${this.texturePrefix}-left`);
    } else if (moveX > 0 && this.facing !== 'right') {
      this.facing = 'right';
      this.sprite.setTexture(`${this.texturePrefix}-right`);
    }

    const onGround = this.sprite.body.touching.down || this.sprite.body.blocked.down;
    if (jump && onGround) {
      this.sprite.setVelocityY(JUMP_VELOCITY);
    }

    eventBus.emit(PLAYER_MOVED, this.getState());
  }

  getState() {
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      vx: this.sprite.body.velocity.x,
      vy: this.sprite.body.velocity.y,
      facing: this.facing,
    };
  }

  destroy() {
    this.scene.events.off('postupdate', this._postUpdate);
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
