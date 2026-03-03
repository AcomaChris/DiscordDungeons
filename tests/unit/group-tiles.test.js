import { describe, it, expect } from 'vitest';
import {
  buildGroups,
  MAX_GROUP_DIM,
  MIN_FILL_RATE,
} from '../../scripts/tile-analyzer/groupTiles.js';

// --- Group Tiles Unit Tests ---
// Tests the P1 fix: BFS grouping respects MAX_GROUP_DIM and MIN_FILL_RATE
// constraints, preventing oversized or sparse groups.

// Helper: build a connections map from a list of [a, b] edges
function makeConnections(edges) {
  const map = new Map();
  for (const [a, b] of edges) {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a).add(b);
    map.get(b).add(a);
  }
  return map;
}

describe('buildGroups', () => {
  it('exports expected constants', () => {
    expect(MAX_GROUP_DIM).toBe(6);
    expect(MIN_FILL_RATE).toBe(0.6);
  });

  it('groups a single isolated tile', () => {
    const opaque = new Set([0]);
    const connections = new Map();
    const groups = buildGroups(connections, opaque, 4);

    expect(groups).toHaveLength(1);
    expect(groups[0].tiles).toEqual([0]);
    expect(groups[0].cols).toBe(1);
    expect(groups[0].rows).toBe(1);
  });

  it('groups two connected horizontal tiles', () => {
    // Grid: 4 cols, tiles 0 and 1 are connected
    const opaque = new Set([0, 1]);
    const connections = makeConnections([[0, 1]]);
    const groups = buildGroups(connections, opaque, 4);

    expect(groups).toHaveLength(1);
    expect(groups[0].tiles).toEqual([0, 1]);
    expect(groups[0].cols).toBe(2);
    expect(groups[0].rows).toBe(1);
  });

  it('keeps disconnected tiles in separate groups', () => {
    // Grid: 4 cols, tiles 0 and 3 are not connected
    const opaque = new Set([0, 3]);
    const connections = new Map();
    const groups = buildGroups(connections, opaque, 4);

    expect(groups).toHaveLength(2);
    expect(groups[0].tiles).toEqual([0]);
    expect(groups[1].tiles).toEqual([3]);
  });

  it('groups a 2x2 block', () => {
    // Grid: 3 cols
    // [0, 1, .]
    // [3, 4, .]
    const opaque = new Set([0, 1, 3, 4]);
    const connections = makeConnections([
      [0, 1], [0, 3], [1, 4], [3, 4],
    ]);
    const groups = buildGroups(connections, opaque, 3);

    expect(groups).toHaveLength(1);
    expect(groups[0].tiles).toEqual([0, 1, 3, 4]);
    expect(groups[0].cols).toBe(2);
    expect(groups[0].rows).toBe(2);
  });

  it('enforces MAX_GROUP_DIM — splits a long horizontal chain', () => {
    // Grid: 10 cols, 1 row — a chain of 8 connected tiles (exceeds MAX_GROUP_DIM=6)
    const tiles = [0, 1, 2, 3, 4, 5, 6, 7];
    const opaque = new Set(tiles);
    const edges = [];
    for (let i = 0; i < tiles.length - 1; i++) {
      edges.push([tiles[i], tiles[i + 1]]);
    }
    const connections = makeConnections(edges);
    const groups = buildGroups(connections, opaque, 10);

    // Should split into multiple groups, none wider than MAX_GROUP_DIM
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) {
      expect(g.cols).toBeLessThanOrEqual(MAX_GROUP_DIM);
      expect(g.rows).toBeLessThanOrEqual(MAX_GROUP_DIM);
    }
    // All tiles should still be accounted for
    const allTiles = groups.flatMap(g => g.tiles).sort((a, b) => a - b);
    expect(allTiles).toEqual(tiles);
  });

  it('enforces MAX_GROUP_DIM — splits a long vertical chain', () => {
    // Grid: 1 col, 8 rows — a chain of 8 connected tiles
    const cols = 1;
    const tiles = [0, 1, 2, 3, 4, 5, 6, 7]; // indices 0-7 in a 1-col grid
    const opaque = new Set(tiles);
    const edges = [];
    for (let i = 0; i < tiles.length - 1; i++) {
      edges.push([tiles[i], tiles[i + 1]]);
    }
    const connections = makeConnections(edges);
    const groups = buildGroups(connections, opaque, cols);

    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) {
      expect(g.rows).toBeLessThanOrEqual(MAX_GROUP_DIM);
    }
    const allTiles = groups.flatMap(g => g.tiles).sort((a, b) => a - b);
    expect(allTiles).toEqual(tiles);
  });

  it('enforces MIN_FILL_RATE — rejects sparse diagonal expansion', () => {
    // Grid: 10 cols
    // Diagonal tiles: (0,0), (1,1), (2,2) — connected but sparse (fill < 0.6)
    // Tile indices: 0, 11, 22
    const cols = 10;
    const opaque = new Set([0, 11, 22]);
    const connections = makeConnections([[0, 11], [11, 22]]);
    const groups = buildGroups(connections, opaque, cols);

    // 3 tiles in a 3x3 box = 33% fill (< 60%), so they shouldn't all merge
    // At minimum, tile 22 should be rejected (adding it to {0,11} makes a 3x3 box with 3/9 = 33%)
    expect(groups.length).toBeGreaterThan(1);
  });

  it('allows dense groups up to MAX_GROUP_DIM', () => {
    // Grid: 6 cols, 1 row — 6 connected tiles (exactly MAX_GROUP_DIM)
    const cols = 6;
    const tiles = [0, 1, 2, 3, 4, 5];
    const opaque = new Set(tiles);
    const edges = [];
    for (let i = 0; i < 5; i++) {
      edges.push([tiles[i], tiles[i + 1]]);
    }
    const connections = makeConnections(edges);
    const groups = buildGroups(connections, opaque, cols);

    // Should form a single group — 6 tiles in 6x1 box = 100% fill
    expect(groups).toHaveLength(1);
    expect(groups[0].tiles).toEqual(tiles);
    expect(groups[0].cols).toBe(6);
  });

  it('respects custom opts overrides', () => {
    // 4 connected tiles in a line, with maxGroupDim=2
    const cols = 10;
    const opaque = new Set([0, 1, 2, 3]);
    const connections = makeConnections([[0, 1], [1, 2], [2, 3]]);
    const groups = buildGroups(connections, opaque, cols, { maxGroupDim: 2 });

    expect(groups.length).toBe(2);
    for (const g of groups) {
      expect(g.cols).toBeLessThanOrEqual(2);
    }
  });

  it('assigns sequential IDs starting from 0', () => {
    const opaque = new Set([0, 5, 10]);
    const connections = new Map();
    const groups = buildGroups(connections, opaque, 10);

    expect(groups.map(g => g.id)).toEqual([0, 1, 2]);
  });

  it('produces deterministic results (row-major order)', () => {
    // Run twice with the same input
    const opaque = new Set([3, 1, 7, 5]);
    const connections = new Map();
    const groups1 = buildGroups(connections, opaque, 10);
    const groups2 = buildGroups(connections, opaque, 10);

    expect(groups1).toEqual(groups2);
    // First group should be tile 1 (lowest index)
    expect(groups1[0].tiles).toEqual([1]);
  });
});
