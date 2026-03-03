import { describe, it, expect, beforeAll } from 'vitest';

// --- ObjectPlacer Unit Tests ---

let ObjectPlacer;

beforeAll(async () => {
  const mod = await import('../../scripts/lib/ObjectPlacer.js');
  ObjectPlacer = mod.ObjectPlacer;
});

// --- Test fixtures ---

function makeDefsMap() {
  return {
    TestTiles: {
      objects: {
        small_table: {
          id: 'small_table',
          grid: { cols: 2, rows: 2, tiles: [[0, 1], [10, 11]] },
          colliders: [
            { id: 'body', shape: 'rect', x: 0, y: 0, width: 32, height: 32, elevation: 0, type: 'solid' },
          ],
          nodes: [],
        },
        counter: {
          id: 'counter',
          grid: { cols: 3, rows: 1, tiles: [[5, 6, 7]] },
          parts: {
            layout: [['left_end', 'middle', 'right_end']],
            roles: {
              left_end: { required: true },
              middle: { required: false, repeatable: true, minRepeat: 0, maxRepeat: 5 },
              right_end: { required: true },
            },
          },
          colliders: [
            { id: 'body', shape: 'rect', x: 0, y: 0, width: 48, height: 16, elevation: 0, type: 'solid' },
          ],
          nodes: [],
        },
        decoration: {
          id: 'decoration',
          grid: { cols: 1, rows: 1, tiles: [[20]] },
          colliders: [],
          nodes: [],
        },
        platform_table: {
          id: 'platform_table',
          grid: { cols: 2, rows: 1, tiles: [[30, 31]] },
          colliders: [
            { id: 'surface', shape: 'rect', x: 0, y: 0, width: 32, height: 16, elevation: 1, type: 'platform' },
          ],
          nodes: [],
        },
      },
    },
  };
}

function makeTilesetConfigs() {
  return [{ name: 'TestTiles', firstgid: 100, columns: 20 }];
}

describe('ObjectPlacer', () => {
  // --- Constructor ---
  describe('constructor', () => {
    it('indexes objects from all tilesets', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      // Should not throw when placing known objects
      expect(() => placer.place('small_table', 0, 0)).not.toThrow();
    });

    it('throws on unknown object', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      expect(() => placer.place('nonexistent', 0, 0)).toThrow('Unknown object');
    });
  });

  // --- Basic placement ---
  describe('place', () => {
    it('returns correct GIDs for a 2x2 object', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const result = placer.place('small_table', 3, 5);

      expect(result.wallTiles).toHaveLength(4);
      // Local tiles [0,1,10,11] + firstgid 100 = GIDs [100,101,110,111]
      expect(result.wallTiles).toEqual([
        { x: 3, y: 5, gid: 100 },
        { x: 4, y: 5, gid: 101 },
        { x: 3, y: 6, gid: 110 },
        { x: 4, y: 6, gid: 111 },
      ]);
    });

    it('returns collision tiles for solid objects', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const result = placer.place('small_table', 3, 5);

      // 32x32 collider at elevation 0 = 2x2 tiles
      expect(result.collisionTiles).toHaveLength(4);
      expect(result.collisionTiles).toContainEqual({ x: 3, y: 5 });
      expect(result.collisionTiles).toContainEqual({ x: 4, y: 5 });
      expect(result.collisionTiles).toContainEqual({ x: 3, y: 6 });
      expect(result.collisionTiles).toContainEqual({ x: 4, y: 6 });
    });

    it('returns no collision for decoration objects', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const result = placer.place('decoration', 2, 2);

      expect(result.wallTiles).toHaveLength(1);
      expect(result.wallTiles[0]).toEqual({ x: 2, y: 2, gid: 120 });
      expect(result.collisionTiles).toHaveLength(0);
    });

    it('skips elevation > 0 colliders for collision tiles', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const result = placer.place('platform_table', 1, 1);

      // Platform collider at elevation 1 should not generate ground collision
      expect(result.collisionTiles).toHaveLength(0);
    });
  });

  // --- applyTo ---
  describe('applyTo', () => {
    it('writes GIDs and collision into flat arrays', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const mapW = 10;
      const walls = new Array(mapW * 10).fill(0);
      const collision = new Array(mapW * 10).fill(0);

      placer.place('small_table', 2, 3).applyTo(walls, collision, mapW);

      // Check wall GIDs at correct positions
      expect(walls[3 * mapW + 2]).toBe(100); // (2,3) = local tile 0 + 100
      expect(walls[3 * mapW + 3]).toBe(101); // (3,3) = local tile 1 + 100
      expect(walls[4 * mapW + 2]).toBe(110); // (2,4) = local tile 10 + 100
      expect(walls[4 * mapW + 3]).toBe(111); // (3,4) = local tile 11 + 100

      // Check collision
      expect(collision[3 * mapW + 2]).toBe(1);
      expect(collision[3 * mapW + 3]).toBe(1);
      expect(collision[4 * mapW + 2]).toBe(1);
      expect(collision[4 * mapW + 3]).toBe(1);

      // Other positions should be 0
      expect(walls[0]).toBe(0);
      expect(collision[0]).toBe(0);
    });
  });

  // --- Stretch ---
  describe('stretch', () => {
    it('stretches a counter with 0 repeats (just ends)', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const result = placer.place('counter', 0, 0, { stretch: 0 });

      // 0 repeats = left_end + right_end = 2 tiles
      expect(result.wallTiles).toHaveLength(2);
      expect(result.wallTiles[0]).toEqual({ x: 0, y: 0, gid: 105 }); // tile 5
      expect(result.wallTiles[1]).toEqual({ x: 1, y: 0, gid: 107 }); // tile 7
    });

    it('stretches a counter with 1 repeat (natural size)', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const result = placer.place('counter', 0, 0, { stretch: 1 });

      // 1 repeat = left_end + 1×middle + right_end = 3 tiles (same as original)
      expect(result.wallTiles).toHaveLength(3);
      expect(result.wallTiles[0]).toEqual({ x: 0, y: 0, gid: 105 }); // tile 5
      expect(result.wallTiles[1]).toEqual({ x: 1, y: 0, gid: 106 }); // tile 6
      expect(result.wallTiles[2]).toEqual({ x: 2, y: 0, gid: 107 }); // tile 7
    });

    it('stretches a counter with 3 repeats', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      const result = placer.place('counter', 0, 0, { stretch: 3 });

      // 3 repeats = left + mid + mid + mid + right = 5 tiles
      expect(result.wallTiles).toHaveLength(5);
      expect(result.wallTiles.map(t => t.gid)).toEqual([105, 106, 106, 106, 107]);
    });

    it('throws when stretching an object without parts', () => {
      const placer = new ObjectPlacer(makeDefsMap(), makeTilesetConfigs());
      expect(() => placer.place('small_table', 0, 0, { stretch: 2 })).toThrow('no parts');
    });
  });
});
