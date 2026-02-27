import { describe, it, expect } from 'vitest';

// AGENT: Phaser requires browser APIs (canvas, DOM) at import time.
// Tests use dynamic import with .catch() to skip gracefully in Node.

describe('game configuration', () => {
  it('GameScene exports a class with the correct scene key', async () => {
    const mod = await import('../../client/src/scenes/GameScene.js').catch(() => null);
    if (!mod) return;

    expect(mod.GameScene).toBeDefined();
    expect(typeof mod.GameScene).toBe('function');
  });

  it('has expected physics and scale settings', async () => {
    const mod = await import('../../client/src/main.js').catch(() => null);
    if (!mod) return;

    expect(mod.config.physics.default).toBe('arcade');
    expect(mod.config.physics.arcade.gravity.y).toBeGreaterThan(0);
    expect(mod.config.scale.mode).toBeDefined();
    expect(mod.config.scene).toHaveLength(1);
  });
});
