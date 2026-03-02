// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Platform Movement (Issue #6) ---
// Verifies that a player standing on an elevated platform can move
// horizontally without being blocked by adjacent higher-elevation tiles.

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

// Teleport player to a specific position on the platform
async function placeOnPlatform(page, worldX, worldY, z, groundZ) {
  await page.evaluate(({ x, y, z, gz }) => {
    const player = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
    player.sprite.setPosition(x, y);
    player.sprite.setVelocity(0, 0);
    player._groundY = y;
    player.z = z;
    player.groundZ = gz;
    player._isJumping = false;
    player.vz = 0;
  }, { x: worldX, y: worldY, z, gz: groundZ });
  // Let a few frames run so _updateElevationCollision processes
  await page.waitForTimeout(100);
}

test.describe('Platform movement (issue #6)', () => {
  test('player on elevation-1 platform can move horizontally', async ({ page }) => {
    await bootGame(page);

    // Place player on the elevation-1 platform at tile (8, 13) = world (136, 216)
    await placeOnPlatform(page, 136, 216, 8, 8);

    const startX = await page.evaluate(() => {
      return globalThis.__PHASER_GAME__.scene.getScene('GameScene').player.sprite.x;
    });

    // Press left arrow for 500ms
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');

    const afterLeft = await page.evaluate(() => {
      const p = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
      return { x: p.sprite.x, z: p.z, groundZ: p.groundZ };
    });

    const dx = afterLeft.x - startX;
    console.log(`Moved left: dx=${dx.toFixed(1)}, z=${afterLeft.z}, groundZ=${afterLeft.groundZ}`);

    // Player must have moved left (negative dx)
    expect(dx).toBeLessThan(-5);
    // Player should still be at elevation 1
    expect(afterLeft.z).toBe(8);
  });

  test('ground player is still blocked by platform walls', async ({ page }) => {
    await bootGame(page);

    // Place player on the ground just left of the platform
    // Platform starts at tile column 4, so place at column 3 (x=56, y=224)
    await placeOnPlatform(page, 56, 224, 0, 0);

    const startX = await page.evaluate(() => {
      return globalThis.__PHASER_GAME__.scene.getScene('GameScene').player.sprite.x;
    });

    // Try to walk right into the platform
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');

    const afterRight = await page.evaluate(() => {
      const p = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
      return { x: p.sprite.x, z: p.z, groundZ: p.groundZ };
    });

    const dx = afterRight.x - startX;
    console.log(`Moved right toward platform: dx=${dx.toFixed(1)}, z=${afterRight.z}`);

    // Player should be blocked — minimal or no rightward movement past the wall
    // (they can move a few pixels before hitting the wall edge)
    expect(afterRight.z).toBe(0);
    // Should not have passed tile column 4 (x=64)
    expect(afterRight.x).toBeLessThan(72);
  });
});
