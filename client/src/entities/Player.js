import eventBus from '../core/EventBus.js';
import { PLAYER_MOVED } from '../core/Events.js';
import { CHAR_WIDTH, CHAR_HEIGHT, TEXTURE_SCALE, PLAYER_COLORS, ELEVATION_STEP } from '../core/Constants.js';
import { generatePlayerTextures } from './PlayerTextureGenerator.js';
import { AbilityManager } from '../abilities/AbilityManager.js';
import { startJump, updateJumpState } from '../physics/JumpPhysics.js';
import { checkMantle, updateMantleState } from '../physics/MantlePhysics.js';
import { createShadow, updateShadow } from './ShadowHelper.js';

// --- Player ---
// Wraps the local player sprite, handles input (keyboard integers or analog
// joystick floats), emits state for network sync. Uses a lower-body hitbox
// for natural 3/4 view overlap.
//
// Z-axis: Characters have a ground position (_groundY) and a height above
// ground (z). Physics body stays at _groundY; sprite.y = _groundY - z.
// Depth sorting uses _groundY so jumping doesn't change render order.

export class Player {
  constructor(scene, spawnX, spawnY, playerName) {
    this.scene = scene;
    this.facing = 'down';
    this.texturePrefix = 'player-0';
    this.color = PLAYER_COLORS[0];
    this.abilities = new AbilityManager();
    this._isJumping = false;
    this._isMantling = false;
    this._mantleStartZ = 0;
    this._mantleTargetZ = 0;
    this._mantleElapsed = 0;
    this._mantleDuration = 0;

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
    if (jumpAbility?.active && !this._isJumping && !this._isMantling) {
      this._startJump(jumpAbility.params.heightPower);
    }

    const movement = this.abilities.get('movement');
    const speed = movement?.active ? movement.params.sprintSpeed : movement?.params.walkSpeed ?? 80;

    let vx = moveX * speed;
    let vy = moveY * speed;

    // Clamp velocity magnitude to speed — works for both integer keyboard
    // input (where diagonal is √2 × speed) and analog joystick floats.
    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag > speed) {
      vx = (vx / mag) * speed;
      vy = (vy / mag) * speed;
    }

    this.sprite.setVelocity(vx, vy);

    // Map input direction to nearest 4-way facing using dominant axis
    let newFacing = this.facing;
    const absX = Math.abs(moveX);
    const absY = Math.abs(moveY);
    if (absX > 0 || absY > 0) {
      if (absY >= absX) {
        newFacing = moveY < 0 ? 'up' : 'down';
      } else {
        newFacing = moveX < 0 ? 'left' : 'right';
      }
    }

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
    if (!this._isJumping && !this._isMantling && this.z <= this.groundZ) return;

    const dt = delta / 1000;

    // --- Mantle execution (overrides normal jump physics) ---
    if (this._isMantling) {
      const mState = updateMantleState({
        z: this.z, startZ: this._mantleStartZ, targetZ: this._mantleTargetZ,
        elapsed: this._mantleElapsed, duration: this._mantleDuration, isMantling: true,
      }, dt);
      this.z = mState.z;
      this._mantleElapsed = mState.elapsed;
      this._isMantling = mState.isMantling;
      if (!mState.isMantling) {
        this.vz = 0;
        this._isJumping = false;
        this.groundZ = this._mantleTargetZ;
      }
      return;
    }

    // --- Mantle detection (ascending/apex phase only) ---
    if (this._isJumping && this.vz >= 0) {
      const mantleAbility = this.abilities.get('mantle');
      if (mantleAbility) {
        const tm = this.scene.tileMapManager;
        if (tm?.elevationData) {
          const stepHeight = this.abilities.getParam('movement', 'stepHeight');
          const result = checkMantle({
            playerX: this.sprite.x,
            playerY: this._groundY,
            facing: this.facing,
            z: this.z,
            stepHeight,
            mantleHeight: mantleAbility.params.mantleHeight,
            mantleReach: mantleAbility.params.mantleReach,
            tileWidth: tm.tilemap.tileWidth,
            tileHeight: tm.tilemap.tileHeight,
            mapWidth: tm.tilemap.width,
            mapHeight: tm.tilemap.height,
            elevationData: tm.elevationData,
            elevationStep: ELEVATION_STEP,
          });
          if (result.canMantle) {
            this._isMantling = true;
            this._mantleStartZ = this.z;
            this._mantleTargetZ = result.targetZ;
            this._mantleElapsed = 0;
            this._mantleDuration = mantleAbility.params.mantleSpeed;
            this.vz = 0;
            return;
          }
        }
      }
    }

    // --- Normal jump physics ---
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
      if (!this._isJumping && !this._isMantling && newGroundZ > this.z && newGroundZ <= this.z + stepHeight) {
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
    const body = this.sprite?.body;
    if (!body) return;
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
    // Remove body from physics world first so Phaser doesn't run
    // Body._postUpdate on a stale body during the same frame.
    if (this.sprite?.body) {
      this.scene.physics.world.remove(this.sprite.body);
    }
    if (this._shadow) this._shadow.destroy();
    this.sprite.destroy();
    this.nameLabel.destroy();
  }
}
