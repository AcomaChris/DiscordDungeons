// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Platform Movement & Step-Height Elevation ---
// Verifies the step-height elevation system: auto-step-up within stepHeight,
// blocking above stepHeight, and gravity-based drop-down.

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

  test('ground player auto-steps onto elevation-1 platform', async ({ page }) => {
    await bootGame(page);

    // Place on ground just left of the platform (column 3, row 13)
    await placeOnPlatform(page, 56, 216, 0, 0);

    // Walk right toward the elevation-1 platform at column 4
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');

    const after = await page.evaluate(() => {
      const p = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
      return { x: p.sprite.x, z: p.z, groundZ: p.groundZ };
    });

    console.log(`After step-up: x=${after.x.toFixed(1)}, z=${after.z}, groundZ=${after.groundZ}`);

    // Player should have moved right past the platform edge (column 4 = x 64)
    expect(after.x).toBeGreaterThan(64);
    // Player should have auto-stepped up to elevation 1 (8px)
    expect(after.z).toBe(8);
  });

  test('ground player blocked by over-step-height elevation', async ({ page }) => {
    await bootGame(page);

    // Place on ground just right of the elevation-3 block (column 11, row 13)
    // Elevation-3 block is at columns 9-10, rows 13-14 (24px)
    await placeOnPlatform(page, 184, 216, 0, 0);

    // Try to walk left into elevation-3 block
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');

    const after = await page.evaluate(() => {
      const p = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
      return { x: p.sprite.x, z: p.z, groundZ: p.groundZ };
    });

    console.log(`After blocked: x=${after.x.toFixed(1)}, z=${after.z}, groundZ=${after.groundZ}`);

    // Player should remain at ground level
    expect(after.z).toBe(0);
    // Should not have passed into the elevation-3 tile area (column 10 ends at x=176)
    expect(after.x).toBeGreaterThan(170);
  });

  test('elevation-1 player blocked by elevation-3', async ({ page }) => {
    await bootGame(page);

    // Place on elevation-1 platform at right edge (column 8, row 13)
    // Elevation-3 block starts at column 9
    await placeOnPlatform(page, 136, 216, 8, 8);

    const startX = await page.evaluate(() => {
      return globalThis.__PHASER_GAME__.scene.getScene('GameScene').player.sprite.x;
    });

    // Try to walk right into elevation-3 block at column 9
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight');

    const after = await page.evaluate(() => {
      const p = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
      return { x: p.sprite.x, z: p.z, groundZ: p.groundZ };
    });

    const dx = after.x - startX;
    console.log(`After elev-3 block: dx=${dx.toFixed(1)}, z=${after.z}, groundZ=${after.groundZ}`);

    // Player should be blocked — elevation-3 (24px) is more than stepHeight above z=8
    // Should not pass into column 9 (x=144)
    expect(after.x).toBeLessThan(150);
    expect(after.z).toBe(8);
  });

  test('player drops down when walking off elevated platform', async ({ page }) => {
    await bootGame(page);

    // Place on elevation-1 platform near left edge (column 4, row 13)
    // Ground starts at column 3
    await placeOnPlatform(page, 72, 216, 8, 8);

    // Walk left off the platform edge
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    await page.keyboard.up('ArrowLeft');

    const after = await page.evaluate(() => {
      const p = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
      return { x: p.sprite.x, z: p.z, groundZ: p.groundZ };
    });

    console.log(`After drop: x=${after.x.toFixed(1)}, z=${after.z}, groundZ=${after.groundZ}`);

    // Player should have moved left off the platform
    expect(after.x).toBeLessThan(68);
    // Player should have dropped to ground level via gravity
    expect(after.z).toBe(0);
    expect(after.groundZ).toBe(0);
  });
});
