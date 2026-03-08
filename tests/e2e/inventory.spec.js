// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Player Inventory ---
// Verifies player menu UI, chest looting (Take / Take All),
// and equip/unequip flows in the live game.

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

// Teleport player to chest and press E to open it
async function openChest(page) {
  await page.evaluate(() => {
    const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
    scene.player.sprite.setPosition(112, 256);
  });

  // Wait for InteractionManager to acquire the chest as target
  await page.waitForFunction(() => {
    const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
    return scene.interactionManager.currentTarget !== null;
  }, { timeout: 5_000, polling: 100 });

  // Press E to interact — use down/up to ensure the input snapshot catches it
  await page.keyboard.down('e');
  await page.waitForTimeout(100);
  await page.keyboard.up('e');

  // Wait for container panel to appear
  await page.waitForSelector('.dd-container-panel', { timeout: 5_000 });
}

test.describe('Player Inventory', () => {
  test('player menu button is visible after boot', async ({ page }) => {
    await bootGame(page);
    await expect(page.locator('.dd-player-btn')).toBeVisible();
  });

  test('player menu opens with inventory tab', async ({ page }) => {
    await bootGame(page);

    await page.locator('.dd-player-btn').click();
    await expect(page.locator('.dd-player-backdrop')).toBeVisible();

    // Inventory tab is active
    const activeTab = page.locator('.dd-player-tab.active');
    await expect(activeTab).toHaveText('Inventory');

    // 11 equipment slots
    const equipSlots = page.locator('.dd-equip-slot');
    await expect(equipSlots).toHaveCount(11);

    // 20 bag slots, all empty
    const bagSlots = page.locator('.dd-bag-slot');
    await expect(bagSlots).toHaveCount(20);
    const filledBag = page.locator('.dd-bag-slot.filled');
    await expect(filledBag).toHaveCount(0);
  });

  test('player menu closes on X button', async ({ page }) => {
    await bootGame(page);

    await page.locator('.dd-player-btn').click();
    await expect(page.locator('.dd-player-backdrop')).toBeVisible();

    await page.locator('.dd-player-close').click();
    await expect(page.locator('.dd-player-backdrop')).toHaveCount(0);
  });

  test('chest interaction shows container panel', async ({ page }) => {
    await bootGame(page);
    await openChest(page);

    const panel = page.locator('.dd-container-panel');
    await expect(panel).toBeVisible();

    // 2 items: Gold Coin ×5, Health Potion ×1
    const items = page.locator('.dd-container-item');
    await expect(items).toHaveCount(2);

    // Take All button present
    await expect(page.locator('.dd-container-takeall')).toBeVisible();
  });

  test('take single item from chest moves it to bag', async ({ page }) => {
    await bootGame(page);
    await openChest(page);

    // Take the first item (Gold Coin)
    const takeBtn = page.locator('.take-btn').first();
    await takeBtn.click();
    await page.waitForTimeout(100);

    // Container should have 1 item remaining
    const remainingItems = page.locator('.dd-container-item');
    await expect(remainingItems).toHaveCount(1);

    // Close container by walking away
    await page.evaluate(() => {
      const scene = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      scene.player.sprite.setPosition(300, 300);
    });
    await page.waitForTimeout(300);

    // Open player menu — should have 1 filled bag slot
    await page.locator('.dd-player-btn').click();
    await page.waitForTimeout(100);
    const filledBag = page.locator('.dd-bag-slot.filled');
    await expect(filledBag).toHaveCount(1);
  });

  test('take all from chest moves all items to bag', async ({ page }) => {
    await bootGame(page);
    await openChest(page);

    // Click Take All
    await page.locator('.dd-container-takeall').click();
    await page.waitForTimeout(200);

    // Container panel should be gone (auto-closes when empty)
    await expect(page.locator('.dd-container-panel')).toHaveCount(0);

    // Open player menu — should have 2 filled bag slots (gold + potion)
    await page.locator('.dd-player-btn').click();
    await page.waitForTimeout(100);
    const filledBag = page.locator('.dd-bag-slot.filled');
    await expect(filledBag).toHaveCount(2);
  });

  test('equip item from bag to equipment slot', async ({ page }) => {
    await bootGame(page);

    // Add a sword to inventory directly
    await page.evaluate(() => {
      const mgr = globalThis.__PHASER_GAME__.scene.getScene('GameScene');
      // Access inventoryManager via the module system
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import inventoryManager from '/src/inventory/InventoryManager.js';
        inventoryManager.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
        window.__INV_READY__ = true;
      `;
      document.head.appendChild(script);
    });
    await page.waitForFunction(() => window.__INV_READY__, { timeout: 5_000 });
    await page.waitForTimeout(100);

    // Open player menu
    await page.locator('.dd-player-btn').click();
    await page.waitForTimeout(100);

    // Should have 1 filled bag slot
    const filledBag = page.locator('.dd-bag-slot.filled');
    await expect(filledBag).toHaveCount(1);

    // No filled equipment slots yet
    await expect(page.locator('.dd-equip-slot.filled')).toHaveCount(0);

    // Click the sword in the bag to equip it
    await filledBag.first().click();
    await page.waitForTimeout(100);

    // Now equipment should have 1 filled slot, bag should be empty
    await expect(page.locator('.dd-equip-slot.filled')).toHaveCount(1);
    await expect(page.locator('.dd-bag-slot.filled')).toHaveCount(0);
  });

  test('unequip item from equipment slot back to bag', async ({ page }) => {
    await bootGame(page);

    // Add and equip a sword
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = `
        import inventoryManager from '/src/inventory/InventoryManager.js';
        inventoryManager.addItem({ id: 'sword', name: 'Iron Sword', quantity: 1 });
        inventoryManager.equipItem(0);
        window.__EQUIP_READY__ = true;
      `;
      document.head.appendChild(script);
    });
    await page.waitForFunction(() => window.__EQUIP_READY__, { timeout: 5_000 });
    await page.waitForTimeout(100);

    // Open player menu
    await page.locator('.dd-player-btn').click();
    await page.waitForTimeout(100);

    // Should have 1 filled equipment slot, 0 bag items
    await expect(page.locator('.dd-equip-slot.filled')).toHaveCount(1);
    await expect(page.locator('.dd-bag-slot.filled')).toHaveCount(0);

    // Click the equipped item to unequip
    await page.locator('.dd-equip-slot.filled').click();
    await page.waitForTimeout(100);

    // Now bag should have 1 item, equipment should be empty
    await expect(page.locator('.dd-equip-slot.filled')).toHaveCount(0);
    await expect(page.locator('.dd-bag-slot.filled')).toHaveCount(1);
  });

  test('reopening empty chest shows empty state', async ({ page }) => {
    await bootGame(page);
    await openChest(page);

    // Take all items
    await page.locator('.dd-container-takeall').click();
    await page.waitForTimeout(200);

    // Re-interact with chest
    await openChest(page);

    // Container should show empty state or no items
    const panel = page.locator('.dd-container-panel');
    await expect(panel).toBeVisible();
    const items = page.locator('.dd-container-item');
    await expect(items).toHaveCount(0);
  });
});
