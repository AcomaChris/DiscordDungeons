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
    expect(calls[0]).toEqual({ moveX: 0, moveY: 0 });
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
    expect(snap).toEqual({ moveX: 1, moveY: -1 });
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

    expect(calls[0]).toEqual({ moveX: 0, moveY: 0 });
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
    expect(calls).toEqual([{ moveX: 0, moveY: 0 }]);

    im.destroy();
    _resetForTesting();
  });
});
