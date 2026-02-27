import { describe, it, expect } from 'vitest';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../../client/src/core/Constants.js';

function computeZoom(screenWidth, screenHeight) {
  const zoom = Math.min(screenWidth / WORLD_WIDTH, screenHeight / WORLD_HEIGHT);
  const visibleWidth = screenWidth / zoom;
  const visibleHeight = screenHeight / zoom;
  return { zoom, visibleWidth, visibleHeight };
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
      const { visibleWidth, visibleHeight } = computeZoom(sw, sh);
      expect(visibleWidth, `screen ${sw}x${sh} width`).toBeGreaterThanOrEqual(WORLD_WIDTH);
      expect(visibleHeight, `screen ${sw}x${sh} height`).toBeGreaterThanOrEqual(WORLD_HEIGHT);
    }
  });

  it('zoom is 1.0 when screen matches world size', () => {
    const { zoom } = computeZoom(WORLD_WIDTH, WORLD_HEIGHT);
    expect(zoom).toBe(1.0);
  });

  it('zoom scales proportionally with screen size', () => {
    const base = computeZoom(800, 600);
    const doubled = computeZoom(1600, 1200);
    expect(doubled.zoom).toBeCloseTo(base.zoom * 2, 5);
  });
});
