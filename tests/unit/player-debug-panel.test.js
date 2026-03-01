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

// Helper: builds a mock AbilityManager with state-tracking methods.
// Pass initial equipped abilities as { id: { param: value } }.
function createMockAbilities(initialEquipped = {}, initialActive = []) {
  const equipped = new Map();
  const activeSet = new Set(initialActive);
  for (const [id, params] of Object.entries(initialEquipped)) {
    equipped.set(id, { ...params });
  }
  return {
    has: vi.fn((id) => equipped.has(id)),
    get: vi.fn((id) => {
      if (!equipped.has(id)) return null;
      return { params: equipped.get(id), active: activeSet.has(id) };
    }),
    getParam: vi.fn((id, paramName) => {
      const p = equipped.get(id);
      return p?.[paramName];
    }),
    getBaseParam: vi.fn((id, paramName) => {
      const p = equipped.get(id);
      return p?.[paramName];
    }),
    getModifiers: vi.fn(() => []),
    equip: vi.fn((id) => { equipped.set(id, {}); }),
    unequip: vi.fn((id) => { equipped.delete(id); }),
    setParam: vi.fn((id, paramName, value) => {
      const p = equipped.get(id);
      if (p) p[paramName] = value;
    }),
    getState: vi.fn(() => ({
      equipped: [...equipped.keys()],
      active: [...activeSet],
      params: Object.fromEntries(equipped),
    })),
  };
}

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
      abilities: createMockAbilities({ movement: { walkSpeed: 80, sprintSpeed: 160 } }),
    };

    mockScene = {
      player: mockPlayer,
      networkManager: {
        ws: { readyState: 1, send: vi.fn() },
      },
    };

    // Mock canvas for focus toggle tests
    const mockCanvas = document.createElement('canvas');
    document.body.appendChild(mockCanvas);

    // Expose mock game global
    globalThis.__PHASER_GAME__ = {
      canvas: mockCanvas,
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
    for (const el of document.querySelectorAll('canvas')) {
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

  it('renders all abilities with equip checkboxes', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const blocks = document.querySelectorAll('.player-debug-ability-block');
    // ABILITY_DEFS has 3 abilities: movement, jump, float
    expect(blocks.length).toBe(3);

    const names = [...blocks].map((b) => b.dataset.abilityId);
    expect(names).toContain('movement');
    expect(names).toContain('jump');
    expect(names).toContain('float');

    panel.close();
  });

  it('checks equip checkbox for equipped abilities', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const movementBlock = document.querySelector('[data-ability-id="movement"]');
    const jumpBlock = document.querySelector('[data-ability-id="jump"]');

    expect(movementBlock.querySelector('.player-debug-ability-equip').checked).toBe(true);
    expect(jumpBlock.querySelector('.player-debug-ability-equip').checked).toBe(false);

    panel.close();
  });

  it('shows param inputs for equipped abilities', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const movementBlock = document.querySelector('[data-ability-id="movement"]');
    const paramInputs = movementBlock.querySelectorAll('[data-ability-param]');
    expect(paramInputs.length).toBe(2);
    expect(movementBlock.querySelector('[data-ability-param="movement.walkSpeed"]').value).toBe('80');
    expect(movementBlock.querySelector('[data-ability-param="movement.sprintSpeed"]').value).toBe('160');

    // Unequipped abilities should not show param inputs
    const jumpBlock = document.querySelector('[data-ability-id="jump"]');
    expect(jumpBlock.querySelector('.player-debug-ability-params')).toBeNull();

    panel.close();
  });

  it('calls equip when checkbox is checked', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const jumpCheckbox = document.querySelector('[data-ability-id="jump"] .player-debug-ability-equip');
    jumpCheckbox.checked = true;
    jumpCheckbox.dispatchEvent(new Event('change'));

    expect(mockPlayer.abilities.equip).toHaveBeenCalledWith('jump');

    panel.close();
  });

  it('calls unequip when checkbox is unchecked', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const movementCheckbox = document.querySelector('[data-ability-id="movement"] .player-debug-ability-equip');
    movementCheckbox.checked = false;
    movementCheckbox.dispatchEvent(new Event('change'));

    expect(mockPlayer.abilities.unequip).toHaveBeenCalledWith('movement');

    panel.close();
  });

  it('calls setParam when param input changes', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const walkSpeedInput = document.querySelector('[data-ability-param="movement.walkSpeed"]');
    walkSpeedInput.value = '120';
    walkSpeedInput.dispatchEvent(new Event('input'));

    expect(mockPlayer.abilities.setParam).toHaveBeenCalledWith('movement', 'walkSpeed', 120);

    panel.close();
  });

  it('shows active indicator when ability is active', () => {
    mockPlayer.abilities = createMockAbilities(
      { movement: { walkSpeed: 80, sprintSpeed: 160 } },
      ['movement'],
    );

    const panel = new PlayerDebugPanel();
    panel.open();

    const dot = document.querySelector('[data-ability-id="movement"] .player-debug-ability-dot');
    expect(dot.classList.contains('active')).toBe(true);

    panel.close();
  });

  it('shows inactive indicator when ability is not active', () => {
    const panel = new PlayerDebugPanel();
    panel.open();

    const dot = document.querySelector('[data-ability-id="movement"] .player-debug-ability-dot');
    expect(dot.classList.contains('active')).toBe(false);

    panel.close();
  });

  it('releases focus when canvas is clicked', () => {
    const panel = new PlayerDebugPanel();
    panel.open();
    acquireInputFocus.mockClear();
    releaseInputFocus.mockClear();

    globalThis.__PHASER_GAME__.canvas.dispatchEvent(new Event('pointerdown'));

    expect(releaseInputFocus).toHaveBeenCalledTimes(1);

    panel.close();
  });

  it('re-acquires focus when panel input is focused after canvas click', () => {
    const panel = new PlayerDebugPanel();
    panel.open();
    acquireInputFocus.mockClear();
    releaseInputFocus.mockClear();

    // Click canvas to release focus
    globalThis.__PHASER_GAME__.canvas.dispatchEvent(new Event('pointerdown'));
    expect(releaseInputFocus).toHaveBeenCalledTimes(1);

    // Focus a panel input to re-acquire
    const nameInput = document.querySelector('[data-field="name"]');
    nameInput.dispatchEvent(new Event('focusin', { bubbles: true }));

    expect(acquireInputFocus).toHaveBeenCalledTimes(1);

    panel.close();
  });

  it('does not double-release when closing after canvas click', () => {
    const panel = new PlayerDebugPanel();
    panel.open();
    acquireInputFocus.mockClear();
    releaseInputFocus.mockClear();

    // Click canvas to release focus
    globalThis.__PHASER_GAME__.canvas.dispatchEvent(new Event('pointerdown'));
    expect(releaseInputFocus).toHaveBeenCalledTimes(1);

    // Close panel — should not call releaseInputFocus again
    panel.close();
    expect(releaseInputFocus).toHaveBeenCalledTimes(1);
  });
});
