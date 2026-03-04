import { describe, it, expect } from 'vitest';
import { ViewTransform } from '../../client/src/map-editor/ViewTransform.js';

describe('ViewTransform', () => {
  describe('worldToScreen / screenToWorld', () => {
    it('identity at default zoom with no offset', () => {
      const vt = new ViewTransform();
      // Default zoom is 2, so world 10 → screen 20
      const s = vt.worldToScreen(10, 20);
      expect(s.x).toBe(20);
      expect(s.y).toBe(40);
    });

    it('round-trips correctly', () => {
      const vt = new ViewTransform();
      vt.offsetX = 50;
      vt.offsetY = -30;
      vt.zoom = 3;
      const screen = vt.worldToScreen(100, 200);
      const world = vt.screenToWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(100, 5);
      expect(world.y).toBeCloseTo(200, 5);
    });

    it('accounts for offset', () => {
      const vt = new ViewTransform();
      vt.offsetX = 100;
      vt.offsetY = 100;
      vt.zoom = 1;
      const s = vt.worldToScreen(150, 200);
      expect(s.x).toBe(50);
      expect(s.y).toBe(100);
    });
  });

  describe('screenToTile', () => {
    it('converts screen to tile coordinates', () => {
      const vt = new ViewTransform();
      vt.zoom = 2; // 1 tile = 32 screen pixels
      const t = vt.screenToTile(33, 33); // just past first tile
      expect(t.tileX).toBe(1);
      expect(t.tileY).toBe(1);
    });

    it('handles negative world coordinates', () => {
      const vt = new ViewTransform();
      vt.zoom = 1;
      vt.offsetX = -32; // world origin is at screen x=32
      // screen x=0 → world x=-32 → tile x=-2
      const t = vt.screenToTile(0, 0);
      expect(t.tileX).toBe(-2);
      expect(t.tileY).toBe(0);
    });

    it('uses custom tile size', () => {
      const vt = new ViewTransform();
      vt.zoom = 1;
      const t = vt.screenToTile(33, 33, 32);
      expect(t.tileX).toBe(1);
      expect(t.tileY).toBe(1);
    });
  });

  describe('zoomAt', () => {
    it('keeps the target point fixed', () => {
      const vt = new ViewTransform();
      vt.zoom = 2;
      const worldBefore = vt.screenToWorld(100, 100);
      vt.zoomAt(100, 100, 4);
      const worldAfter = vt.screenToWorld(100, 100);
      expect(worldAfter.x).toBeCloseTo(worldBefore.x, 5);
      expect(worldAfter.y).toBeCloseTo(worldBefore.y, 5);
    });

    it('clamps to min zoom', () => {
      const vt = new ViewTransform();
      vt.zoomAt(0, 0, 0.1);
      expect(vt.zoom).toBe(0.25);
    });

    it('clamps to max zoom', () => {
      const vt = new ViewTransform();
      vt.zoomAt(0, 0, 20);
      expect(vt.zoom).toBe(16);
    });
  });

  describe('pan', () => {
    it('adjusts offset by screen delta scaled by zoom', () => {
      const vt = new ViewTransform();
      vt.zoom = 2;
      vt.pan(100, 200); // screen pixels
      // pan subtracts screenDelta/zoom from offset
      expect(vt.offsetX).toBe(-50);
      expect(vt.offsetY).toBe(-100);
    });
  });

  describe('getVisibleBounds', () => {
    it('returns correct world-space rectangle', () => {
      const vt = new ViewTransform();
      vt.zoom = 2;
      vt.offsetX = 0;
      vt.offsetY = 0;
      const b = vt.getVisibleBounds(640, 480);
      expect(b.x).toBe(0);
      expect(b.y).toBe(0);
      expect(b.width).toBe(320);
      expect(b.height).toBe(240);
    });
  });
});
