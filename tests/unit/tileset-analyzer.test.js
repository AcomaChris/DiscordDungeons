import { describe, it, expect } from 'vitest';
import {
  isTileTransparent,
  horizontalEdgeDistance,
  verticalEdgeDistance,
  buildAdjacencyGraph,
  buildGroups,
  computeColorProfile,
  classifyCategory,
} from '../../client/src/tile-editor/TilesetAnalyzer.js';

// --- Test Helpers ---

// Create a flat RGBA pixel array for a grid of tiles.
// colorFn(col, row) returns [r, g, b, a] for each pixel in that tile.
// All pixels within a tile get the same color.
function makePixels(cols, rows, tileSize, colorFn) {
  const width = cols * tileSize;
  const height = rows * tileSize;
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let tileRow = 0; tileRow < rows; tileRow++) {
    for (let tileCol = 0; tileCol < cols; tileCol++) {
      const [r, g, b, a] = colorFn(tileCol, tileRow);
      for (let dy = 0; dy < tileSize; dy++) {
        for (let dx = 0; dx < tileSize; dx++) {
          const px = tileCol * tileSize + dx;
          const py = tileRow * tileSize + dy;
          const i = (py * width + px) * 4;
          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = a;
        }
      }
    }
  }

  return { pixels, width, height };
}

describe('TilesetAnalyzer', () => {
  describe('isTileTransparent', () => {
    it('detects fully transparent tile', () => {
      const { pixels, width } = makePixels(2, 2, 4, () => [0, 0, 0, 0]);
      expect(isTileTransparent(pixels, width, 0, 0, 4)).toBe(true);
    });

    it('detects opaque tile', () => {
      const { pixels, width } = makePixels(2, 2, 4, () => [128, 64, 32, 255]);
      expect(isTileTransparent(pixels, width, 0, 0, 4)).toBe(false);
    });

    it('handles mixed: average alpha < 10 is transparent', () => {
      const { pixels, width } = makePixels(2, 2, 4, () => [128, 64, 32, 5]);
      expect(isTileTransparent(pixels, width, 0, 0, 4)).toBe(true);
    });

    it('addresses specific tile by col/row', () => {
      const { pixels, width } = makePixels(3, 3, 4, (col, row) =>
        (col === 1 && row === 2) ? [255, 0, 0, 255] : [0, 0, 0, 0],
      );
      expect(isTileTransparent(pixels, width, 0, 0, 4)).toBe(true);
      expect(isTileTransparent(pixels, width, 1, 2, 4)).toBe(false);
    });
  });

  describe('horizontalEdgeDistance', () => {
    it('returns 0 for identical edge colors', () => {
      const { pixels, width } = makePixels(2, 1, 4, () => [100, 100, 100, 255]);
      const dist = horizontalEdgeDistance(pixels, width, 0, 0, 1, 0, 4);
      expect(dist).toBe(0);
    });

    it('returns high distance for different colors', () => {
      const { pixels, width } = makePixels(2, 1, 4, (col) =>
        col === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255],
      );
      const dist = horizontalEdgeDistance(pixels, width, 0, 0, 1, 0, 4);
      expect(dist).toBeGreaterThan(100);
    });

    it('returns 999 when both edges are transparent', () => {
      const { pixels, width } = makePixels(2, 1, 4, () => [0, 0, 0, 0]);
      const dist = horizontalEdgeDistance(pixels, width, 0, 0, 1, 0, 4);
      expect(dist).toBe(999);
    });
  });

  describe('verticalEdgeDistance', () => {
    it('returns 0 for identical edge colors', () => {
      const { pixels, width } = makePixels(1, 2, 4, () => [50, 150, 50, 255]);
      const dist = verticalEdgeDistance(pixels, width, 0, 0, 0, 1, 4);
      expect(dist).toBe(0);
    });

    it('returns high distance for different colors', () => {
      const { pixels, width } = makePixels(1, 2, 4, (_col, row) =>
        row === 0 ? [0, 255, 0, 255] : [255, 0, 0, 255],
      );
      const dist = verticalEdgeDistance(pixels, width, 0, 0, 0, 1, 4);
      expect(dist).toBeGreaterThan(100);
    });
  });

  describe('buildAdjacencyGraph', () => {
    it('detects transparent tiles', () => {
      // 3x1 grid: [opaque, transparent, opaque]
      const { pixels, width } = makePixels(3, 1, 4, (col) =>
        col === 1 ? [0, 0, 0, 0] : [100, 100, 100, 255],
      );
      const { transparent, opaque } = buildAdjacencyGraph(pixels, width, 3, 1, 4, 30);
      expect(transparent.has(1)).toBe(true);
      expect(opaque.has(0)).toBe(true);
      expect(opaque.has(2)).toBe(true);
    });

    it('connects same-colored adjacent tiles', () => {
      const { pixels, width } = makePixels(3, 1, 4, () => [100, 100, 100, 255]);
      const { connections } = buildAdjacencyGraph(pixels, width, 3, 1, 4, 30);
      // tile 0 should connect to tile 1, tile 1 to tile 2
      expect(connections.get(0)?.has(1)).toBe(true);
      expect(connections.get(1)?.has(2)).toBe(true);
    });

    it('does not connect very different colored tiles', () => {
      const { pixels, width } = makePixels(2, 1, 4, (col) =>
        col === 0 ? [255, 0, 0, 255] : [0, 0, 255, 255],
      );
      const { connections } = buildAdjacencyGraph(pixels, width, 2, 1, 4, 30);
      // Should not be connected (distance > 30)
      const hasConnection = connections.has(0) && connections.get(0).has(1);
      expect(hasConnection).toBe(false);
    });
  });

  describe('buildGroups', () => {
    it('creates single group from connected tiles', () => {
      const connections = new Map();
      connections.set(0, new Set([1]));
      connections.set(1, new Set([0, 2]));
      connections.set(2, new Set([1]));
      const opaque = new Set([0, 1, 2]);

      const groups = buildGroups(connections, opaque, 3);
      expect(groups).toHaveLength(1);
      expect(groups[0].tiles).toEqual([0, 1, 2]);
      expect(groups[0].cols).toBe(3);
      expect(groups[0].rows).toBe(1);
    });

    it('creates separate groups for disconnected tiles', () => {
      const connections = new Map();
      const opaque = new Set([0, 2]); // tiles 0 and 2 in a 3-wide grid, no connection
      const groups = buildGroups(connections, opaque, 3);
      expect(groups).toHaveLength(2);
    });

    it('respects MAX_GROUP_DIM constraint', () => {
      const connections = new Map();
      const opaque = new Set();
      // Create a chain of 8 tiles in a row (exceeds default MAX_GROUP_DIM=6)
      for (let i = 0; i < 8; i++) {
        opaque.add(i);
        if (i > 0) {
          if (!connections.has(i)) connections.set(i, new Set());
          if (!connections.has(i - 1)) connections.set(i - 1, new Set());
          connections.get(i).add(i - 1);
          connections.get(i - 1).add(i);
        }
      }
      const groups = buildGroups(connections, opaque, 8);
      // Should split into multiple groups (none wider than 6)
      expect(groups.length).toBeGreaterThan(1);
      for (const g of groups) {
        expect(g.cols).toBeLessThanOrEqual(6);
      }
    });

    it('handles empty input', () => {
      const groups = buildGroups(new Map(), new Set(), 5);
      expect(groups).toHaveLength(0);
    });
  });

  describe('computeColorProfile', () => {
    it('returns correct HSL for pure red', () => {
      const { pixels, width } = makePixels(1, 1, 4, () => [255, 0, 0, 255]);
      const profile = computeColorProfile(pixels, [0], 1, 4, width);
      expect(profile.hue).toBeCloseTo(0, 0);
      expect(profile.sat).toBeGreaterThan(0.9);
      expect(profile.light).toBeCloseTo(0.5, 1);
    });

    it('returns correct HSL for pure green', () => {
      const { pixels, width } = makePixels(1, 1, 4, () => [0, 255, 0, 255]);
      const profile = computeColorProfile(pixels, [0], 1, 4, width);
      expect(profile.hue).toBeCloseTo(120, 0);
    });

    it('returns zero saturation for grey', () => {
      const { pixels, width } = makePixels(1, 1, 4, () => [128, 128, 128, 255]);
      const profile = computeColorProfile(pixels, [0], 1, 4, width);
      expect(profile.sat).toBeLessThan(0.01);
    });

    it('skips transparent pixels', () => {
      // Tile with half transparent, half red pixels
      const width = 4;
      const height = 4;
      const pixels = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (y < 2) {
            pixels[i] = 0; pixels[i + 1] = 0; pixels[i + 2] = 0; pixels[i + 3] = 0;
          } else {
            pixels[i] = 255; pixels[i + 1] = 0; pixels[i + 2] = 0; pixels[i + 3] = 255;
          }
        }
      }
      const profile = computeColorProfile(pixels, [0], 1, 4, width);
      // Should only see red pixels
      expect(profile.hue).toBeCloseTo(0, 0);
      expect(profile.sat).toBeGreaterThan(0.9);
    });
  });

  describe('classifyCategory', () => {
    it('classifies 1x1 as decoration', () => {
      expect(classifyCategory({ hue: 0, sat: 0, light: 0.5 }, 1, 1)).toBe('decoration');
    });

    it('classifies green saturated as nature', () => {
      expect(classifyCategory({ hue: 120, sat: 0.4, light: 0.4 }, 2, 2)).toBe('nature');
    });

    it('classifies grey as structure', () => {
      expect(classifyCategory({ hue: 200, sat: 0.05, light: 0.5 }, 3, 3)).toBe('structure');
    });

    it('classifies warm bright as lighting', () => {
      expect(classifyCategory({ hue: 40, sat: 0.5, light: 0.7 }, 1, 2)).toBe('lighting');
    });

    it('classifies brown small as furniture', () => {
      expect(classifyCategory({ hue: 30, sat: 0.3, light: 0.4 }, 2, 2)).toBe('furniture');
    });

    it('classifies wide thin as structure', () => {
      expect(classifyCategory({ hue: 180, sat: 0.2, light: 0.5 }, 5, 1)).toBe('structure');
    });

    it('defaults to decoration', () => {
      expect(classifyCategory({ hue: 270, sat: 0.6, light: 0.5 }, 2, 2)).toBe('decoration');
    });
  });
});
