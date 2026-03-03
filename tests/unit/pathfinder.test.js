import { describe, it, expect } from 'vitest';
import { findPath } from '../../client/src/ai/Pathfinder.js';

// --- Pathfinder A* Tests ---
// Tests grid-based A* search with 4-directional movement.
// Grid: false = walkable, true = blocked.

function makeGrid(rows) {
  // Convert string grid to boolean grid: '.' = walkable, '#' = blocked
  return rows.map(row => [...row].map(c => c === '#'));
}

describe('findPath', () => {
  it('finds a straight horizontal path', () => {
    const grid = makeGrid([
      '.....',
      '.....',
      '.....',
    ]);
    const path = findPath(grid, { tx: 0, ty: 1 }, { tx: 4, ty: 1 });
    expect(path).not.toBeNull();
    expect(path.length).toBe(4);
    expect(path[path.length - 1]).toEqual({ tx: 4, ty: 1 });
  });

  it('finds a straight vertical path', () => {
    const grid = makeGrid([
      '...',
      '...',
      '...',
      '...',
    ]);
    const path = findPath(grid, { tx: 1, ty: 0 }, { tx: 1, ty: 3 });
    expect(path).not.toBeNull();
    expect(path.length).toBe(3);
    expect(path[path.length - 1]).toEqual({ tx: 1, ty: 3 });
  });

  it('navigates around an obstacle', () => {
    const grid = makeGrid([
      '.....',
      '..#..',
      '..#..',
      '.....',
    ]);
    const path = findPath(grid, { tx: 1, ty: 1 }, { tx: 3, ty: 1 });
    expect(path).not.toBeNull();
    // Must go around — path should be longer than 2 steps
    expect(path.length).toBeGreaterThan(2);
    expect(path[path.length - 1]).toEqual({ tx: 3, ty: 1 });
    // Verify no step lands on a blocked tile
    for (const step of path) {
      expect(grid[step.ty][step.tx]).toBe(false);
    }
  });

  it('returns null when no path exists', () => {
    const grid = makeGrid([
      '..#..',
      '..#..',
      '..#..',
    ]);
    const path = findPath(grid, { tx: 0, ty: 1 }, { tx: 4, ty: 1 });
    expect(path).toBeNull();
  });

  it('returns empty array when start equals end', () => {
    const grid = makeGrid([
      '...',
      '...',
    ]);
    const path = findPath(grid, { tx: 1, ty: 0 }, { tx: 1, ty: 0 });
    expect(path).toEqual([]);
  });

  it('returns null when end tile is blocked', () => {
    const grid = makeGrid([
      '..#',
      '...',
    ]);
    const path = findPath(grid, { tx: 0, ty: 0 }, { tx: 2, ty: 0 });
    expect(path).toBeNull();
  });

  it('returns null when start is out of bounds', () => {
    const grid = makeGrid(['...']);
    expect(findPath(grid, { tx: -1, ty: 0 }, { tx: 2, ty: 0 })).toBeNull();
  });

  it('returns null when end is out of bounds', () => {
    const grid = makeGrid(['...']);
    expect(findPath(grid, { tx: 0, ty: 0 }, { tx: 5, ty: 0 })).toBeNull();
  });

  it('finds path through a maze', () => {
    const grid = makeGrid([
      '..#..',
      '.##..',
      '...#.',
      '.#...',
      '.....',
    ]);
    const path = findPath(grid, { tx: 0, ty: 0 }, { tx: 4, ty: 4 });
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual({ tx: 4, ty: 4 });
    // Verify path is valid (all walkable, each step is 4-directional)
    let prev = { tx: 0, ty: 0 };
    for (const step of path) {
      expect(grid[step.ty][step.tx]).toBe(false);
      const d = Math.abs(step.tx - prev.tx) + Math.abs(step.ty - prev.ty);
      expect(d).toBe(1); // 4-directional, one step at a time
      prev = step;
    }
  });

  it('does not include start tile in path', () => {
    const grid = makeGrid([
      '...',
      '...',
    ]);
    const path = findPath(grid, { tx: 0, ty: 0 }, { tx: 2, ty: 0 });
    expect(path).not.toBeNull();
    expect(path[0]).not.toEqual({ tx: 0, ty: 0 });
  });

  it('handles single-cell grid', () => {
    const grid = makeGrid(['.']);
    const path = findPath(grid, { tx: 0, ty: 0 }, { tx: 0, ty: 0 });
    expect(path).toEqual([]);
  });

  it('returns null for empty grid', () => {
    const path = findPath([], { tx: 0, ty: 0 }, { tx: 0, ty: 0 });
    expect(path).toBeNull();
  });
});
