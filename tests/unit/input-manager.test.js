import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { INPUT_ACTION } from '../../client/src/core/Events.js';

// AGENT: InputManager imports Phaser, which needs browser APIs.
// We mock Phaser at the module level so it loads in Node.

// --- Phaser mock ---
function createMockKey() {
  return {
    isDown: false,
    on: vi.fn(),
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
          A: 65,
          D: 68,
          W: 87,
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

  it('emits INPUT_ACTION with moveX=0 and jump=false when no keys are pressed', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ moveX: 0, jump: false });
    im.destroy();
  });

  it('emits moveX=-1 when a left key is held', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    // Find the key objects for moveLeft and press one
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

  it('emits jump=true only once per keydown', async () => {
    const scene = createMockScene();
    const im = new InputManager(scene);
    const eventBusMod = await import('../../client/src/core/EventBus.js');

    // Simulate jump keydown via the registered 'down' callback
    const jumpKeys = im.keyObjects.jump;
    const downHandler = jumpKeys[0].on.mock.calls.find((c) => c[0] === 'down');
    expect(downHandler).toBeDefined();

    // Trigger the keydown
    downHandler[1].call(downHandler[2]);

    const calls = [];
    eventBusMod.default.on(INPUT_ACTION, (data) => calls.push(data));

    im.update();
    im.update();

    // First update should have jump=true, second should be false
    expect(calls[0].jump).toBe(true);
    expect(calls[1].jump).toBe(false);
    im.destroy();
  });
});
