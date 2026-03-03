import { describe, it, expect } from 'vitest';
import {
  computeTileBounds,
  decomposeToRowRuns,
} from '../../scripts/bootstrap-object-defs.js';

// --- Collider Generation Unit Tests ---
// Tests the P0 fix: colliders are computed from actual non-null tiles,
// not from the full bounding box.

// --- computeTileBounds ---

describe('computeTileBounds', () => {
  it('returns null for an all-null grid', () => {
    const grid = [
      [null, null],
      [null, null],
    ];
    expect(computeTileBounds(grid)).toBeNull();
  });

  it('returns bounds for a fully filled grid', () => {
    const grid = [
      [1, 2],
      [3, 4],
    ];
    expect(computeTileBounds(grid)).toEqual({
      minCol: 0, maxCol: 1,
      minRow: 0, maxRow: 1,
    });
  });

  it('computes tight bounds for sparse grid with top-left gap', () => {
    // Only bottom-right tile is filled
    const grid = [
      [null, null, null],
      [null, null, null],
      [null, null, 99],
    ];
    expect(computeTileBounds(grid)).toEqual({
      minCol: 2, maxCol: 2,
      minRow: 2, maxRow: 2,
    });
  });

  it('computes tight bounds with gaps in the middle', () => {
    // L-shaped fill: top-left and bottom-right only
    const grid = [
      [1,    null, null],
      [null, null, null],
      [null, null, 2],
    ];
    expect(computeTileBounds(grid)).toEqual({
      minCol: 0, maxCol: 2,
      minRow: 0, maxRow: 2,
    });
  });

  it('computes bounds for a single tile', () => {
    const grid = [[42]];
    expect(computeTileBounds(grid)).toEqual({
      minCol: 0, maxCol: 0,
      minRow: 0, maxRow: 0,
    });
  });

  it('ignores null columns on the left', () => {
    const grid = [
      [null, 1, 2],
      [null, 3, 4],
    ];
    expect(computeTileBounds(grid)).toEqual({
      minCol: 1, maxCol: 2,
      minRow: 0, maxRow: 1,
    });
  });

  it('ignores null rows on the top', () => {
    const grid = [
      [null, null],
      [5, 6],
    ];
    expect(computeTileBounds(grid)).toEqual({
      minCol: 0, maxCol: 1,
      minRow: 1, maxRow: 1,
    });
  });
});

// --- decomposeToRowRuns ---

describe('decomposeToRowRuns', () => {
  it('returns empty array for all-null grid', () => {
    const grid = [
      [null, null],
      [null, null],
    ];
    expect(decomposeToRowRuns(grid)).toEqual([]);
  });

  it('returns a single run for a fully filled row', () => {
    const grid = [[1, 2, 3]];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 0, row: 0, span: 3 },
    ]);
  });

  it('splits a row with a gap into two runs', () => {
    const grid = [[1, null, 3]];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 0, row: 0, span: 1 },
      { col: 2, row: 0, span: 1 },
    ]);
  });

  it('handles multiple rows with different patterns', () => {
    const grid = [
      [1, 2, null],
      [null, 3, 4],
    ];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 0, row: 0, span: 2 },
      { col: 1, row: 1, span: 2 },
    ]);
  });

  it('handles isolated single tiles', () => {
    const grid = [
      [null, 1, null],
      [null, null, null],
      [null, null, 2],
    ];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 1, row: 0, span: 1 },
      { col: 2, row: 2, span: 1 },
    ]);
  });

  it('handles a fully filled grid as one run per row', () => {
    const grid = [
      [1, 2],
      [3, 4],
    ];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 0, row: 0, span: 2 },
      { col: 0, row: 1, span: 2 },
    ]);
  });

  it('handles leading nulls in a row', () => {
    const grid = [[null, null, 7, 8]];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 2, row: 0, span: 2 },
    ]);
  });

  it('handles trailing nulls in a row', () => {
    const grid = [[7, 8, null, null]];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 0, row: 0, span: 2 },
    ]);
  });

  it('handles alternating filled and null tiles', () => {
    const grid = [[1, null, 2, null, 3]];
    expect(decomposeToRowRuns(grid)).toEqual([
      { col: 0, row: 0, span: 1 },
      { col: 2, row: 0, span: 1 },
      { col: 4, row: 0, span: 1 },
    ]);
  });
});
