// @vitest-environment jsdom
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

// Tick the Show Height Data checkbox in the DOM
function tickHeightCheckbox(checked = true) {
  const cb = document.querySelector('input[type="checkbox"]');
  cb.checked = checked;
  cb.dispatchEvent(new Event('change'));
  return cb;
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
    // Remove any panels added to the DOM
    document.querySelectorAll('body > div').forEach(el => el.remove());
    vi.restoreAllMocks();
  });

  // --- Panel lifecycle ---

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

  it('show() mounts panel and sets active', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    expect(overlay.active).toBe(true);
    expect(document.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('show() is no-op when already active', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    const panelsBefore = document.querySelectorAll('body > div').length;
    overlay.show();
    expect(document.querySelectorAll('body > div').length).toBe(panelsBefore);
  });

  it('hide() removes panel and sets inactive', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    overlay.hide();
    expect(overlay.active).toBe(false);
    expect(document.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('hide() is no-op when already inactive', () => {
    const overlay = new WorldDebugOverlay();
    overlay.hide(); // should not throw
    expect(overlay.active).toBe(false);
  });

  it('destroy() hides the overlay', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    overlay.destroy();
    expect(overlay.active).toBe(false);
  });

  // --- Show Height Data checkbox ---

  it('panel contains a Show Height Data checkbox', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    const cb = document.querySelector('input[type="checkbox"]');
    expect(cb).not.toBeNull();
    expect(cb.type).toBe('checkbox');
  });

  it('ticking Show Height Data creates text for elevated tiles only', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);

    // Two tiles have elevation > 0 (index 2 = level 1, index 4 = level 2)
    expect(mockScene.add.text).toHaveBeenCalledTimes(2);
  });

  it('text objects have correct world positions and labels', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);

    // Tile (2,0): level 1 → 8px, centered at (40, 8)
    const [x1, y1, label1] = mockScene.add.text.mock.calls[0];
    expect(x1).toBe(2 * 16 + 8);
    expect(y1).toBe(0 * 16 + 8);
    expect(label1).toBe('8');

    // Tile (1,1): level 2 → 16px, centered at (24, 24)
    const [x2, y2, label2] = mockScene.add.text.mock.calls[1];
    expect(x2).toBe(1 * 16 + 8);
    expect(y2).toBe(1 * 16 + 8);
    expect(label2).toBe('16');
  });

  it('text objects have correct depth and origin', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);

    const firstText = mockScene.add.text.mock.results[0].value;
    expect(firstText.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    expect(firstText.setDepth).toHaveBeenCalledWith(10100);
  });

  it('color-codes labels: lowest level → grey, highest → red', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);

    // level 1 (min, normalized=0) → grey: #808080
    const opts1 = mockScene.add.text.mock.calls[0][3];
    expect(opts1.color).toBe('#808080');

    // level 2 (max, normalized=1) → red: #ff2200
    const opts2 = mockScene.add.text.mock.calls[1][3];
    expect(opts2.color).toBe('#ff2200');
  });

  it('unticking destroys all text objects', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);
    const texts = mockScene.add.text.mock.results.map(r => r.value);

    tickHeightCheckbox(false);
    for (const t of texts) {
      expect(t.destroy).toHaveBeenCalled();
    }
  });

  it('hide() destroys text objects when checkbox was ticked', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);
    const texts = mockScene.add.text.mock.results.map(r => r.value);

    overlay.hide();
    for (const t of texts) {
      expect(t.destroy).toHaveBeenCalled();
    }
    expect(overlay.active).toBe(false);
  });

  it('ticking checkbox registers scene shutdown listener', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);
    expect(mockScene.events.once).toHaveBeenCalledWith('shutdown', expect.any(Function));
  });

  it('scene shutdown destroys labels but keeps panel open', () => {
    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);
    const texts = mockScene.add.text.mock.results.map(r => r.value);

    const shutdownCb = mockScene.events.once.mock.calls[0][1];
    shutdownCb();

    for (const t of texts) {
      expect(t.destroy).toHaveBeenCalled();
    }
    // Panel stays open — user can re-tick to rebuild when scene restarts
    expect(overlay.active).toBe(true);
  });

  it('creates no text when elevation data is all zeros', () => {
    mockScene = createMockScene([0, 0, 0, 0, 0, 0]);
    globalThis.__PHASER_GAME__.scene.getScene = vi.fn(() => mockScene);

    const overlay = new WorldDebugOverlay();
    overlay.show();
    tickHeightCheckbox(true);
    expect(mockScene.add.text).not.toHaveBeenCalled();
  });
});
