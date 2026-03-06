import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- NPC Entity Tests ---
// Tests NPC construction, jump triggering, facing, state, and destruction.
// Uses mock Phaser scene to avoid real Phaser dependency.

// Mock the imports that NPC.js uses
vi.mock('../../client/src/entities/PlayerTextureGenerator.js', () => ({
  generatePlayerTextures: vi.fn(),
}));

vi.mock('../../client/src/entities/ShadowHelper.js', () => ({
  createShadow: vi.fn(() => ({ destroy: vi.fn(), setPosition: vi.fn(), setAlpha: vi.fn(), setScale: vi.fn(), setDepth: vi.fn(), setVisible: vi.fn() })),
  updateShadow: vi.fn(),
}));

function createMockScene() {
  const eventHandlers = {};
  return {
    physics: {
      world: { remove: vi.fn() },
      add: {
        sprite: vi.fn((_x, _y, _tex) => ({
          x: _x, y: _y, depth: 0,
          setScale: vi.fn(),
          setTexture: vi.fn(),
          setVelocity: vi.fn(),
          setDepth: vi.fn(function (d) { this.depth = d; }),
          body: {
            setSize: vi.fn(),
            setOffset: vi.fn(),
            immovable: false,
          },
          destroy: vi.fn(),
        })),
      },
    },
    add: {
      text: vi.fn(() => ({
        x: 0, y: 0, depth: 0,
        setOrigin: vi.fn().mockReturnThis(),
        setPosition: vi.fn(),
        setDepth: vi.fn(),
        destroy: vi.fn(),
      })),
      ellipse: vi.fn(() => ({
        setVisible: vi.fn().mockReturnThis(),
        setPosition: vi.fn(),
        setAlpha: vi.fn(),
        setScale: vi.fn(),
        setDepth: vi.fn(),
        destroy: vi.fn(),
      })),
      rectangle: vi.fn(() => ({
        setOrigin: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setSize: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
    },
    events: {
      on: vi.fn((event, handler) => {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
      }),
      off: vi.fn(),
    },
    time: {
      delayedCall: vi.fn(() => ({ destroy: vi.fn() })),
    },
    tweens: {
      add: vi.fn(),
      killTweensOf: vi.fn(),
    },
    textures: {
      exists: vi.fn(() => false),
      remove: vi.fn(),
    },
    _eventHandlers: eventHandlers,
  };
}

// Import after mocks are set up
const { NPC } = await import('../../client/src/entities/NPC.js');

describe('NPC', () => {
  let scene;
  let npc;

  beforeEach(() => {
    scene = createMockScene();
    npc = new NPC(scene, 100, 200, {
      npcId: 'greta',
      name: 'Greta',
      color: 0x8B4513,
    });
  });

  it('creates sprite at spawn position', () => {
    expect(scene.physics.add.sprite).toHaveBeenCalledWith(100, 200, 'npc-greta-down');
  });

  it('sets body as immovable', () => {
    expect(npc.sprite.body.immovable).toBe(true);
  });

  it('creates name label', () => {
    expect(scene.add.text).toHaveBeenCalled();
    const textCall = scene.add.text.mock.calls[0];
    expect(textCall[2]).toBe('Greta');
  });

  it('starts facing down', () => {
    expect(npc.facing).toBe('down');
  });

  it('starts on the ground (z = 0, not jumping)', () => {
    expect(npc.z).toBe(0);
    expect(npc._isJumping).toBe(false);
  });

  it('setFacing() updates facing and texture', () => {
    npc.setFacing('left');
    expect(npc.facing).toBe('left');
    expect(npc.sprite.setTexture).toHaveBeenCalledWith('npc-greta-left');
  });

  it('setFacing() does nothing if direction unchanged', () => {
    npc.sprite.setTexture.mockClear();
    npc.setFacing('down'); // already facing down
    expect(npc.sprite.setTexture).not.toHaveBeenCalled();
  });

  it('jump() starts a jump', () => {
    npc.jump();
    expect(npc._isJumping).toBe(true);
    expect(npc.vz).toBeGreaterThan(0);
  });

  it('jump() is ignored if already jumping', () => {
    npc.jump();
    const vz1 = npc.vz;
    npc.jump(); // should be ignored
    expect(npc.vz).toBe(vz1);
  });

  it('update() advances jump physics', () => {
    npc.jump();
    const z0 = npc.z;
    npc._updateJump(16.67); // ~1 frame at 60fps
    expect(npc.z).toBeGreaterThan(z0);
  });

  it('jump completes and calls onActionComplete', () => {
    const callback = vi.fn();
    npc.onActionComplete = callback;
    npc.jump();

    // Simulate frames until landing
    for (let i = 0; i < 600; i++) {
      npc._updateJump(16.67);
      if (!npc._isJumping) break;
    }

    expect(npc._isJumping).toBe(false);
    expect(callback).toHaveBeenCalledWith({ status: 'completed', action: 'jump' });
  });

  it('getState() returns current state', () => {
    const state = npc.getState();
    expect(state).toEqual({
      x: 100,
      y: 200,
      z: 0,
      facing: 'down',
      isJumping: false,
    });
  });

  it('registers preupdate and postupdate hooks', () => {
    const events = scene.events.on.mock.calls.map(c => c[0]);
    expect(events).toContain('preupdate');
    expect(events).toContain('postupdate');
  });

  it('destroy() unregisters hooks and cleans up', () => {
    npc.destroy();
    expect(scene.events.off).toHaveBeenCalledWith('preupdate', expect.any(Function));
    expect(scene.events.off).toHaveBeenCalledWith('postupdate', expect.any(Function));
    expect(npc.sprite.destroy).toHaveBeenCalled();
    expect(npc.nameLabel.destroy).toHaveBeenCalled();
  });

  it('has a SpeechBubble instance', () => {
    expect(npc.speechBubble).toBeDefined();
    expect(typeof npc.speechBubble.show).toBe('function');
  });

  // --- Pathfinding ---

  it('moveTo() returns false without collision grid', () => {
    expect(npc.moveTo(5, 5)).toBe(false);
  });

  it('moveTo() finds path and starts following', () => {
    // 10x10 open grid (false = walkable)
    npc._collisionGrid = Array.from({ length: 15 }, () => new Array(15).fill(false));
    // NPC is at (100, 200) → tile (6, 12) at 16px tile size
    const result = npc.moveTo(8, 12);
    expect(result).toBe(true);
    expect(npc._pathFollower.isFollowing).toBe(true);
  });

  it('moveTo() returns false for blocked destination', () => {
    const grid = Array.from({ length: 15 }, () => new Array(15).fill(false));
    grid[5][5] = true; // block destination
    npc._collisionGrid = grid;
    expect(npc.moveTo(5, 5)).toBe(false);
  });

  it('moveTo() calls onActionComplete when already at destination', () => {
    const callback = vi.fn();
    npc.onActionComplete = callback;
    npc._collisionGrid = Array.from({ length: 15 }, () => new Array(15).fill(false));
    // NPC at (100, 200) → tile (6, 12)
    npc.moveTo(6, 12);
    expect(callback).toHaveBeenCalledWith({ status: 'completed', action: 'move_to' });
  });

  it('stopMoving() cancels path following', () => {
    npc._collisionGrid = Array.from({ length: 15 }, () => new Array(15).fill(false));
    npc.moveTo(8, 12);
    expect(npc._pathFollower.isFollowing).toBe(true);
    npc.stopMoving();
    expect(npc._pathFollower.isFollowing).toBe(false);
  });

  it('_updatePathFollowing calls onActionComplete on arrival', () => {
    const callback = vi.fn();
    npc.onActionComplete = callback;
    npc._collisionGrid = Array.from({ length: 15 }, () => new Array(15).fill(false));

    // Move to an adjacent tile
    npc.moveTo(7, 12);

    // Simulate being at the waypoint center (tile 7, row 12 → x=120, y=200)
    npc.sprite.x = 120;
    npc._groundY = 200;
    npc._updatePathFollowing();

    expect(callback).toHaveBeenCalledWith({ status: 'completed', action: 'move_to' });
  });
});
