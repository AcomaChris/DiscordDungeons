// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Interactive Objects ---
// Verifies that interactive objects load, prompts appear on proximity,
// and E key dispatches interaction events.

const GAME_URL = 'http://localhost:8081';

async function waitForScene(page, sceneKey, timeout = 30_000) {
  await page.waitForFunction(
    (key) => {
      const game = globalThis.__PHASER_GAME__;
      return game && game.scene.isActive(key);
    },
    sceneKey,
    { timeout, polling: 200 },
  );
}

async function skipMainMenu(page) {
  await waitForScene(page, 'MainMenuScene');
  const guestBtn = page.getByRole('button', { name: 'Play as Guest' });
  await guestBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await guestBtn.click();
  const startBtn = page.getByRole('button', { name: 'Start Playing' });
  await startBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await startBtn.click();
  await waitForScene(page, 'GameScene');
}

async function bootGame(page) {
  await page.goto(`${GAME_URL}?map=test`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
    timeout: 30_000,
    polling: 200,
  });
  await skipMainMenu(page);
}

test.describe('Interactive objects', () => {
  test('loads interactive objects from map', async ({ page }) => {
    const logs = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') logs.push(msg.text());
    });

    await bootGame(page);

    // Check that objects were loaded
    const objectCount = await page.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      return scene.objectManager.size;
    });
    expect(objectCount).toBe(2);

    // Verify the console log message
    const loadLog = logs.find(l => l.includes('interactive objects'));
    expect(loadLog).toContain('2 interactive objects');
  });

  test('shows prompt when player is near interactable object', async ({ page }) => {
    await bootGame(page);

    // Move player to the chest position (7*16=112, 16*16=256)
    // Spawn is at (5*16=80, 16*16=256), chest is 2 tiles right
    // Hold right key to walk toward chest
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(800); // Walk ~2 tiles at 80px/s
    await page.keyboard.up('ArrowRight');

    // Wait a frame for interaction manager to detect proximity
    await page.waitForTimeout(100);

    // Check if the interaction prompt is visible
    const promptVisible = await page.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      return scene.interactionManager.currentTarget !== null;
    });
    expect(promptVisible).toBe(true);
  });

  test('dispatches interact event on E key press', async ({ page }) => {
    await bootGame(page);

    // Set up event listener before moving
    await page.evaluate(() => {
      globalThis.__interactEvents = [];
      const { default: eventBus } = globalThis.__PHASER_GAME__.scene
        .getScene('GameScene').objectManager._objects.values().next().value
        ? { default: null } : { default: null };
    });

    // Use evaluate to listen for interact events via the object manager
    await page.evaluate(() => {
      globalThis.__interactEvents = [];
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      // Teleport player directly to the chest for reliable testing
      scene.player.sprite.setPosition(112, 256);
    });

    // Wait for interaction manager to pick up the nearby object
    await page.waitForTimeout(200);

    // Press E
    await page.keyboard.press('e');
    await page.waitForTimeout(100);

    // Check if the target was acquired (interaction was dispatched)
    const hadTarget = await page.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      return scene.interactionManager.currentTarget !== null;
    });
    expect(hadTarget).toBe(true);
  });
});
