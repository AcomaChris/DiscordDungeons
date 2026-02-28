// @ts-check
import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

// --- E2E: Camera Centering (Screenshot-Based) ---
// Verifies the player character is visually centered on screen by analyzing
// actual rendered pixels — not game state, which can be correct while the
// visual output is wrong (as we discovered with the DPR/camera mismatch bug).
//
// Pixel analysis runs IN THE BROWSER via canvas.toDataURL() + OffscreenCanvas
// because Playwright's page.screenshot() doesn't capture WebGL canvas content
// in headless Chromium (compositor layer issue).

const GAME_URL = 'http://localhost:8081';
const ARTIFACTS_DIR = 'test-results';

// Vite cold-start can take 30s+ for first module transform
async function waitForScene(page, sceneKey, timeout = 50_000) {
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
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
    timeout: 50_000,
    polling: 200,
  });
  await skipMainMenu(page);
  // Wait for render frames to settle
  await page.waitForTimeout(1500);
}

// Capture game state for diagnostic logging
async function captureGameState(page) {
  return page.evaluate(() => {
    const game = globalThis.__PHASER_GAME__;
    const scene = game.scene.getScene('GameScene');
    const cam = scene.cameras.main;
    const player = scene.player;
    const tm = scene.tileMapManager;
    return {
      dpr: window.devicePixelRatio,
      scaleWidth: game.scale.width,
      scaleHeight: game.scale.height,
      rendererWidth: game.renderer.width,
      rendererHeight: game.renderer.height,
      camWidth: cam.width,
      camHeight: cam.height,
      camZoom: cam.zoom,
      playerX: player.sprite.x,
      playerY: player.sprite.y,
      mapWidth: tm.tilemap.widthInPixels,
      mapHeight: tm.tilemap.heightInPixels,
      spawnX: tm.spawnPoint.x,
      spawnY: tm.spawnPoint.y,
    };
  });
}

// Run pixel analysis entirely in the browser to avoid the headless Chromium
// WebGL screenshot issue. Returns the centroid of orange pixels (player body)
// and a color histogram for debugging.
async function analyzeCanvasPixels(page) {
  return page.evaluate(async () => {
    const game = globalThis.__PHASER_GAME__;
    const canvas = game.canvas;
    const dataUrl = canvas.toDataURL('image/png');

    // Decode the PNG in the browser via OffscreenCanvas
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const data = imageData.data;
    const w = bitmap.width;
    const h = bitmap.height;

    // Find orange pixel centroid (player body color: 0xff6600 = RGB 255,102,0)
    let sumX = 0;
    let sumY = 0;
    let orangeCount = 0;

    // Also build color histogram for debugging
    const colorCounts = {};

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Sample every 100th pixel for histogram
      if (i % 400 === 0) {
        const key = `rgba(${r},${g},${b},${a})`;
        colorCounts[key] = (colorCounts[key] || 0) + 1;
      }

      // Orange body: high red, medium green, very low blue
      if (r >= 200 && g >= 60 && g <= 180 && b <= 50 && a > 200) {
        const pixelIndex = i / 4;
        const x = pixelIndex % w;
        const y = Math.floor(pixelIndex / w);
        sumX += x;
        sumY += y;
        orangeCount++;
      }
    }

    const topColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([color, count]) => ({ color, count }));

    if (orangeCount === 0) {
      return {
        centroid: null,
        width: w,
        height: h,
        totalPixels: w * h,
        topColors,
      };
    }

    return {
      centroid: {
        x: sumX / orangeCount,
        y: sumY / orangeCount,
        ratioX: sumX / orangeCount / w,
        ratioY: sumY / orangeCount / h,
        pixelCount: orangeCount,
      },
      width: w,
      height: h,
      totalPixels: w * h,
      topColors,
    };
  });
}

// Save a PNG artifact via canvas.toDataURL() for visual inspection
async function saveCanvasArtifact(page, filename) {
  const dataUrl = await page.evaluate(() => {
    return globalThis.__PHASER_GAME__.canvas.toDataURL('image/png');
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  writeFileSync(filename, Buffer.from(base64, 'base64'));
}

test.describe('Camera centering (screenshot)', () => {
  test.beforeAll(() => {
    mkdirSync(ARTIFACTS_DIR, { recursive: true });
  });

  test('player is visually centered at spawn (DPR=1)', async ({ page }) => {
    await bootGame(page);

    const state = await captureGameState(page);
    console.log('Game state (DPR=1):', JSON.stringify(state, null, 2));

    await saveCanvasArtifact(page, `${ARTIFACTS_DIR}/screenshot-dpr1.png`);
    const result = await analyzeCanvasPixels(page);
    console.log(`Canvas: ${result.width}×${result.height}`);

    if (!result.centroid) {
      console.log('No orange pixels found. Top colors:');
      for (const { color, count } of result.topColors) {
        console.log(`  ${color}: ${count}`);
      }
    }

    expect(result.centroid).not.toBeNull();
    const c = result.centroid;
    console.log(
      `Centroid: (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) ` +
        `ratio=(${c.ratioX.toFixed(3)}, ${c.ratioY.toFixed(3)}) ` +
        `${c.pixelCount} orange px`,
    );

    // Player should be within 10% of screen center
    expect(c.ratioX).toBeGreaterThan(0.4);
    expect(c.ratioX).toBeLessThan(0.6);
    expect(c.ratioY).toBeGreaterThan(0.4);
    expect(c.ratioY).toBeLessThan(0.6);
  });

  test('player is visually centered at spawn (DPR=2)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    await bootGame(page);

    const state = await captureGameState(page);
    console.log('Game state (DPR=2):', JSON.stringify(state, null, 2));

    await saveCanvasArtifact(page, `${ARTIFACTS_DIR}/screenshot-dpr2.png`);
    const result = await analyzeCanvasPixels(page);
    console.log(`Canvas: ${result.width}×${result.height}`);

    if (!result.centroid) {
      console.log('No orange pixels found. Top colors:');
      for (const { color, count } of result.topColors) {
        console.log(`  ${color}: ${count}`);
      }
    }

    expect(result.centroid).not.toBeNull();
    const c = result.centroid;
    console.log(
      `Centroid: (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) ` +
        `ratio=(${c.ratioX.toFixed(3)}, ${c.ratioY.toFixed(3)}) ` +
        `${c.pixelCount} orange px`,
    );

    expect(c.ratioX).toBeGreaterThan(0.4);
    expect(c.ratioX).toBeLessThan(0.6);
    expect(c.ratioY).toBeGreaterThan(0.4);
    expect(c.ratioY).toBeLessThan(0.6);

    await context.close();
  });
});
