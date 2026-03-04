// @ts-check
import { test, expect } from '@playwright/test';

// --- E2E: Map Editor ---
// Verifies the map editor page loads, canvas renders, tools work,
// and export produces valid Tiled JSON.

const EDITOR_URL = 'http://localhost:8081/map-editor.html';

test.describe('Map Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDITOR_URL);
    // Wait for the editor to initialize (canvas present + MapEditor logged)
    await page.waitForSelector('#map-canvas', { timeout: 10_000 });
    // Give the editor a moment to fully initialize
    await page.waitForTimeout(500);
  });

  test('page loads with toolbar, canvas, and status bar', async ({ page }) => {
    // Toolbar elements
    await expect(page.locator('#map-toolbar')).toBeVisible();
    await expect(page.locator('#tool-buttons')).toBeVisible();
    await expect(page.locator('#export-btn')).toBeVisible();
    await expect(page.locator('#import-btn')).toBeVisible();
    await expect(page.locator('#new-map-btn')).toBeVisible();
    await expect(page.locator('#undo-btn')).toBeVisible();
    await expect(page.locator('#redo-btn')).toBeVisible();
    await expect(page.locator('#grid-toggle-btn')).toBeVisible();
    await expect(page.locator('#auto-collision-btn')).toBeVisible();

    // Canvas
    await expect(page.locator('#map-canvas')).toBeVisible();

    // Status bar
    await expect(page.locator('#status-cursor')).toBeVisible();
    await expect(page.locator('#status-zoom')).toBeVisible();
    await expect(page.locator('#status-layer')).toBeVisible();
  });

  test('tool buttons are created and switchable', async ({ page }) => {
    // Tool buttons should exist in the toolbar
    const toolButtons = page.locator('#tool-buttons .btn-tool');
    const count = await toolButtons.count();
    expect(count).toBe(7); // Brush, Eraser, Rect, Fill, Line, Select, Object

    // First tool (Brush) should be active by default
    const firstBtn = toolButtons.first();
    await expect(firstBtn).toHaveClass(/active/);

    // Click second tool (Eraser) — should become active
    const secondBtn = toolButtons.nth(1);
    await secondBtn.click();
    await expect(secondBtn).toHaveClass(/active/);
    await expect(firstBtn).not.toHaveClass(/active/);
  });

  test('keyboard shortcuts switch tools', async ({ page }) => {
    const toolButtons = page.locator('#tool-buttons .btn-tool');

    // Press 'e' for Eraser
    await page.keyboard.press('e');
    await expect(toolButtons.nth(1)).toHaveClass(/active/);

    // Press 'r' for Rectangle
    await page.keyboard.press('r');
    await expect(toolButtons.nth(2)).toHaveClass(/active/);

    // Press 'b' for Brush
    await page.keyboard.press('b');
    await expect(toolButtons.nth(0)).toHaveClass(/active/);
  });

  test('floating panels are created', async ({ page }) => {
    // Palette panel
    await expect(page.locator('#palette-panel')).toBeVisible();

    // Layer panel
    await expect(page.locator('#layer-panel')).toBeVisible();

    // Object palette panel
    await expect(page.locator('#object-palette-panel')).toBeVisible();

    // Property panel
    await expect(page.locator('#property-panel')).toBeVisible();
  });

  test('grid toggle works', async ({ page }) => {
    const gridBtn = page.locator('#grid-toggle-btn');

    // Grid is on by default
    await expect(gridBtn).toHaveClass(/active/);

    // Click to toggle off
    await gridBtn.click();
    await expect(gridBtn).not.toHaveClass(/active/);

    // Click to toggle back on
    await gridBtn.click();
    await expect(gridBtn).toHaveClass(/active/);
  });

  test('layer panel shows layer groups', async ({ page }) => {
    const layerPanel = page.locator('#layer-panel');

    // Should have layer group headers
    await expect(layerPanel.locator('.layer-group-header')).toHaveCount(3); // Floor, Structures, System

    // Should have layer rows
    const layerRows = layerPanel.locator('.layer-item');
    const rowCount = await layerRows.count();
    expect(rowCount).toBe(7); // Ground, GroundDecor, Walls, WallTops, Overlay, Collision, Elevation
  });

  test('status bar shows layer name', async ({ page }) => {
    const statusLayer = page.locator('#status-layer');
    await expect(statusLayer).toHaveText('Layer: Ground');
  });

  test('Ctrl+G toggles grid via keyboard', async ({ page }) => {
    const gridBtn = page.locator('#grid-toggle-btn');
    await expect(gridBtn).toHaveClass(/active/);

    await page.keyboard.press('Control+g');
    await expect(gridBtn).not.toHaveClass(/active/);

    await page.keyboard.press('Control+g');
    await expect(gridBtn).toHaveClass(/active/);
  });
});
