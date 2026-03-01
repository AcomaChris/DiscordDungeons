// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E Debug: Position Tracking ---
// Launches the game in a real browser, waits for GameScene, simulates input,
// and captures sprite + name label positions each frame. Useful for diagnosing
// rendering issues like jitter, misalignment, or frame-lag.

const GAME_URL = 'http://localhost:8081';
const CHAR_HEIGHT = 24; // must match Constants.js

// Wait for Phaser to boot and a specific scene to be active
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

// Skip past MainMenuScene via guest login
async function skipMainMenu(page) {
  await waitForScene(page, 'MainMenuScene');
  // No stored session → login UI is shown as an HTML overlay
  const guestBtn = page.getByRole('button', { name: 'Play as Guest' });
  await guestBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await guestBtn.click();
  const startBtn = page.getByRole('button', { name: 'Start Playing' });
  await startBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await startBtn.click();
  await waitForScene(page, 'GameScene');
}

// Boot the game and get past the menu — shared setup for all e2e tests
async function bootGame(page) {
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
    timeout: 30_000,
    polling: 200,
  });
  await skipMainMenu(page);
}

test.describe('Position tracking', () => {
  test('name label tracks sprite without jitter during movement', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') consoleLogs.push(msg.text());
    });

    await bootGame(page);

    // Start recording position data each frame
    await page.evaluate((charHeight) => {
      const game = globalThis.__PHASER_GAME__;
      const scene = game.scene.getScene('GameScene');
      globalThis.__POSITION_FRAMES__ = [];
      scene.events.on('render', () => {
        const player = scene.player;
        globalThis.__POSITION_FRAMES__.push({
          frame: globalThis.__POSITION_FRAMES__.length,
          spriteX: player.sprite.x,
          spriteY: player.sprite.y,
          labelX: player.nameLabel.x,
          labelY: player.nameLabel.y,
          expectedLabelY: player.sprite.y - charHeight / 2 - 4,
        });
      });
    }, CHAR_HEIGHT);

    // Move right using real keyboard input
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ArrowRight');

    // Move down
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(500);

    const positionData = await page.evaluate(() => globalThis.__POSITION_FRAMES__);

    console.log(`Captured ${positionData.length} frames of position data`);

    // Check for movement in either axis
    const movingFrames = positionData.filter(
      (f, i) => i > 0 && (
        Math.abs(f.spriteX - positionData[i - 1].spriteX) > 0.1 ||
        Math.abs(f.spriteY - positionData[i - 1].spriteY) > 0.1
      ),
    );

    console.log(`${movingFrames.length} frames had movement`);

    // The label Y should always equal sprite Y - CHAR_HEIGHT/2 - 4
    let yJitterCount = 0;
    for (const frame of movingFrames) {
      const yDiff = Math.abs(frame.labelY - frame.expectedLabelY);
      if (yDiff > 0.01) {
        yJitterCount++;
        console.log(
          `Frame ${frame.frame}: label Y offset = ${yDiff.toFixed(3)} ` +
            `(sprite=${frame.spriteY.toFixed(2)}, label=${frame.labelY.toFixed(2)}, ` +
            `expected=${frame.expectedLabelY.toFixed(2)})`,
        );
      }
    }

    // The label X should track sprite X (within rounding tolerance)
    let xJitterCount = 0;
    for (const frame of movingFrames) {
      const xDiff = Math.abs(frame.labelX - frame.spriteX);
      if (xDiff > 1.5) xJitterCount++;
    }

    // Print sample frames for debugging
    const samples = [0, 10, 20, 40, 60, 80].filter((i) => i < positionData.length);
    console.log('Sample frames:');
    for (const i of samples) {
      const f = positionData[i];
      console.log(
        `  [${f.frame}] sprite=(${f.spriteX.toFixed(1)}, ${f.spriteY.toFixed(1)}) ` +
          `label=(${f.labelX.toFixed(1)}, ${f.labelY.toFixed(1)})`,
      );
    }

    // Assert we captured enough data and saw movement
    expect(positionData.length).toBeGreaterThan(30);
    expect(movingFrames.length).toBeGreaterThan(5);

    // No persistent Y jitter (occasional 1-frame jitter from physics settling is ok)
    expect(yJitterCount).toBeLessThan(3);
    expect(xJitterCount).toBe(0);

    if (consoleLogs.length > 0) {
      console.log('--- Game Console Output ---');
      consoleLogs.forEach((log) => console.log(`  ${log}`));
    }
  });

  test('captures game console output', async ({ page }) => {
    const consoleLogs = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      else consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await bootGame(page);

    // Let the game run for 2 seconds
    await page.waitForTimeout(2000);

    console.log('--- All Console Output ---');
    consoleLogs.forEach((log) => console.log(`  ${log}`));

    if (consoleErrors.length > 0) {
      console.log('--- Console Errors ---');
      consoleErrors.forEach((err) => console.log(`  ERROR: ${err}`));
    }

    if (pageErrors.length > 0) {
      console.log('--- Uncaught Exceptions ---');
      pageErrors.forEach((err) => console.log(`  ${err}`));
    }

    // No fatal console errors (WS errors are expected without server)
    const fatalErrors = consoleErrors.filter(
      (e) => !e.includes('WebSocket') && !e.includes('net::ERR'),
    );
    expect(fatalErrors).toHaveLength(0);

    // No uncaught exceptions — these crash the preupdate handler and
    // prevent rendering (see issue #5: tile.collides read-only getter)
    expect(pageErrors).toHaveLength(0);
  });

  test('game renders visible content (not blank screen)', async ({ page }) => {
    await bootGame(page);
    await page.waitForTimeout(1000);

    // Sample the canvas to verify something besides the background color renders.
    // This catches rendering failures like issue #5 where uncaught exceptions
    // silently prevent all visual output.
    const result = await page.evaluate(() => {
      const game = globalThis.__PHASER_GAME__;
      const canvas = game.canvas;
      const dataUrl = canvas.toDataURL('image/png');

      const img = new Image();
      img.src = dataUrl;

      // Use OffscreenCanvas to read pixels
      const offscreen = new OffscreenCanvas(canvas.width, canvas.height);
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(canvas, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Count distinct colors in a sample of pixels
      const colorSet = new Set();
      for (let i = 0; i < data.length; i += 400) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        colorSet.add(`${r},${g},${b}`);
      }

      return { distinctColors: colorSet.size, width: canvas.width, height: canvas.height };
    });

    console.log(`Canvas ${result.width}×${result.height}, ${result.distinctColors} distinct colors sampled`);
    // A blank screen has only 1 color (the background). A working game
    // should have floor tiles, player sprite, wall sprites etc — many colors.
    expect(result.distinctColors).toBeGreaterThan(1);
  });
});
