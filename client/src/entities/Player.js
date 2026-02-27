import eventBus from '../core/EventBus.js';
import { PLAYER_MOVED } from '../core/Events.js';
import { MOVE_SPEED, JUMP_VELOCITY, CHAR_HEIGHT, FLOOR_HEIGHT } from '../core/Constants.js';

// --- Player ---
// Wraps the local player sprite, handles input actions, emits state for network.

export class Player {
  constructor(scene, floor) {
    this.scene = scene;
    this.facing = 'right';

    const { width, height } = scene.scale;
    const spawnX = width / 2;
    const spawnY = height - FLOOR_HEIGHT - CHAR_HEIGHT / 2;

    this.sprite = scene.physics.add.sprite(spawnX, spawnY, 'player-right');
    this.sprite.setCollideWorldBounds(true);
    scene.physics.add.collider(this.sprite, floor);
  }

  handleInput({ moveX, jump }) {
    this.sprite.setVelocityX(moveX * MOVE_SPEED);

    if (moveX < 0 && this.facing !== 'left') {
      this.facing = 'left';
      this.sprite.setTexture('player-left');
    } else if (moveX > 0 && this.facing !== 'right') {
      this.facing = 'right';
      this.sprite.setTexture('player-right');
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
    this.sprite.destroy();
  }
}
