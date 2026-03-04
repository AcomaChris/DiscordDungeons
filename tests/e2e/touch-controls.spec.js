// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Touch Controls (Joystick + Action Buttons) ---
// Verifies that touch controls appear on touch-capable devices, including
// hybrid devices like Chromebooks that have both touch and a trackpad.

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

async function bootGameWithTouch(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    hasTouch: true,
    ...opts,
  });
  const page = await context.newPage();
  await page.goto(`${GAME_URL}?map=test`, { waitUntil: 'domcontentloaded' });
  // Extended timeout for cold-start — first Vite transform can take 30s+
  await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
    timeout: 50_000,
    polling: 200,
  });
  await skipMainMenu(page);
  return { context, page };
}

test.describe('Touch controls', () => {
  test('joystick and action buttons are visible on touch device', async ({ browser }) => {
    const { context, page } = await bootGameWithTouch(browser);

    const container = page.locator('#touch-controls');
    await expect(container).toBeVisible();

    const joystick = page.locator('.joystick-base');
    await expect(joystick).toBeVisible();

    const knob = page.locator('.joystick-knob');
    await expect(knob).toBeVisible();

    const jumpBtn = page.locator('.btn-jump');
    await expect(jumpBtn).toBeVisible();

    const sprintBtn = page.locator('.btn-sprint');
    await expect(sprintBtn).toBeVisible();

    await context.close();
  });

  test('touch controls are hidden on non-touch device', async ({ page }) => {
    // Default Playwright context has no touch — simulates desktop
    await page.goto(`${GAME_URL}?map=test`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
      timeout: 30_000,
      polling: 200,
    });
    await skipMainMenu(page);

    // Container should not exist in DOM at all (JS gate prevents creation)
    const container = page.locator('#touch-controls');
    await expect(container).toHaveCount(0);
  });

  test('joystick and buttons visible on hybrid device (touch + trackpad)', async ({ browser }) => {
    // Chromebook-like: has touch AND fine pointer (trackpad)
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`${GAME_URL}?map=test`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
      timeout: 30_000,
      polling: 200,
    });
    await skipMainMenu(page);

    const container = page.locator('#touch-controls');
    await expect(container).toBeVisible();

    const joystick = page.locator('.joystick-base');
    await expect(joystick).toBeVisible();

    await context.close();
  });

  test('action buttons reflect equipped abilities', async ({ browser }) => {
    const { context, page } = await bootGameWithTouch(browser);

    // Default abilities include jump and movement — both buttons visible
    const jumpBtn = page.locator('.btn-jump');
    const sprintBtn = page.locator('.btn-sprint');
    await expect(jumpBtn).toBeVisible();
    await expect(sprintBtn).toBeVisible();

    // Unequip jump ability — jump button should hide
    await page.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      scene.player.abilities.unequip('jump');
      scene.touchManager._updateButtonVisibility();
    });
    await expect(jumpBtn).not.toBeVisible();
    await expect(sprintBtn).toBeVisible();

    // Re-equip jump — button should reappear
    await page.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      scene.player.abilities.equip('jump');
      scene.touchManager._updateButtonVisibility();
    });
    await expect(jumpBtn).toBeVisible();

    await context.close();
  });
});
