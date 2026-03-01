// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock CSS import
vi.mock('../../client/src/debug/player-debug.css', () => ({}));

// Mock InputContext
vi.mock('../../client/src/core/InputContext.js', () => ({
  acquireInputFocus: vi.fn(),
  releaseInputFocus: vi.fn(),
}));

// Mock PlayerTextureGenerator
vi.mock('../../client/src/entities/PlayerTextureGenerator.js', () => ({
  generatePlayerTextures: vi.fn(),
}));

describe('PlayerDebugPanel', () => {
  let PlayerDebugPanel;
  let acquireInputFocus;
  let releaseInputFocus;
  let generatePlayerTextures;
  let mockPlayer;
  let mockScene;

  beforeEach(async () => {
    // Create mock player with sprite and body
    mockPlayer = {
      sprite: {
        x: 100,
        y: 200,
        body: {
          width: 16,
          height: 14,
          setSize: vi.fn(),
          setOffset: vi.fn(),
        },
        setTexture: vi.fn(),
      },
      nameLabel: { text: 'TestPlayer', setText: vi.fn() },
      color: 0xff6600,
      texturePrefix: 'player-0',
      facing: 'down',
      setColor: vi.fn(),
    };

    mockScene = {
      player: mockPlayer,
      networkManager: {
        ws: { readyState: 1, send: vi.fn() },
      },
    };

    // Expose mock game global
    globalThis.__PHASER_GAME__ = {
      scene: {
        getScene: vi.fn(() => mockScene),
      },
    };

    // Stub WebSocket.OPEN
    globalThis.WebSocket = { OPEN: 1 };

    const mod = await import('../../client/src/debug/PlayerDebugPanel.js');
    PlayerDebugPanel = mod.PlayerDebugPanel;

    const inputCtx = await import('../../client/src/core/InputContext.js');
    acquireInputFocus = inputCtx.acquireInputFocus;
    releaseInputFocus = inputCtx.releaseInputFocus;

    const texGen = await import('../../client/src/entities/PlayerTextureGenerator.js');
    generatePlayerTextures = texGen.generatePlayerTextures;
  });

  afterEach(() => {
    for (const el of document.querySelectorAll('.player-debug-backdrop')) {
      el.remove();
    }
    delete globalThis.__PHASER_GAME__;
    vi.restoreAllMocks();
  });

  it('opens and renders all controls', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const dialog = document.querySelector('.player-debug-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('[data-field="bodyW"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="bodyH"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="colorR"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="colorG"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="colorB"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="colorPicker"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="name"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="posX"]')).not.toBeNull();
    expect(dialog.querySelector('[data-field="posY"]')).not.toBeNull();

    panel.close();
  });

  it('populates initial values from player state', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const dialog = document.querySelector('.player-debug-dialog');
    expect(dialog.querySelector('[data-field="bodyW"]').value).toBe('16');
    expect(dialog.querySelector('[data-field="bodyH"]').value).toBe('14');
    expect(dialog.querySelector('[data-field="colorR"]').value).toBe('255');
    expect(dialog.querySelector('[data-field="colorG"]').value).toBe('102');
    expect(dialog.querySelector('[data-field="colorB"]').value).toBe('0');
    expect(dialog.querySelector('[data-field="name"]').value).toBe('TestPlayer');
    expect(dialog.querySelector('[data-field="posX"]').value).toBe('100');
    expect(dialog.querySelector('[data-field="posY"]').value).toBe('200');

    panel.close();
  });

  it('acquires input focus on open and releases on close', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    expect(acquireInputFocus).toHaveBeenCalled();

    panel.close();
    expect(releaseInputFocus).toHaveBeenCalled();
  });

  it('closes on backdrop click', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const backdrop = document.querySelector('.player-debug-backdrop');
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(document.querySelector('.player-debug-dialog')).toBeNull();
  });

  it('closes on Close button click', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    document.querySelector('[data-action="close"]').click();
    expect(document.querySelector('.player-debug-dialog')).toBeNull();
  });

  it('does not open when no game is running', () => {
    delete globalThis.__PHASER_GAME__;

    const panel = new PlayerDebugPanel();
    panel.open();

    expect(document.querySelector('.player-debug-dialog')).toBeNull();
  });

  it('updates collision body on input', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const bodyWInput = document.querySelector('[data-field="bodyW"]');
    bodyWInput.value = '20';
    bodyWInput.dispatchEvent(new Event('input'));

    // 20 * TEXTURE_SCALE(4) = 80
    expect(mockPlayer.sprite.body.setSize).toHaveBeenCalledWith(80, 56);
    expect(mockPlayer.sprite.body.setOffset).toHaveBeenCalled();

    panel.close();
  });

  it('updates color on RGB input', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const colorR = document.querySelector('[data-field="colorR"]');
    colorR.value = '0';
    colorR.dispatchEvent(new Event('input'));

    // 0x006600 = 0 << 16 | 102 << 8 | 0
    expect(mockPlayer.setColor).toHaveBeenCalledWith(0x006600);

    // Color picker should sync
    const picker = document.querySelector('[data-field="colorPicker"]');
    expect(picker.value).toBe('#006600');

    panel.close();
  });

  it('syncs RGB inputs from color picker', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const picker = document.querySelector('[data-field="colorPicker"]');
    picker.value = '#00ff80';
    picker.dispatchEvent(new Event('input'));

    expect(document.querySelector('[data-field="colorR"]').value).toBe('0');
    expect(document.querySelector('[data-field="colorG"]').value).toBe('255');
    expect(document.querySelector('[data-field="colorB"]').value).toBe('128');
    expect(mockPlayer.setColor).toHaveBeenCalledWith(0x00ff80);

    panel.close();
  });

  it('sends name identity update on change', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const nameInput = document.querySelector('[data-field="name"]');
    nameInput.value = 'NewName';
    nameInput.dispatchEvent(new Event('change'));

    expect(mockPlayer.nameLabel.setText).toHaveBeenCalledWith('NewName');
    expect(mockScene.networkManager.ws.send).toHaveBeenCalled();

    const sent = JSON.parse(mockScene.networkManager.ws.send.mock.calls[0][0]);
    expect(sent.type).toBe('identify');
    expect(sent.playerName).toBe('NewName');

    panel.close();
  });

  it('does not open duplicate panels', () => {
    const panel = new PlayerDebugPanel();
    panel.open();
    panel.open(); // second call should be no-op

    const backdrops = document.querySelectorAll('.player-debug-backdrop');
    expect(backdrops.length).toBe(1);

    panel.close();
  });
});
