// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Camera Centering Diagnostic ---
// Captures camera, player, and viewport state after GameScene loads.
// Asserts that the player appears at the center of the screen.

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
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
    timeout: 30_000,
    polling: 200,
  });
  await skipMainMenu(page);
}

// Capture all camera/player/viewport state from the running game
async function captureCameraState(page) {
  return page.evaluate(() => {
    const game = globalThis.__PHASER_GAME__;
    const scene = game.scene.getScene('GameScene');
    const cam = scene.cameras.main;
    const player = scene.player;
    const tm = scene.tileMapManager;

    const visibleWorldW = cam.width / cam.zoom;
    const visibleWorldH = cam.height / cam.zoom;

    // Player position relative to viewport (0.5 = centered).
    // cam.midPoint is in world coords; scrollX/Y is in pixel-hybrid space.
    const worldLeft = cam.midPoint.x - visibleWorldW / 2;
    const worldTop = cam.midPoint.y - visibleWorldH / 2;
    const playerScreenX = (player.sprite.x - worldLeft) / visibleWorldW;
    const playerScreenY = (player.sprite.y - worldTop) / visibleWorldH;

    return {
      dpr: window.devicePixelRatio,
      // Scale Manager
      scaleWidth: game.scale.width,
      scaleHeight: game.scale.height,
      // Renderer
      rendererWidth: game.renderer.width,
      rendererHeight: game.renderer.height,
      // Canvas
      canvasWidth: game.canvas.width,
      canvasHeight: game.canvas.height,
      canvasCssWidth: game.canvas.style.width,
      canvasCssHeight: game.canvas.style.height,
      // Camera
      camWidth: cam.width,
      camHeight: cam.height,
      camZoom: cam.zoom,
      camScrollX: cam.scrollX,
      camScrollY: cam.scrollY,
      camMidX: cam.midPoint.x,
      camMidY: cam.midPoint.y,
      // Visible world
      visibleWorldW,
      visibleWorldH,
      // Player
      playerX: player.sprite.x,
      playerY: player.sprite.y,
      // Map
      mapWidth: tm.tilemap.widthInPixels,
      mapHeight: tm.tilemap.heightInPixels,
      spawnX: tm.spawnPoint.x,
      spawnY: tm.spawnPoint.y,
      // Screen ratios (0.5 = centered)
      playerScreenX,
      playerScreenY,
    };
  });
}

function logState(label, state) {
  console.log(`\n=== ${label} ===`);
  console.log(`  DPR: ${state.dpr}`);
  console.log(`  Scale Manager: ${state.scaleWidth} × ${state.scaleHeight}`);
  console.log(`  Renderer: ${state.rendererWidth} × ${state.rendererHeight}`);
  console.log(`  Canvas element: ${state.canvasWidth} × ${state.canvasHeight}`);
  console.log(`  Canvas CSS: ${state.canvasCssWidth} × ${state.canvasCssHeight}`);
  console.log(`  Camera viewport: ${state.camWidth} × ${state.camHeight}`);
  console.log(`  Camera zoom: ${state.camZoom}`);
  console.log(`  Camera scroll: (${state.camScrollX.toFixed(1)}, ${state.camScrollY.toFixed(1)})`);
  console.log(`  Camera midPoint: (${state.camMidX.toFixed(1)}, ${state.camMidY.toFixed(1)})`);
  console.log(`  Visible world: ${state.visibleWorldW.toFixed(1)} × ${state.visibleWorldH.toFixed(1)}`);
  console.log(`  Player world pos: (${state.playerX.toFixed(1)}, ${state.playerY.toFixed(1)})`);
  console.log(`  Spawn point: (${state.spawnX}, ${state.spawnY})`);
  console.log(`  Map: ${state.mapWidth} × ${state.mapHeight}`);
  console.log(`  Player screen ratio: X=${state.playerScreenX.toFixed(3)}, Y=${state.playerScreenY.toFixed(3)}`);
  console.log(`  (0.500 = perfectly centered)`);
}

test.describe('Camera centering', () => {
  test('player is centered on screen at spawn (DPR=1)', async ({ page }) => {
    await bootGame(page);
    // Let a few frames render so the camera follow settles
    await page.waitForTimeout(500);

    const state = await captureCameraState(page);
    logState('DPR=1 (800×600)', state);

    // Player should be within 5% of screen center on both axes
    expect(state.playerScreenX).toBeGreaterThan(0.45);
    expect(state.playerScreenX).toBeLessThan(0.55);
    expect(state.playerScreenY).toBeGreaterThan(0.45);
    expect(state.playerScreenY).toBeLessThan(0.55);
  });

  test('player is centered on screen at spawn (DPR=2)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    await bootGame(page);
    await page.waitForTimeout(500);

    const state = await captureCameraState(page);
    logState('DPR=2 (800×600)', state);

    expect(state.playerScreenX).toBeGreaterThan(0.45);
    expect(state.playerScreenX).toBeLessThan(0.55);
    expect(state.playerScreenY).toBeGreaterThan(0.45);
    expect(state.playerScreenY).toBeLessThan(0.55);

    await context.close();
  });

  test('player stays centered after moving', async ({ page }) => {
    await bootGame(page);
    await page.waitForTimeout(300);

    // Move down-right
    await page.keyboard.down('ArrowDown');
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1000);
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(300);

    const state = await captureCameraState(page);
    logState('After movement', state);

    expect(state.playerScreenX).toBeGreaterThan(0.45);
    expect(state.playerScreenX).toBeLessThan(0.55);
    expect(state.playerScreenY).toBeGreaterThan(0.45);
    expect(state.playerScreenY).toBeLessThan(0.55);
  });
});
