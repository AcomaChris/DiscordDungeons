// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayerPanel } from '../../client/src/map-editor/LayerPanel.js';
import { ALL_LAYER_NAMES } from '../../client/src/map-editor/MapDocument.js';

describe('LayerPanel', () => {
  let container, panel;

  beforeEach(() => {
    container = document.createElement('div');
    panel = new LayerPanel(container);
  });

  // --- Active layer ---

  describe('active layer', () => {
    it('defaults to Ground', () => {
      expect(panel.activeLayer).toBe('Ground');
    });

    it('setActiveLayer changes active layer', () => {
      panel.setActiveLayer('Walls');
      expect(panel.activeLayer).toBe('Walls');
    });

    it('fires onActiveLayerChange callback', () => {
      const cb = vi.fn();
      panel.onActiveLayerChange = cb;
      panel.setActiveLayer('Overlay');
      expect(cb).toHaveBeenCalledWith('Overlay');
    });

    it('ignores invalid layer names', () => {
      panel.setActiveLayer('NonExistent');
      expect(panel.activeLayer).toBe('Ground');
    });

    it('clicking a layer item sets it active', () => {
      const cb = vi.fn();
      panel.onActiveLayerChange = cb;

      const wallsItem = container.querySelector('[data-layer="Walls"]');
      wallsItem.click();

      expect(panel.activeLayer).toBe('Walls');
      expect(cb).toHaveBeenCalledWith('Walls');
    });

    it('active layer has active CSS class', () => {
      panel.setActiveLayer('WallTops');

      const active = container.querySelector('.layer-item.active');
      expect(active).not.toBeNull();
      expect(active.dataset.layer).toBe('WallTops');

      // Ground should no longer be active
      const ground = container.querySelector('[data-layer="Ground"]');
      expect(ground.classList.contains('active')).toBe(false);
    });
  });

  // --- Visibility ---

  describe('visibility', () => {
    it('all layers visible by default', () => {
      for (const name of ALL_LAYER_NAMES) {
        expect(panel.getVisibility(name)).toBe(true);
      }
    });

    it('setVisibility hides a layer', () => {
      panel.setVisibility('Ground', false);
      expect(panel.getVisibility('Ground')).toBe(false);
    });

    it('fires onVisibilityChange callback', () => {
      const cb = vi.fn();
      panel.onVisibilityChange = cb;
      panel.setVisibility('Walls', false);
      expect(cb).toHaveBeenCalledWith('Walls', false);
    });

    it('clicking eye toggles visibility', () => {
      const cb = vi.fn();
      panel.onVisibilityChange = cb;

      const eye = container.querySelector('[data-layer="Ground"] .layer-visibility');
      eye.click();

      expect(panel.getVisibility('Ground')).toBe(false);
      expect(cb).toHaveBeenCalledWith('Ground', false);

      // Click again to restore
      eye.click();
      expect(panel.getVisibility('Ground')).toBe(true);
      expect(cb).toHaveBeenCalledWith('Ground', true);
    });

    it('hidden layer eye has hidden-layer class', () => {
      panel.setVisibility('Overlay', false);
      const eye = container.querySelector('[data-layer="Overlay"] .layer-visibility');
      expect(eye.classList.contains('hidden-layer')).toBe(true);
    });
  });

  // --- Opacity ---

  describe('opacity', () => {
    it('defaults to 1.0', () => {
      expect(panel.getOpacity('Ground')).toBe(1.0);
    });
  });

  // --- Quick switch ---

  describe('selectByIndex', () => {
    it('selects layer by index (0-based)', () => {
      const cb = vi.fn();
      panel.onActiveLayerChange = cb;

      panel.selectByIndex(2); // Walls
      expect(panel.activeLayer).toBe(ALL_LAYER_NAMES[2]);
      expect(cb).toHaveBeenCalledWith(ALL_LAYER_NAMES[2]);
    });

    it('ignores out-of-range index', () => {
      panel.selectByIndex(99);
      expect(panel.activeLayer).toBe('Ground');
    });
  });

  // --- DOM structure ---

  describe('DOM structure', () => {
    it('renders all layer groups', () => {
      const headers = container.querySelectorAll('.layer-group-header');
      expect(headers.length).toBe(3); // Floor, Structures, System
      expect(headers[0].textContent).toBe('Floor');
      expect(headers[1].textContent).toBe('Structures');
      expect(headers[2].textContent).toBe('System');
    });

    it('renders all layers', () => {
      const items = container.querySelectorAll('.layer-item');
      expect(items.length).toBe(ALL_LAYER_NAMES.length);
    });

    it('each layer item has visibility eye and opacity slider', () => {
      const item = container.querySelector('[data-layer="Ground"]');
      expect(item.querySelector('.layer-visibility')).not.toBeNull();
      expect(item.querySelector('.layer-opacity')).not.toBeNull();
    });
  });
});
