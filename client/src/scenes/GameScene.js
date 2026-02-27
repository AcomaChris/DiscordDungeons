import Phaser from 'phaser';

// --- Physics / movement tuning ---
const MOVE_SPEED = 300;
const JUMP_VELOCITY = -500;

// --- Character dimensions ---
const CHAR_WIDTH = 30;
const CHAR_HEIGHT = 50;
const CHAR_RADIUS = CHAR_WIDTH / 2;
const EYE_RADIUS = 4;
const EYE_OFFSET_X = 7;

// --- Floor ---
const FLOOR_HEIGHT = 32;

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.createFloor();
    this.createCharacterTextures();
    this.createPlayer();
    this.setupControls();
  }

  // --- Floor ---

  createFloor() {
    const { width, height } = this.scale;
    const floorY = height - FLOOR_HEIGHT / 2;

    const gfx = this.add.graphics();
    gfx.fillStyle(0x4a4a4a, 1);
    gfx.fillRect(0, 0, width, FLOOR_HEIGHT);
    gfx.generateTexture('floor', width, FLOOR_HEIGHT);
    gfx.destroy();

    this.floor = this.physics.add.staticImage(width / 2, floorY, 'floor');
  }

  // --- Character Textures ---
  // Two pre-rendered textures (left/right) so the eye dot reflects facing direction.
  // Using generateTexture because Arcade Physics requires sprite-based game objects.

  createCharacterTextures() {
    const w = CHAR_WIDTH;
    const h = CHAR_HEIGHT;
    const r = CHAR_RADIUS;

    const gfx = this.add.graphics();

    // Right-facing texture
    gfx.fillStyle(0x00ccff, 1);
    gfx.fillRoundedRect(0, 0, w, h, r);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(w / 2 + EYE_OFFSET_X, r + 4, EYE_RADIUS);
    gfx.generateTexture('player-right', w, h);

    // Left-facing texture
    gfx.clear();
    gfx.fillStyle(0x00ccff, 1);
    gfx.fillRoundedRect(0, 0, w, h, r);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(w / 2 - EYE_OFFSET_X, r + 4, EYE_RADIUS);
    gfx.generateTexture('player-left', w, h);

    gfx.destroy();
  }

  // --- Player ---

  createPlayer() {
    const { width, height } = this.scale;
    const spawnX = width / 2;
    const spawnY = height - FLOOR_HEIGHT - CHAR_HEIGHT / 2;

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player-right');
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.floor);

    this.facing = 'right';
  }

  // --- Controls ---

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  // --- Update Loop ---

  update() {
    const { player, cursors, keys } = this;
    const onGround = player.body.touching.down || player.body.blocked.down;

    // --- Horizontal movement ---
    if (cursors.left.isDown || keys.a.isDown) {
      player.setVelocityX(-MOVE_SPEED);
      if (this.facing !== 'left') {
        this.facing = 'left';
        player.setTexture('player-left');
      }
    } else if (cursors.right.isDown || keys.d.isDown) {
      player.setVelocityX(MOVE_SPEED);
      if (this.facing !== 'right') {
        this.facing = 'right';
        player.setTexture('player-right');
      }
    } else {
      player.setVelocityX(0);
    }

    // --- Jump ---
    if ((cursors.up.isDown || cursors.space.isDown || keys.w.isDown) && onGround) {
      player.setVelocityY(JUMP_VELOCITY);
    }
  }
}
