// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Float Ability ---
// Verifies the float passive ability reduces gravity during descent by its
// configured gravityFactor (0.5 → half speed fall), without affecting ascent.

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

// Place the player at a specific position in open space, at the apex of a
// jump (vz=0, z=startZ) so both ascent and descent can be measured cleanly.
async function placeAtApex(page, worldX, worldY, startZ = 200) {
  await page.evaluate(({ x, y, z }) => {
    const player = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
    player.sprite.setPosition(x, y);
    player.sprite.setVelocity(0, 0);
    player._groundY = y;
    player.z = z;
    player.groundZ = 0;
    player._isJumping = true;
    player.vz = 0;  // at apex — next frame starts descending
  }, { x: worldX, y: worldY, z: startZ });
  // Let one frame run so the jump state is established
  await page.waitForTimeout(50);
}

test.describe('Float ability (issue #3)', () => {
  // Open space at tile (15, 10) = world (240, 160) — no walls or elevation nearby.
  // Math check at 400ms, starting from Z=200, vz=0:
  //   Without float (gravity=1000): z ≈ 200 - 0.5×1000×0.16 = 120px
  //   With float    (gravity=500):  z ≈ 200 - 0.5×500×0.16  = 160px
  // Both still airborne at 400ms (ground reached at ~632ms and ~894ms respectively).

  test('float reduces descent speed compared to no float', async ({ page }) => {
    await bootGame(page);

    // Baseline — no float ability
    await placeAtApex(page, 240, 160, 200);
    await page.waitForTimeout(400);

    const noFloatZ = await page.evaluate(() => {
      return globalThis.__PHASER_GAME__.scene.getScene('GameScene').player.z;
    });

    // With float — equip the ability then restart from the same apex
    await page.evaluate(() => {
      const player = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
      player.abilities.equip('float');
    });
    await placeAtApex(page, 240, 160, 200);
    await page.waitForTimeout(400);

    const floatZ = await page.evaluate(() => {
      return globalThis.__PHASER_GAME__.scene.getScene('GameScene').player.z;
    });

    console.log(`Without float: Z=${noFloatZ.toFixed(1)}, With float: Z=${floatZ.toFixed(1)}`);

    // Float halves gravity during descent → player should be meaningfully higher
    expect(floatZ).toBeGreaterThan(noFloatZ + 20);
  });

  test('float does not affect ascent — apex height is unchanged', async ({ page }) => {
    await bootGame(page);

    // Start ascending (vz > 0) and measure Z 200ms later.
    // Float only activates during descent (vz < 0), so ascent should be identical.
    const measure = async (withFloat) => {
      await page.evaluate((equip) => {
        const player = globalThis.__PHASER_GAME__.scene.getScene('GameScene').player;
        if (equip) {
          player.abilities.equip('float');
        } else {
          player.abilities.unequip('float');
        }
        player.sprite.setPosition(240, 160);
        player.sprite.setVelocity(0, 0);
        player._groundY = 160;
        player.z = 0;
        player.groundZ = 0;
        player._isJumping = true;
        player.vz = 300;  // ascending — float should NOT apply yet
      }, withFloat);

      await page.waitForTimeout(200);

      return page.evaluate(() => {
        return globalThis.__PHASER_GAME__.scene.getScene('GameScene').player.z;
      });
    };

    const noFloatZ = await measure(false);
    const floatZ = await measure(true);

    console.log(`Ascent at 200ms — without float: Z=${noFloatZ.toFixed(1)}, with float: Z=${floatZ.toFixed(1)}`);

    // During ascent float is inactive, so heights should be equal (±4px timing tolerance)
    expect(Math.abs(floatZ - noFloatZ)).toBeLessThan(4);
  });
});
