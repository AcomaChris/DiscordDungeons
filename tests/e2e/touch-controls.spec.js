// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Touch Controls (Joystick + Action Buttons) ---
// Verifies touch control visibility rules:
// - Hidden on desktop (no touch) — DOM not created by JS
// - Visible on touch device (phone/tablet) — JS creates DOM, CSS allows it
// - Visible with ?touch=1 override — force-touch class bypasses CSS media query
// - Action buttons hide/show based on equipped abilities
//
// Note: Chromebook (touch + fine pointer) can't be perfectly simulated in
// Playwright — hasTouch changes media features to coarse/none. The CSS
// media query hiding is verified via unit tests and real-device testing.

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

async function bootGameWithTouch(browser, { forceTouch = false, ...opts } = {}) {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
    hasTouch: true,
    ...opts,
  });
  const page = await context.newPage();
  const touchParam = forceTouch ? '&touch=1' : '';
  await page.goto(`${GAME_URL}?map=test${touchParam}`, { waitUntil: 'domcontentloaded' });
  // Extended timeout for cold-start — first Vite transform can take 30s+
  await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
    timeout: 50_000,
    polling: 200,
  });
  await skipMainMenu(page);
  return { context, page };
}

test.describe('Touch controls', () => {
  test('touch controls are hidden on non-touch device', async ({ page }) => {
    // Default Playwright context has no touch — simulates desktop
    await page.goto(`${GAME_URL}?map=test`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
      timeout: 50_000,
      polling: 200,
    });
    await skipMainMenu(page);

    // Container should not exist in DOM at all (JS gate prevents creation)
    const container = page.locator('#touch-controls');
    await expect(container).toHaveCount(0);
  });

  test('joystick and action buttons visible on touch device', async ({ browser }) => {
    // hasTouch=true simulates a phone (coarse pointer, no hover)
    const { context, page } = await bootGameWithTouch(browser);

    const container = page.locator('#touch-controls');
    await expect(container).toBeVisible();

    await expect(page.locator('.joystick-base')).toBeVisible();
    await expect(page.locator('.joystick-knob')).toBeVisible();
    await expect(page.locator('.btn-jump')).toBeVisible();
    await expect(page.locator('.btn-sprint')).toBeVisible();

    await context.close();
  });

  test('?touch=1 adds force-touch class for CSS override', async ({ browser }) => {
    // Simulates /localtest mobile — ?touch=1 adds .force-touch to bypass
    // the CSS media query on devices with hover+fine pointer (Chromebook)
    const { context, page } = await bootGameWithTouch(browser, { forceTouch: true });

    const container = page.locator('#touch-controls');
    await expect(container).toBeVisible();
    await expect(container).toHaveClass(/force-touch/);

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
