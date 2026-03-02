import eventBus from '../core/EventBus.js';
import { PLAYER_MOVED } from '../core/Events.js';
import { CHAR_WIDTH, CHAR_HEIGHT, TEXTURE_SCALE, PLAYER_COLORS, ELEVATION_STEP } from '../core/Constants.js';
import { generatePlayerTextures } from './PlayerTextureGenerator.js';
import { AbilityManager } from '../abilities/AbilityManager.js';
import { startJump, updateJumpState } from '../physics/JumpPhysics.js';
import { createShadow, updateShadow } from './ShadowHelper.js';

// --- Player ---
// Wraps the local player sprite, handles 4-directional input, emits state
// for network sync. Uses a lower-body hitbox for natural 3/4 view overlap.
//
// Z-axis: Characters have a ground position (_groundY) and a height above
// ground (z). Physics body stays at _groundY; sprite.y = _groundY - z.
// Depth sorting uses _groundY so jumping doesn't change render order.

const SQRT2 = Math.sqrt(2);

export class Player {
  constructor(scene, spawnX, spawnY, playerName) {
    this.scene = scene;
    this.facing = 'down';
    this.texturePrefix = 'player-0';
    this.color = PLAYER_COLORS[0];
    this.abilities = new AbilityManager();
    this._isJumping = false;

    // --- Z-axis state ---
    this.z = 0;           // height above ground plane (px)
    this.vz = 0;          // vertical velocity (px/sec, positive = up)
    this.groundZ = 0;     // elevation of current ground tile (px)
    this._groundY = spawnY; // physics ground Y (world space)

    this.sprite = scene.physics.add.sprite(spawnX, spawnY, 'player-0-down');
    this.sprite.setScale(1 / TEXTURE_SCALE);

    // AGENT: Phaser body.setSize() works in unscaled texture space — values
    // are multiplied by sprite.scaleX/Y internally. Multiply desired world-pixel
    // dimensions by TEXTURE_SCALE so the final body matches the visual character.
    const bodyW = CHAR_WIDTH * TEXTURE_SCALE;
    const bodyH = 14 * TEXTURE_SCALE;
    this.sprite.body.setSize(bodyW, bodyH);
    this.sprite.body.setOffset(0, CHAR_HEIGHT * TEXTURE_SCALE - bodyH);

    // --- Shadow ---
    this._shadow = createShadow(scene, spawnX, spawnY);

    this.nameLabel = scene.add.text(spawnX, spawnY - CHAR_HEIGHT / 2 - 4, playerName || 'Player', {
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 1);

    // --- Phaser event hooks ---
    // Restore ground-plane Y before physics so collisions work on the
    // floor plane, not the visually offset sprite position.
    this._preUpdate = () => {
      if (this.z !== 0 || this._isJumping) {
        this.sprite.y = this._groundY;
      }
      this._updateElevationCollision();
    };
    scene.events.on('preupdate', this._preUpdate);

    // Runs after Phaser's body.postUpdate() has synced sprite from body.
    // AGENT: syncGroundPosition MUST run here, not in scene.update(),
    // because body.postUpdate() fires on POST_UPDATE (after scene.update()).
    // Reading sprite.y in scene.update() gives the stale preupdate value.
    this._postUpdate = () => {
      this.syncGroundPosition();
      this.updateDepth();
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

    // Trigger jump on activation (single press, not held)
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

  _startJump(heightPower) {
    if (this._isJumping) return;
    const state = startJump(
      { z: this.z, vz: this.vz, groundZ: this.groundZ, isJumping: this._isJumping },
      heightPower,
    );
    this.z = state.z;
    this.vz = state.vz;
    this._isJumping = state.isJumping;
  }

  // Called every frame from GameScene.update() after physics step.
  updateJump(delta) {
    if (!this._isJumping && this.z <= this.groundZ) return;

    const dt = delta / 1000;

    // Float ability: reduce gravity during descent
    let gravityFactor = 1.0;
    if (this.vz < 0) {
      const floatAbility = this.abilities.get('float');
      if (floatAbility) {
        gravityFactor = floatAbility.params.gravityFactor;
      }
    }

    const state = updateJumpState(
      { z: this.z, vz: this.vz, groundZ: this.groundZ, isJumping: this._isJumping },
      dt,
      gravityFactor,
    );
    this.z = state.z;
    this.vz = state.vz;
    this._isJumping = state.isJumping;
  }

  // Called every frame after updateJump(). Reads the ground-plane Y from
  // the physics body, queries tile elevation, then offsets sprite.y by z.
  syncGroundPosition() {
    // After Phaser physics resolved, sprite.y is the ground-plane position
    this._groundY = this.sprite.y;

    // Update ground elevation from tile data
    const tm = this.scene.tileMapManager;
    if (tm) {
      const newGroundZ = tm.getElevationAt(this.sprite.x, this._groundY);

      // Auto-step-up: when walking onto a tile at most one step above the
      // player's current height, snap z up for smooth elevation transitions.
      // Skipped during jumps — z is determined by jump physics, not terrain.
      // Uses this.z (not groundZ) to prevent multi-frame escalation where
      // groundZ updates first and then the check erroneously passes.
      const stepHeight = this.abilities.getParam('movement', 'stepHeight');
      if (!this._isJumping && newGroundZ > this.z && newGroundZ <= this.z + stepHeight) {
        this.z = newGroundZ;
      }

      this.groundZ = newGroundZ;
    }

    // Apply visual Z offset
    this.sprite.y = this._groundY - this.z;

    // Update shadow
    updateShadow(this._shadow, this.sprite.x, this._groundY, this.z, this.groundZ, this.sprite.depth);
  }

  // --- Elevation collision ---
  // Toggle tile collision based on player Z vs tile elevation. When the
  // player is high enough (z >= elevation), clear collision so they can
  // walk on the platform. When too low, keep collision active.
  _updateElevationCollision() {
    const tm = this.scene.tileMapManager;
    if (!tm?.elevationData || !tm.collisionLayer) return;

    const map = tm.tilemap;
    const tileW = map.tileWidth;
    const tileH = map.tileHeight;

    // Only scan tiles near the player body to avoid full-map iteration
    const body = this.sprite.body;
    const startX = Math.max(0, Math.floor(body.left / tileW) - 1);
    const endX = Math.min(map.width - 1, Math.ceil(body.right / tileW) + 1);
    const startY = Math.max(0, Math.floor(body.top / tileH) - 1);
    const endY = Math.min(map.height - 1, Math.ceil(body.bottom / tileH) + 1);

    // The tile row the player is standing on — used to detect body-clipping
    // into adjacent rows that shouldn't block horizontal movement.
    const groundTileY = Math.floor(this._groundY / tileH);

    for (let ty = startY; ty <= endY; ty++) {
      for (let tx = startX; tx <= endX; tx++) {
        const elev = tm.elevationData[ty * map.width + tx];
        if (elev <= 0) continue;

        const elevPx = elev * ELEVATION_STEP;
        const tile = tm.collisionLayer.getTileAt(tx, ty);
        if (!tile) continue;

        // Step-height: allow passage when player can reach the tile's elevation
        // (already at/above it, or within one step height of reaching it).
        const stepHeight = this.abilities.getParam('movement', 'stepHeight');
        const canReach = this.z >= elevPx || elevPx <= this.z + stepHeight;

        // Body-clip: only clear collision for tiles below ground row that the
        // player is already high enough to pass over — prevents the body's
        // vertical extent from colliding with tiles in the row below.
        const bodyClip = this.groundZ > 0 && ty > groundTileY && elevPx <= this.z;
        const shouldBlock = !canReach && !bodyClip;
        tile.setCollision(shouldBlock, shouldBlock, shouldBlock, shouldBlock, false);
      }
    }
  }

  // Y-sorted depth: compare base (feet) position so objects lower on screen
  // render in front. Uses _groundY (not sprite.y) so jumping doesn't change
  // render order — fixes issue #4.
  updateDepth() {
    const feetY = this._groundY + CHAR_HEIGHT / 2;
    this.sprite.setDepth(feetY);
    this.nameLabel.setDepth(feetY + 1);
  }

  getState() {
    return {
      x: this.sprite.x,
      y: this._groundY,
      z: this.z,
      facing: this.facing,
      color: this.color,
      abilities: this.abilities.getState(),
    };
  }

  destroy() {
    this.scene.events.off('preupdate', this._preUpdate);
    this.scene.events.off('postupdate', this._postUpdate);
    if (this._shadow) this._shadow.destroy();
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
