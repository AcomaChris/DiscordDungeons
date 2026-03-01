import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { INPUT_ACTION } from '../../client/src/core/Events.js';

// AGENT: InputManager imports Phaser, which needs browser APIs.
// We mock Phaser at the module level so it loads in Node.

// --- Phaser mock ---
function createMockKey() {
  return {
    isDown: false,
    removeAllListeners: vi.fn(),
  };
}

const mockKeys = new Map();

vi.mock('phaser', () => ({
  default: {
    Input: {
      Keyboard: {
        KeyCodes: {
          LEFT: 37,
          RIGHT: 39,
          UP: 38,
          DOWN: 40,
          A: 65,
          D: 68,
          W: 87,
          S: 83,
          E: 69,
          SPACE: 32,
          SHIFT: 16,
        },
      },
    },
  },
}));

function createMockScene() {
  mockKeys.clear();
  return {
    input: {
      keyboard: {
        enabled: true,
        addKey: vi.fn((code) => {
          const key = createMockKey();
          mockKeys.set(code, key);
          return key;
        }),
        removeKey: vi.fn(),
        addCapture: vi.fn(),
        clearCaptures: vi.fn(),
      },
    },
  };
}

describe('InputManager', () => {
  let InputManager;

  beforeEach(async () => {

    // Patch the singleton so InputManager uses our fresh bus
    const eventBusMod = await import('../../client/src/core/EventBus.js');
    eventBusMod.default.reset();

    const mod = await import('../../client/src/input/InputManager.js');
    InputManager = mod.InputManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits INPUT_ACTION with moveX=0 and moveY=0 when no keys are pressed', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ moveX: 0, moveY: 0, sprint: false, jump: false });
    im.destroy();
  });

  it('emits moveX=-1 when a left key is held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    const leftKeys = im.keyObjects.moveLeft;
    leftKeys[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls[0].moveX).toBe(-1);
    im.destroy();
  });

  it('emits moveX=1 when a right key is held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    const rightKeys = im.keyObjects.moveRight;
    rightKeys[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls[0].moveX).toBe(1);
    im.destroy();
  });

  it('emits moveY=-1 when an up key is held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    const upKeys = im.keyObjects.moveUp;
    upKeys[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls[0].moveY).toBe(-1);
    im.destroy();
  });

  it('emits moveY=1 when a down key is held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    const downKeys = im.keyObjects.moveDown;
    downKeys[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls[0].moveY).toBe(1);
    im.destroy();
  });

  it('cancels opposing horizontal keys', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    im.keyObjects.moveLeft[0].isDown = true;
    im.keyObjects.moveRight[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls[0].moveX).toBe(0);
    im.destroy();
  });

  it('cancels opposing vertical keys', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    im.keyObjects.moveUp[0].isDown = true;
    im.keyObjects.moveDown[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls[0].moveY).toBe(0);
    im.destroy();
  });

  it('getSnapshot returns current state without emitting', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    im.keyObjects.moveRight[0].isDown = true;
    im.keyObjects.moveUp[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    const snap = im.getSnapshot();
    expect(snap).toEqual({ moveX: 1, moveY: -1, sprint: false, jump: false });
    expect(calls).toHaveLength(0);
    im.destroy();
  });

  it('emits zero and disables keyboard when UI has focus', async () => {
    const { acquireInputFocus, _resetForTesting } = await import('../../client/src/core/InputContext.js');
    _resetForTesting();
    acquireInputFocus();

    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    im.keyObjects.moveRight[0].isDown = true;

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls[0]).toEqual({ moveX: 0, moveY: 0, sprint: false, jump: false });
    // Keyboard disabled by constructor (initial state sync)
    expect(scene.input.keyboard.enabled).toBe(false);

    im.destroy();
    _resetForTesting();
  });

  it('re-enables keyboard when UI releases focus', async () => {
    const { acquireInputFocus, releaseInputFocus, _resetForTesting } = await import('../../client/src/core/InputContext.js');
    _resetForTesting();
    acquireInputFocus();

    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    im.update(); // emits zeros while suppressed
    expect(scene.input.keyboard.enabled).toBe(false);

    // Event-driven: releasing focus triggers the handler immediately
    releaseInputFocus();
    expect(scene.input.keyboard.enabled).toBe(true);

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update(); // should now emit real input
    expect(scene.input.keyboard.enabled).toBe(true);

    im.destroy();
    _resetForTesting();
  });

  it('disables keyboard immediately when focus is acquired mid-session', async () => {
    const { acquireInputFocus, _resetForTesting } = await import('../../client/src/core/InputContext.js');
    _resetForTesting();

    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    expect(scene.input.keyboard.enabled).toBe(true);

    // Simulate a UI overlay opening while game is running
    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    acquireInputFocus();

    // Handler fires immediately — keyboard disabled and zero emitted
    expect(scene.input.keyboard.enabled).toBe(false);
    expect(calls).toEqual([{ moveX: 0, moveY: 0, sprint: false, jump: false }]);

    im.destroy();
    _resetForTesting();
  });

  // --- Key capture tests (preventDefault) ---
  // Phaser's addKey() registers captures that call preventDefault() on DOM events.
  // These must be cleared when UI has focus so form fields receive WASD/Space/etc.

  it('clears key captures when UI acquires focus', async () => {
    const { acquireInputFocus, _resetForTesting } = await import('../../client/src/core/InputContext.js');
    _resetForTesting();

    const scene = createMockScene();
    const im = new InputManager(scene);

    acquireInputFocus();

    expect(scene.input.keyboard.clearCaptures).toHaveBeenCalled();

    im.destroy();
    _resetForTesting();
  });

  it('restores key captures when UI releases focus', async () => {
    const { acquireInputFocus, releaseInputFocus, _resetForTesting } = await import('../../client/src/core/InputContext.js');
    _resetForTesting();

    const scene = createMockScene();
    const im = new InputManager(scene);

    acquireInputFocus();
    scene.input.keyboard.addCapture.mockClear();

    releaseInputFocus();

    // Should re-add captures for all bound key codes
    expect(scene.input.keyboard.addCapture).toHaveBeenCalled();
    const capturedCodes = scene.input.keyboard.addCapture.mock.calls.map((c) => c[0]);
    // All 11 bound keys: LEFT, A, RIGHT, D, UP, W, DOWN, S, E, SPACE, SHIFT
    expect(capturedCodes).toContain(37);  // LEFT
    expect(capturedCodes).toContain(65);  // A
    expect(capturedCodes).toContain(39);  // RIGHT
    expect(capturedCodes).toContain(68);  // D
    expect(capturedCodes).toContain(38);  // UP
    expect(capturedCodes).toContain(87);  // W
    expect(capturedCodes).toContain(40);  // DOWN
    expect(capturedCodes).toContain(83);  // S
    expect(capturedCodes).toContain(69);  // E
    expect(capturedCodes).toContain(32);  // SPACE
    expect(capturedCodes).toContain(16);  // SHIFT

    im.destroy();
    _resetForTesting();
  });

  it('clears key captures in constructor when UI is already focused', async () => {
    const { acquireInputFocus, _resetForTesting } = await import('../../client/src/core/InputContext.js');
    _resetForTesting();
    acquireInputFocus();

    const scene = createMockScene();
    const im = new InputManager(scene);

    // Constructor should have cleared captures after building key objects
    expect(scene.input.keyboard.clearCaptures).toHaveBeenCalled();

    im.destroy();
    _resetForTesting();
  });

  it('includes sprint=true when shift is held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);

    im.keyObjects.sprint[0].isDown = true;

    const snap = im.getSnapshot();
    expect(snap.sprint).toBe(true);
    im.destroy();
  });

  it('includes sprint=false when shift is not held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);

    const snap = im.getSnapshot();
    expect(snap.sprint).toBe(false);
    im.destroy();
  });

  it('includes jump=true when space is held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);

    im.keyObjects.jump[0].isDown = true;

    const snap = im.getSnapshot();
    expect(snap.jump).toBe(true);
    im.destroy();
  });

  it('includes jump=false when space is not held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);

    const snap = im.getSnapshot();
    expect(snap.jump).toBe(false);
    im.destroy();
  });
});
