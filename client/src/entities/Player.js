import eventBus from '../core/EventBus.js';
import { PLAYER_MOVED } from '../core/Events.js';
import { CHAR_WIDTH, CHAR_HEIGHT, TEXTURE_SCALE, PLAYER_COLORS } from '../core/Constants.js';
import { generatePlayerTextures } from './PlayerTextureGenerator.js';
import { AbilityManager } from '../abilities/AbilityManager.js';

// --- Player ---
// Wraps the local player sprite, handles 4-directional input, emits state
// for network sync. Uses a lower-body hitbox for natural 3/4 view overlap.

const SQRT2 = Math.sqrt(2);

export class Player {
  constructor(scene, spawnX, spawnY, playerName) {
    this.scene = scene;
    this.facing = 'down';
    this.texturePrefix = 'player-0';
    this.color = PLAYER_COLORS[0];
    this.abilities = new AbilityManager();
    this._isJumping = false;
    this._jumpTween = null;

    this.sprite = scene.physics.add.sprite(spawnX, spawnY, 'player-0-down');
    this.sprite.setScale(1 / TEXTURE_SCALE);

    // AGENT: Phaser body.setSize() works in unscaled texture space — values
    // are multiplied by sprite.scaleX/Y internally. Multiply desired world-pixel
    // dimensions by TEXTURE_SCALE so the final body matches the visual character.
    const bodyW = CHAR_WIDTH * TEXTURE_SCALE;
    const bodyH = 14 * TEXTURE_SCALE;
    this.sprite.body.setSize(bodyW, bodyH);
    this.sprite.body.setOffset(0, CHAR_HEIGHT * TEXTURE_SCALE - bodyH);

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
    this.color = PLAYER_COLORS[colorIndex];
    this.sprite.setTexture(`${this.texturePrefix}-${this.facing}`);
  }

  setColor(hexColor) {
    this.color = hexColor;
    generatePlayerTextures(this.scene, hexColor, this.texturePrefix);
    this.sprite.setTexture(`${this.texturePrefix}-${this.facing}`);
  }

  handleInput({ moveX, moveY, sprint, jump }) {
    this.abilities.updateFromInput({ sprint, jump });

    // Trigger visual hop on jump activation
    const jumpAbility = this.abilities.get('jump');
    if (jumpAbility?.active && !this._isJumping) {
      this._startJump(jumpAbility.params.heightPower);
    }

    const movement = this.abilities.get('movement');
    const speed = movement?.active ? movement.params.sprintSpeed : movement?.params.walkSpeed ?? 80;

    let vx = moveX * speed;
    let vy = moveY * speed;

    // Normalize diagonal so total speed equals current speed
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

  // --- Jump ---
  // Visual-only hop: tweens sprite upward then back down.
  // Physics body follows the sprite during the brief arc.

  _startJump(heightPower) {
    this._isJumping = true;
    const hopHeight = Math.min(heightPower * 0.1, 24);
    const duration = 200;

    // Shadow ellipse at ground level
    const shadow = this.scene.add.ellipse(
      this.sprite.x, this.sprite.y + CHAR_HEIGHT / 2 - 2,
      CHAR_WIDTH * 0.8, 4, 0x000000, 0.3,
    );
    shadow.setDepth(this.sprite.depth - 1);

    this._jumpTween = this.scene.tweens.add({
      targets: this.sprite,
      y: this.sprite.y - hopHeight,
      duration,
      ease: 'Sine.easeOut',
      yoyo: true,
      onUpdate: () => {
        // Keep shadow under the sprite horizontally
        shadow.setPosition(this.sprite.x, shadow.y);
      },
      onComplete: () => {
        shadow.destroy();
        this._isJumping = false;
        this._jumpTween = null;
      },
    });
  }

  // Y-sorted depth: compare base (feet) position so objects lower on screen
  // render in front. sprite.y is center; feet are CHAR_HEIGHT/2 below that.
  updateDepth() {
    const feetY = this.sprite.y + CHAR_HEIGHT / 2;
    this.sprite.setDepth(feetY);
    this.nameLabel.setDepth(feetY + 1);
  }

  getState() {
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      facing: this.facing,
      color: this.color,
      abilities: this.abilities.getState(),
    };
  }

  destroy() {
    this.scene.events.off('postupdate', this._postUpdate);
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
