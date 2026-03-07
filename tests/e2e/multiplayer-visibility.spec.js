// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Multiplayer Visibility ---
// Two browser contexts connect to the same room on the same map.
// Verifies that players can see each other, receive position updates,
// handle disconnects, and survive map transitions.

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
    timeout: 30_000,
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

// Wait for a player to appear in the remotePlayers map
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

test.describe('Multiplayer visibility', () => {
  test.setTimeout(90_000);

  test('two players spawn and see each other', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Capture console logs for debugging
    const logsA = [];
    const logsB = [];
    pageA.on('console', (msg) => logsA.push(`[A:${msg.type()}] ${msg.text()}`));
    pageB.on('console', (msg) => logsB.push(`[B:${msg.type()}] ${msg.text()}`));

    await bootGame(pageA);
    await bootGame(pageB);

    // Both should see each other in the roster
    await waitForPlayerCount(pageA, 2);
    await waitForPlayerCount(pageB, 2);

    // Both should have a remote player sprite
    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    // Verify remote player sprites exist in the scene
    const remoteCountA = await pageA.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      return scene.remotePlayers.size;
    });
    const remoteCountB = await pageB.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      return scene.remotePlayers.size;
    });

    expect(remoteCountA).toBe(1);
    expect(remoteCountB).toBe(1);

    await contextA.close();
    await contextB.close();
  });

  test('remote player position updates flow correctly', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await bootGame(pageA);
    await bootGame(pageB);

    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    // Record Player A's initial position and the remote view from B
    const initialPosA = await pageA.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      return { x: scene.player.sprite.x, y: scene.player.sprite.y };
    });

    // Move Player A to the right by simulating key press
    await pageA.keyboard.down('ArrowRight');
    // Wait for movement + state sync (200ms movement + 100ms broadcast cycle)
    await pageA.waitForTimeout(500);
    await pageA.keyboard.up('ArrowRight');

    // Wait for B's remote player to reflect A's movement
    await pageB.waitForFunction(
      (startX) => {
        const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
        if (!scene || scene.remotePlayers.size === 0) return false;
        const [rp] = scene.remotePlayers.values();
        // Remote player should have moved right (X increased)
        return rp.sprite.x > startX + 5;
      },
      initialPosA.x,
      { timeout: 5_000, polling: 100 },
    );

    // Verify the remote player position actually changed
    const remotePosOnB = await pageB.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      const [rp] = scene.remotePlayers.values();
      return { x: rp.sprite.x, y: rp.sprite.y };
    });

    expect(remotePosOnB.x).toBeGreaterThan(initialPosA.x + 5);

    await contextA.close();
    await contextB.close();
  });

  test('player disconnect removes remote player', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await bootGame(pageA);
    await bootGame(pageB);

    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    // Close Player B — Player A should see them disappear
    await contextB.close();

    // Wait for A to remove B from remotePlayers
    await waitForRemotePlayerCount(pageA, 0);

    const remoteCountA = await pageA.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      return scene.remotePlayers.size;
    });
    expect(remoteCountA).toBe(0);

    await contextA.close();
  });

  test('map transition — player leaves and returns', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const logsA = [];
    pageA.on('console', (msg) => logsA.push(`[${msg.type()}] ${msg.text()}`));

    await bootGame(pageA);
    await bootGame(pageB);

    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    // Player A transitions to test2 via scene restart (bypasses fade animation for test speed)
    await pageA.evaluate(() => {
      const game = globalThis.__PHASER_GAME__;
      const scene = game.scene.getScene('GameScene');
      scene._isMapTransition = true;
      scene.scene.restart({ mapId: 'test2', spawnTarget: null });
    });

    // Wait for A's scene to restart on test2
    await pageA.waitForFunction(
      () => {
        const game = globalThis.__PHASER_GAME__;
        if (!game) return false;
        const scene = game.scene.getScene('GameScene');
        return scene && scene._mapId === 'test2' && game.scene.isActive('GameScene');
      },
      null,
      { timeout: 15_000, polling: 200 },
    );

    // Player B should no longer see Player A
    await waitForRemotePlayerCount(pageB, 0);

    // Player A transitions back to test (direct restart, no fade)
    await pageA.evaluate(() => {
      const game = globalThis.__PHASER_GAME__;
      const scene = game.scene.getScene('GameScene');
      scene._isMapTransition = true;
      scene.scene.restart({ mapId: 'test', spawnTarget: null });
    });

    // Wait for A's scene to be back on test
    await pageA.waitForFunction(
      () => {
        const game = globalThis.__PHASER_GAME__;
        if (!game) return false;
        const scene = game.scene.getScene('GameScene');
        return scene && scene._mapId === 'test' && game.scene.isActive('GameScene');
      },
      null,
      { timeout: 15_000, polling: 200 },
    );

    // Player B should see Player A again
    await waitForRemotePlayerCount(pageB, 1, 20_000);

    await contextA.close();
    await contextB.close();
  });

  test('no unexpected console errors during multiplayer session', async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const errorsA = [];
    const errorsB = [];
    const pageErrorsA = [];
    const pageErrorsB = [];

    pageA.on('console', (msg) => {
      if (msg.type() === 'error') errorsA.push(msg.text());
    });
    pageB.on('console', (msg) => {
      if (msg.type() === 'error') errorsB.push(msg.text());
    });
    pageA.on('pageerror', (err) => pageErrorsA.push(err.message));
    pageB.on('pageerror', (err) => pageErrorsB.push(err.message));

    await bootGame(pageA);
    await bootGame(pageB);

    await waitForRemotePlayerCount(pageA, 1);
    await waitForRemotePlayerCount(pageB, 1);

    // Let the session run for a moment to catch any async errors
    await pageA.waitForTimeout(2000);

    // Filter expected errors (WebSocket noise, net::ERR, BE API not configured in test env)
    const isExpected = (msg) =>
      msg.includes('WebSocket') ||
      msg.includes('net::ERR') ||
      msg.includes('ERR_CONNECTION_REFUSED') ||
      msg.includes('Failed to load resource') ||
      msg.includes('NPCBrain') ||
      msg.includes('Behavior Engine');

    const unexpectedA = errorsA.filter((e) => !isExpected(e));
    const unexpectedB = errorsB.filter((e) => !isExpected(e));

    expect(pageErrorsA).toEqual([]);
    expect(pageErrorsB).toEqual([]);
    expect(unexpectedA).toEqual([]);
    expect(unexpectedB).toEqual([]);

    await contextA.close();
    await contextB.close();
  });
});
