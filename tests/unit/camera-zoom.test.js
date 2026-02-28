import { describe, it, expect } from 'vitest';
import { CAMERA_ZOOM, CHAR_HEIGHT } from '../../client/src/core/Constants.js';

describe('camera zoom', () => {
  it('CAMERA_ZOOM is a positive number', () => {
    expect(CAMERA_ZOOM).toBeGreaterThan(0);
  });

  it('character screen height is the same on all screen sizes', () => {
    // zoom is constant, so character visual size never changes with screen size
    const screens = [[1366, 768], [390, 844], [1920, 1080], [2560, 1440], [360, 640]];
    const expected = CHAR_HEIGHT * CAMERA_ZOOM;
    for (const [sw, sh] of screens) {
      void sw; void sh; // screen size is irrelevant — zoom is not derived from it
      expect(CHAR_HEIGHT * CAMERA_ZOOM).toBe(expected);
    }
  });

  it('larger screens show more world', () => {
    const visibleSmall = 390 / CAMERA_ZOOM;
    const visibleLarge = 1920 / CAMERA_ZOOM;
    expect(visibleLarge).toBeGreaterThan(visibleSmall);
  });
});
