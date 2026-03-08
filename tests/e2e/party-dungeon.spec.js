// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Party Dungeon Instancing + Identity Persistence ---
// Verifies that party members enter the same instanced map (#17)
// and that player identity (name, color) survives map transitions (#18).

const GAME_URL = 'http://localhost:8081';

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
  await page.goto(`${GAME_URL}?map=test`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => globalThis.__PHASER_GAME__, {
    timeout: 50_000,
    polling: 200,
  });
  await skipMainMenu(page);
}

async function waitForPlayerCount(page, n, timeout = 10_000) {
  await page.waitForFunction(
    (count) => {
      const badge = document.querySelector('.dd-roster-badge');
      if (!badge) return false;
      const match = badge.textContent.match(/Players:\s*(\d+)/);
      return match && parseInt(match[1], 10) >= count;
    },
    n,
    { timeout, polling: 300 },
  );
}

async function waitForRemotePlayerCount(page, expectedCount, timeout = 15_000) {
  await page.waitForFunction(
    (count) => {
      const game = globalThis.__PHASER_GAME__;
      if (!game) return false;
      const scene = game.scene.getScene('GameScene');
      if (!scene || !scene.remotePlayers) return false;
      return scene.remotePlayers.size === count;
    },
    expectedCount,
    { timeout, polling: 200 },
  );
}

// Form a party between two pages: A invites B, B accepts
async function formParty(pageA, pageB) {
  // A opens roster and clicks invite
  const badgeA = pageA.locator('.dd-roster-badge');
  await badgeA.click();
  const inviteBtn = pageA.locator('.dd-roster-invite').first();
  await inviteBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await inviteBtn.click();

  // B accepts invite toast
  const toast = pageB.locator('.dd-party-toast');
  await toast.waitFor({ state: 'visible', timeout: 10_000 });
  const acceptBtn = toast.locator('button.accept');
  await acceptBtn.click();

  // Wait for party panel on both
  await pageA.locator('.dd-party-members').waitFor({ state: 'visible', timeout: 10_000 });
  await pageB.locator('.dd-party-members').waitFor({ state: 'visible', timeout: 10_000 });
}

// Transition a page to a different map via scene restart
async function transitionToMap(page, mapId) {
  await page.evaluate((id) => {
    const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
    scene._isMapTransition = true;
    scene.scene.restart({ mapId: id, spawnTarget: null });
  }, mapId);

  await page.waitForFunction(
    (id) => {
      const game = globalThis.__PHASER_GAME__;
      if (!game) return false;
      const scene = game.scene.getScene('GameScene');
      return scene && scene._mapId === id && game.scene.isActive('GameScene');
    },
    mapId,
    { timeout: 15_000, polling: 200 },
  );
}

test.describe('Party dungeon instancing', () => {
  // Two game boots + party flow + map transitions need generous timeout
  test.setTimeout(180_000);

  test('party members see each other on instanced map (#17)', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await bootGame(pageA);
    await bootGame(pageB);
    await waitForPlayerCount(pageA, 2);
    await waitForPlayerCount(pageB, 2);
    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    // Form party
    await formParty(pageA, pageB);

    // Both transition to test2 (instanced map)
    await transitionToMap(pageA, 'test2');
    await transitionToMap(pageB, 'test2');

    // Both should see each other on the instanced map
    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    await contextA.close();
    await contextB.close();
  });

  test('player identity preserved after map round-trip (#18)', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await bootGame(pageA);
    await bootGame(pageB);
    await waitForPlayerCount(pageA, 2);
    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    // Record Player A's identity as seen by Player B
    const originalInfo = await pageB.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      const [rp] = scene.remotePlayers.values();
      return { name: rp.nameLabel.text, colorIndex: rp.colorIndex };
    });

    // Player A transitions to test2 and back
    await transitionToMap(pageA, 'test2');
    await waitForRemotePlayerCount(pageB, 0);

    await transitionToMap(pageA, 'test');
    await waitForRemotePlayerCount(pageB, 1);

    // Verify Player A's identity is preserved from B's perspective
    const afterInfo = await pageB.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      const [rp] = scene.remotePlayers.values();
      return { name: rp.nameLabel.text, colorIndex: rp.colorIndex };
    });

    expect(afterInfo.name).toBe(originalInfo.name);
    expect(afterInfo.colorIndex).toBe(originalInfo.colorIndex);

    await contextA.close();
    await contextB.close();
  });
});
