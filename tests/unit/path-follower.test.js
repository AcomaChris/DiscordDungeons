import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Constants to control TILE_SIZE
vi.mock('../../client/src/core/Constants.js', () => ({
  TILE_SIZE: 16,
}));

const { PathFollower } = await import('../../client/src/ai/PathFollower.js');

describe('PathFollower', () => {
  let follower;

  beforeEach(() => {
    follower = new PathFollower(60);
  });

  it('starts not following', () => {
    expect(follower.isFollowing).toBe(false);
    expect(follower.progress).toBe(1);
  });

  it('returns arrived=true when not following', () => {
    const result = follower.update(50, 50);
    expect(result.arrived).toBe(true);
    expect(result.vx).toBe(0);
    expect(result.vy).toBe(0);
  });

  it('starts following after startPath', () => {
    follower.startPath([{ tx: 3, ty: 2 }]);
    expect(follower.isFollowing).toBe(true);
    expect(follower.progress).toBe(0);
  });

  it('steers toward first waypoint', () => {
    // Waypoint at tile (3, 2) → center = (3*16+8, 2*16+8) = (56, 40)
    follower.startPath([{ tx: 3, ty: 2 }]);
    const result = follower.update(8, 40); // same y, needs to go right
    expect(result.arrived).toBe(false);
    expect(result.vx).toBeGreaterThan(0);
    expect(Math.abs(result.vy)).toBeLessThan(0.01);
    expect(result.facing).toBe('right');
  });

  it('determines facing from dominant axis', () => {
    // More vertical than horizontal → should face down
    follower.startPath([{ tx: 1, ty: 5 }]); // center = (24, 88)
    const result = follower.update(24, 8); // mostly need to go down
    expect(result.facing).toBe('down');
  });

  it('faces up when moving north', () => {
    follower.startPath([{ tx: 1, ty: 0 }]); // center = (24, 8)
    const result = follower.update(24, 80); // need to go up
    expect(result.facing).toBe('up');
  });

  it('faces left when moving west', () => {
    follower.startPath([{ tx: 0, ty: 1 }]); // center = (8, 24)
    const result = follower.update(80, 24); // need to go left
    expect(result.facing).toBe('left');
  });

  it('arrives when close to final waypoint', () => {
    follower.startPath([{ tx: 3, ty: 2 }]); // center = (56, 40)
    const result = follower.update(56, 40); // already at center
    expect(result.arrived).toBe(true);
    expect(follower.isFollowing).toBe(false);
  });

  it('advances through multi-waypoint path', () => {
    follower.startPath([
      { tx: 1, ty: 0 },  // center = (24, 8)
      { tx: 2, ty: 0 },  // center = (40, 8)
      { tx: 3, ty: 0 },  // center = (56, 8)
    ]);

    // Arrive at first waypoint
    let result = follower.update(24, 8);
    // Should advance past first waypoint and steer toward second
    expect(follower.isFollowing).toBe(true);
    expect(follower.progress).toBeGreaterThan(0);

    // Arrive at second
    result = follower.update(40, 8);
    expect(follower.isFollowing).toBe(true);

    // Arrive at third (final)
    result = follower.update(56, 8);
    expect(result.arrived).toBe(true);
    expect(follower.isFollowing).toBe(false);
  });

  it('cancel stops following', () => {
    follower.startPath([{ tx: 3, ty: 2 }]);
    expect(follower.isFollowing).toBe(true);
    follower.cancel();
    expect(follower.isFollowing).toBe(false);
  });

  it('startPath with empty array does not follow', () => {
    follower.startPath([]);
    expect(follower.isFollowing).toBe(false);
  });

  it('startPath with null does not follow', () => {
    follower.startPath(null);
    expect(follower.isFollowing).toBe(false);
  });

  it('velocity magnitude equals speed', () => {
    follower.startPath([{ tx: 5, ty: 5 }]); // center = (88, 88)
    const result = follower.update(8, 8); // far away, diagonal-ish
    const mag = Math.sqrt(result.vx ** 2 + result.vy ** 2);
    expect(mag).toBeCloseTo(60, 1);
  });
});
