import { describe, it, expect } from 'vitest';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../client/src/core/Constants.js';

// Replicates the camera zoom logic from GameScene._updateCamera
function computeCamera(screenWidth, screenHeight) {
  const zoom = Math.min(screenWidth / WORLD_WIDTH, screenHeight / WORLD_HEIGHT);
  const visibleWidth = screenWidth / zoom;
  const visibleHeight = screenHeight / zoom;
  const scrollX = (WORLD_WIDTH - visibleWidth) / 2;
  const scrollY = WORLD_HEIGHT - visibleHeight;
  return { zoom, scrollX, scrollY, visibleWidth, visibleHeight };
}

describe('camera zoom calculation', () => {
  it('entire world is visible at any screen size', () => {
    const screens = [
      [1366, 768],
      [390, 844],
      [1920, 1080],
      [800, 600],
      [1024, 768],
      [360, 640],
    ];

    for (const [sw, sh] of screens) {
      const { visibleWidth, visibleHeight } = computeCamera(sw, sh);
      expect(visibleWidth, `screen ${sw}x${sh} width`).toBeGreaterThanOrEqual(WORLD_WIDTH);
      expect(visibleHeight, `screen ${sw}x${sh} height`).toBeGreaterThanOrEqual(WORLD_HEIGHT);
    }
  });

  it('zoom is 1.0 when screen matches world size', () => {
    const { zoom, scrollX, scrollY } = computeCamera(WORLD_WIDTH, WORLD_HEIGHT);
    expect(zoom).toBe(1.0);
    expect(scrollX).toBe(0);
    expect(scrollY).toBe(0);
  });

  it('floor is anchored to bottom of screen (scrollY <= 0)', () => {
    const screens = [[1366, 768], [390, 844], [1920, 1080]];
    for (const [sw, sh] of screens) {
      const { scrollY } = computeCamera(sw, sh);
      expect(scrollY, `screen ${sw}x${sh}`).toBeLessThanOrEqual(0);
    }
  });

  it('world is centered horizontally (scrollX <= 0)', () => {
    const screens = [[1366, 768], [390, 844], [1920, 1080]];
    for (const [sw, sh] of screens) {
      const { scrollX } = computeCamera(sw, sh);
      expect(scrollX, `screen ${sw}x${sh}`).toBeLessThanOrEqual(0);
    }
  });

  it('zoom scales proportionally with screen size', () => {
    const base = computeCamera(800, 600);
    const doubled = computeCamera(1600, 1200);
    expect(doubled.zoom).toBeCloseTo(base.zoom * 2, 5);
  });
});
