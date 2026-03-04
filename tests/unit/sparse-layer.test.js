import { describe, it, expect } from 'vitest';
import { SparseLayer } from '../../client/src/map-editor/SparseLayer.js';

describe('SparseLayer', () => {
  it('get returns 0 for empty tiles', () => {
    const layer = new SparseLayer('Ground');
    expect(layer.get(0, 0)).toBe(0);
    expect(layer.get(100, -50)).toBe(0);
  });

  it('set and get a tile', () => {
    const layer = new SparseLayer('Ground');
    layer.set(5, 3, 42);
    expect(layer.get(5, 3)).toBe(42);
  });

  it('set to 0 deletes the tile', () => {
    const layer = new SparseLayer('Ground');
    layer.set(5, 3, 42);
    layer.set(5, 3, 0);
    expect(layer.get(5, 3)).toBe(0);
    expect(layer.has(5, 3)).toBe(false);
  });

  it('delete removes a tile', () => {
    const layer = new SparseLayer('Ground');
    layer.set(1, 1, 10);
    layer.delete(1, 1);
    expect(layer.get(1, 1)).toBe(0);
  });

  it('has checks existence', () => {
    const layer = new SparseLayer('Ground');
    expect(layer.has(0, 0)).toBe(false);
    layer.set(0, 0, 5);
    expect(layer.has(0, 0)).toBe(true);
  });

  it('size tracks tile count', () => {
    const layer = new SparseLayer('Ground');
    expect(layer.size).toBe(0);
    layer.set(0, 0, 1);
    layer.set(1, 1, 2);
    expect(layer.size).toBe(2);
    layer.set(0, 0, 0);
    expect(layer.size).toBe(1);
  });

  it('clear removes all tiles', () => {
    const layer = new SparseLayer('Ground');
    layer.set(0, 0, 1);
    layer.set(1, 1, 2);
    layer.clear();
    expect(layer.size).toBe(0);
  });

  describe('getBounds', () => {
    it('returns null for empty layer', () => {
      const layer = new SparseLayer('Ground');
      expect(layer.getBounds()).toBeNull();
    });

    it('returns correct bounds for single tile', () => {
      const layer = new SparseLayer('Ground');
      layer.set(5, 3, 1);
      expect(layer.getBounds()).toEqual({ minX: 5, minY: 3, maxX: 5, maxY: 3 });
    });

    it('returns correct bounds for multiple tiles', () => {
      const layer = new SparseLayer('Ground');
      layer.set(-2, -1, 1);
      layer.set(5, 3, 2);
      layer.set(0, 0, 3);
      expect(layer.getBounds()).toEqual({ minX: -2, minY: -1, maxX: 5, maxY: 3 });
    });

    it('handles negative coordinates', () => {
      const layer = new SparseLayer('Ground');
      layer.set(-10, -20, 1);
      layer.set(-5, -3, 2);
      expect(layer.getBounds()).toEqual({ minX: -10, minY: -20, maxX: -5, maxY: -3 });
    });
  });

  describe('forEach', () => {
    it('iterates all tiles', () => {
      const layer = new SparseLayer('Ground');
      layer.set(0, 0, 10);
      layer.set(3, 4, 20);
      const results = [];
      layer.forEach((x, y, gid) => results.push({ x, y, gid }));
      expect(results).toHaveLength(2);
      expect(results).toContainEqual({ x: 0, y: 0, gid: 10 });
      expect(results).toContainEqual({ x: 3, y: 4, gid: 20 });
    });
  });

  describe('toDenseArray', () => {
    it('creates dense array with correct values', () => {
      const layer = new SparseLayer('Ground');
      layer.set(1, 0, 5);
      layer.set(2, 1, 10);
      // 3 wide × 2 tall starting at (0,0)
      const arr = layer.toDenseArray(0, 0, 3, 2);
      expect(arr).toEqual([0, 5, 0, 0, 0, 10]);
    });

    it('handles offset origin', () => {
      const layer = new SparseLayer('Ground');
      layer.set(-1, -1, 7);
      // 2×2 starting at (-2, -2)
      const arr = layer.toDenseArray(-2, -2, 2, 2);
      expect(arr).toEqual([0, 0, 0, 7]);
    });
  });
});
