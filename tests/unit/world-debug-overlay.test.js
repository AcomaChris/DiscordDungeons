import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function createMockText() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

function createMockScene(elevationData, mapW = 3, mapH = 2) {
  return {
    tileMapManager: {
      elevationData,
      tilemap: {
        tileWidth: 16,
        tileHeight: 16,
        width: mapW,
        height: mapH,
      },
    },
    add: {
      text: vi.fn(() => createMockText()),
    },
    events: {
      once: vi.fn(),
      off: vi.fn(),
    },
  };
}

describe('WorldDebugOverlay', () => {
  let WorldDebugOverlay;
  let mockScene;

  beforeEach(async () => {
    // 3×2 grid: two elevated tiles (level 1 at index 2, level 2 at index 4)
    mockScene = createMockScene([0, 0, 1, 0, 2, 0]);

    globalThis.__PHASER_GAME__ = {
      scene: {
        getScene: vi.fn(() => mockScene),
      },
    };

    const mod = await import('../../client/src/debug/WorldDebugOverlay.js');
    WorldDebugOverlay = mod.WorldDebugOverlay;
  });

  afterEach(() => {
    delete globalThis.__PHASER_GAME__;
    vi.restoreAllMocks();
  });

  it('starts inactive', () => {
    const overlay = new WorldDebugOverlay();
    expect(overlay.active).toBe(false);
  });

  it('toggle() flips active state', () => {
    const overlay = new WorldDebugOverlay();
    overlay.toggle();
    expect(overlay.active).toBe(true);
    overlay.toggle();
    expect(overlay.active).toBe(false);
  });

  it('show() creates text objects only for elevation > 0 tiles', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();

    // Two tiles have elevation > 0
    expect(mockScene.add.text).toHaveBeenCalledTimes(2);

    // First call: tile (2,0) with level 1 → 8px
    const [x1, y1, label1] = mockScene.add.text.mock.calls[0];
    expect(x1).toBe(2 * 16 + 8); // centered on tile
    expect(y1).toBe(0 * 16 + 8);
    expect(label1).toBe('8');

    // Second call: tile (1,1) with level 2 → 16px
    const [x2, y2, label2] = mockScene.add.text.mock.calls[1];
    expect(x2).toBe(1 * 16 + 8);
    expect(y2).toBe(1 * 16 + 8);
    expect(label2).toBe('16');
  });

  it('show() sets depth and origin on each text', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();

    const firstText = mockScene.add.text.mock.results[0].value;
    expect(firstText.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(firstText.setDepth).toHaveBeenCalledWith(10100);
  });

  it('hide() destroys all text objects', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();

    const texts = mockScene.add.text.mock.results.map(r => r.value);
    overlay.hide();

    for (const t of texts) {
      expect(t.destroy).toHaveBeenCalled();
    }
    expect(overlay.active).toBe(false);
  });

  it('show() is no-op when already active', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    const callCount = mockScene.add.text.mock.calls.length;
    overlay.show(); // second call
    expect(mockScene.add.text.mock.calls.length).toBe(callCount);
  });

  it('hide() is no-op when already inactive', () => {
    const overlay = new WorldDebugOverlay();
    overlay.hide(); // should not throw
    expect(overlay.active).toBe(false);
  });

  it('show() is no-op when no game is running', () => {
    delete globalThis.__PHASER_GAME__;
    const overlay = new WorldDebugOverlay();
    overlay.show();
    expect(overlay.active).toBe(false);
  });

  it('show() is no-op when tileMapManager missing', () => {
    globalThis.__PHASER_GAME__.scene.getScene = vi.fn(() => ({}));
    const overlay = new WorldDebugOverlay();
    overlay.show();
    expect(overlay.active).toBe(false);
  });

  it('listens for scene shutdown and cleans up', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    expect(mockScene.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));

    // Simulate shutdown
    const shutdownCb = mockScene.events.once.mock.calls[0][1];
    shutdownCb();
    expect(overlay.active).toBe(false);
  });

  it('destroy() hides the overlay', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    overlay.destroy();
    expect(overlay.active).toBe(false);
  });

  it('creates no text when elevation data is all zeros', () => {
    mockScene = createMockScene([0, 0, 0, 0, 0, 0]);
    globalThis.__PHASER_GAME__.scene.getScene = vi.fn(() => mockScene);

    const overlay = new WorldDebugOverlay();
    overlay.show();
    expect(mockScene.add.text).not.toHaveBeenCalled();
  });
});
