// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Party Invite → Accept Flow ---
// Two browser contexts connect to the same room. Player A invites Player B
// via the roster panel. Player B accepts via the invite toast. Both players
// should see the party members panel.

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

// Wait for the roster badge to show a player count of at least `n`.
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

test.describe('Party invite flow', () => {
  // Two full game boots + WS handshake + party flow needs more time
  test.setTimeout(90_000);

  test('Player A invites Player B, Player B accepts', async ({ browser }) => {
    // --- Boot two separate browser contexts (separate sessions) ---
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Boot both games — they'll connect to the same default room
    await bootGame(pageA);
    await bootGame(pageB);

    // Wait for both to see each other in the roster
    await waitForPlayerCount(pageA, 2);
    await waitForPlayerCount(pageB, 2);

    // --- Player A: open roster and click invite on Player B ---
    const badgeA = pageA.locator('.dd-roster-badge');
    await badgeA.click();

    // Wait for the roster panel to appear with an invite button
    const inviteBtn = pageA.locator('.dd-roster-invite').first();
    await inviteBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await inviteBtn.click();

    // Verify the button changes to "Sent" and is disabled
    await expect(inviteBtn).toHaveText('Sent');
    await expect(inviteBtn).toBeDisabled();

    // --- Player B: wait for invite toast and accept ---
    const toast = pageB.locator('.dd-party-toast');
    await toast.waitFor({ state: 'visible', timeout: 10_000 });

    // Verify toast contains invite text
    await expect(toast.locator('span')).toContainText('invites you to a party');

    // Click accept
    const acceptBtn = toast.locator('button.accept');
    await acceptBtn.click();

    // Toast should disappear after accepting
    await expect(toast).not.toBeVisible({ timeout: 5_000 });

    // --- Both players: verify party members panel appears ---
    const membersA = pageA.locator('.dd-party-members');
    const membersB = pageB.locator('.dd-party-members');

    await membersA.waitFor({ state: 'visible', timeout: 10_000 });
    await membersB.waitFor({ state: 'visible', timeout: 10_000 });

    // Both panels should show "Party" heading and at least 2 members
    await expect(membersA.locator('h4')).toHaveText('Party');
    await expect(membersB.locator('h4')).toHaveText('Party');

    const memberCountA = await membersA.locator('.dd-party-member').count();
    const memberCountB = await membersB.locator('.dd-party-member').count();
    expect(memberCountA).toBe(2);
    expect(memberCountB).toBe(2);

    // Cleanup
    await contextA.close();
    await contextB.close();
  });
});
