// --- NPC ---
// AI-driven game entity. Shares rendering patterns with Player (physics sprite,
// shadow, Y-sorted depth, Z-axis jump) but movement is controlled by AI brain
// via moveTo() rather than player input.

import { CHAR_WIDTH, CHAR_HEIGHT, TEXTURE_SCALE, TILE_SIZE } from '../core/Constants.js';
import { generatePlayerTextures } from './PlayerTextureGenerator.js';
import { startJump, updateJumpState } from '../physics/JumpPhysics.js';
import { createShadow, updateShadow } from './ShadowHelper.js';
import { SpeechBubble } from './SpeechBubble.js';
import { findPath } from '../ai/Pathfinder.js';
import { PathFollower } from '../ai/PathFollower.js';

const NPC_WALK_SPEED = 60;   // px/sec (slower than player's 80)
const NPC_JUMP_POWER = 200;  // same as player default

export class NPC {
  constructor(scene, x, y, { npcId, name, color }) {
    this.scene = scene;
    this.npcId = npcId;
    this.name = name;
    this.facing = 'down';
    this.walkSpeed = NPC_WALK_SPEED;

    // --- Z-axis state ---
    this.z = 0;
    this.vz = 0;
    this.groundZ = 0;
    this._groundY = y;
    this._isJumping = false;

    // --- Texture ---
    const texturePrefix = `npc-${npcId}`;
    this.texturePrefix = texturePrefix;
    generatePlayerTextures(scene, color, texturePrefix);

    // --- Sprite ---
    this.sprite = scene.physics.add.sprite(x, y, `${texturePrefix}-down`);
    this.sprite.setScale(1 / TEXTURE_SCALE);

    // AGENT: Body size in unscaled texture space (Phaser multiplies by sprite scale)
    const bodyW = CHAR_WIDTH * TEXTURE_SCALE;
    const bodyH = 14 * TEXTURE_SCALE;
    this.sprite.body.setSize(bodyW, bodyH);
    this.sprite.body.setOffset(0, CHAR_HEIGHT * TEXTURE_SCALE - bodyH);

    // NPC is immovable — player bounces off, NPC doesn't get pushed
    this.sprite.body.immovable = true;

    // --- Shadow ---
    this._shadow = createShadow(scene, x, y);

    // --- Name label ---
    this.nameLabel = scene.add.text(x, y - CHAR_HEIGHT / 2 - 4, name || 'NPC', {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);

    // --- Speech bubble ---
    this.speechBubble = new SpeechBubble(scene);

    // --- Pathfinding ---
    this._pathFollower = new PathFollower(NPC_WALK_SPEED);
    this._collisionGrid = null; // set by GameScene after map load

    // --- Action callback (set by NPCBrain) ---
    this.onActionComplete = null;

    // --- Phaser hooks ---
    this._preUpdate = () => {
      if (!this.sprite?.body) return;
      if (this.z !== 0 || this._isJumping) {
        this.sprite.y = this._groundY;
      }
    };
    scene.events.on('preupdate', this._preUpdate);

    this._postUpdate = () => {
      if (!this.sprite?.body) return;
      this._syncGroundPosition();
      this._updateDepth();

      const labelY = this.sprite.y - CHAR_HEIGHT / 2 - 4;
      this.nameLabel.setPosition(this.sprite.x, labelY);
      this.speechBubble.update(this.sprite.x, labelY - 4);
    };
    scene.events.on('postupdate', this._postUpdate);
  }

  // --- Movement ---

  setFacing(dir) {
    if (dir === this.facing) return;
    this.facing = dir;
    this.sprite.setTexture(`${this.texturePrefix}-${this.facing}`);
  }

  // Walk to a tile position using A* pathfinding.
  // Returns true if a path was found and movement started, false otherwise.
  moveTo(tileX, tileY) {
    if (!this._collisionGrid) return false;

    const startTX = Math.floor(this.sprite.x / TILE_SIZE);
    const startTY = Math.floor(this._groundY / TILE_SIZE);

    const path = findPath(this._collisionGrid, { tx: startTX, ty: startTY }, { tx: tileX, ty: tileY });
    if (!path) return false;

    if (path.length === 0) {
      // Already at destination
      if (this.onActionComplete) this.onActionComplete({ status: 'completed', action: 'move_to' });
      return true;
    }

    this._pathFollower.startPath(path);
    return true;
  }

  stopMoving() {
    this._pathFollower.cancel();
    this.sprite.setVelocity(0, 0);
  }

  // --- Jump ---

  jump() {
    if (this._isJumping) return;
    const state = startJump(
      { z: this.z, vz: this.vz, groundZ: this.groundZ, isJumping: this._isJumping },
      NPC_JUMP_POWER,
    );
    this.z = state.z;
    this.vz = state.vz;
    this._isJumping = state.isJumping;
  }

  // --- Update (called from GameScene.update) ---

  update(delta) {
    this._updateJump(delta);
    this._updatePathFollowing();
  }

  _updatePathFollowing() {
    if (!this._pathFollower.isFollowing) return;

    const { vx, vy, facing, arrived } = this._pathFollower.update(this.sprite.x, this._groundY);

    if (arrived) {
      this.sprite.setVelocity(0, 0);
      if (this.onActionComplete) this.onActionComplete({ status: 'completed', action: 'move_to' });
      return;
    }

    this.sprite.setVelocity(vx, vy);
    if (facing) this.setFacing(facing);
  }

  _updateJump(delta) {
    if (!this._isJumping && this.z <= this.groundZ) return;

    const dt = delta / 1000;
    const state = updateJumpState(
      { z: this.z, vz: this.vz, groundZ: this.groundZ, isJumping: this._isJumping },
      dt,
    );

    const wasJumping = this._isJumping;
    this.z = state.z;
    this.vz = state.vz;
    this._isJumping = state.isJumping;

    // Notify brain when jump lands
    if (wasJumping && !this._isJumping && this.onActionComplete) {
      this.onActionComplete({ status: 'completed', action: 'jump' });
    }
  }

  _syncGroundPosition() {
    this._groundY = this.sprite.y;
    this.sprite.y = this._groundY - this.z;
    updateShadow(this._shadow, this.sprite.x, this._groundY, this.z, this.groundZ, this.sprite.depth);
  }

  _updateDepth() {
    const feetY = this._groundY + CHAR_HEIGHT / 2;
    this.sprite.setDepth(feetY);
    this.nameLabel.setDepth(feetY + 1);
    this.speechBubble.setDepth(feetY + 2);
  }

  // --- State ---

  getState() {
    return {
      x: this.sprite.x,
      y: this._groundY,
      z: this.z,
      facing: this.facing,
      isJumping: this._isJumping,
    };
  }

  // --- Cleanup ---

  destroy() {
    this._pathFollower.cancel();
    this.scene.events.off('preupdate', this._preUpdate);
    this.scene.events.off('postupdate', this._postUpdate);
    this.speechBubble.destroy();
    if (this._shadow) this._shadow.destroy();
    this.nameLabel.destroy();
    if (this.sprite?.body) {
      this.scene.physics.world.remove(this.sprite.body);
    }
    this.sprite.destroy();
  }
}
