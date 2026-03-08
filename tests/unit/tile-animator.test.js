import { describe, it, expect, beforeAll } from 'vitest';

// --- TileAnimator Unit Tests ---
// Tests animation extraction, GID conversion, frame advancement,
// tile index swapping, and cleanup.

let TileAnimator;

beforeAll(async () => {
  const mod = await import('../../client/src/map/TileAnimator.js');
  TileAnimator = mod.TileAnimator;
});

function createMockTilemap(tileData = {}, firstgid = 1) {
  return {
    tilesets: [{ firstgid, tileData }],
  };
}

function makeTile(index) {
  return { index };
}

function createMockLayer(tileGrid) {
  return { layer: { data: tileGrid } };
}

describe('TileAnimator', () => {
  it('extracts animation definitions with correct GID conversion', () => {
    const animator = new TileAnimator();
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 200 },
          { tileid: 5, duration: 300 },
          { tileid: 6, duration: 200 },
        ],
      },
    }, 1);

    animator._extractAnimations(tilemap);

    expect(animator.animationCount).toBe(1);
    const anim = animator._animations.get(1); // GID = 0 + 1
    expect(anim.frames).toHaveLength(3);
    expect(anim.frames[0]).toEqual({ gid: 1, duration: 200 });
    expect(anim.frames[1]).toEqual({ gid: 6, duration: 300 });
    expect(anim.frames[2]).toEqual({ gid: 7, duration: 200 });
    expect(anim.totalDuration).toBe(700);
    expect(anim.firstgid).toBe(1);
  });

  it('builds tile location index from layers', () => {
    const animator = new TileAnimator();
    // Stub an animation so the index builder recognizes GID 1
    animator._animations.set(1, {});

    const tile1 = makeTile(1);
    const tile2 = makeTile(2);
    const layers = {
      Ground: createMockLayer([[tile1, tile2]]),
    };

    animator._buildTileIndex(layers);

    const locs = animator._tileLocations.get(1);
    expect(locs).toBeDefined();
    expect(locs.tiles).toHaveLength(1);
    expect(locs.tiles[0]).toEqual({ layer: layers.Ground, row: 0, col: 0 });
  });

  it('ignores non-animatable layers', () => {
    const animator = new TileAnimator();
    animator._animations.set(1, {});

    const layers = {
      Walls: createMockLayer([[makeTile(1)]]),
    };

    animator._buildTileIndex(layers);

    // Walls is not in ANIMATABLE_LAYERS, so no locations should be found
    expect(animator._tileLocations.has(1)).toBe(false);
  });

  it('advances frame on update and swaps tile index', () => {
    const animator = new TileAnimator();
    const tile = makeTile(1);
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 100 },
          { tileid: 5, duration: 100 },
        ],
      },
    }, 1);

    animator.init(tilemap, { Ground: createMockLayer([[tile]]) }, []);

    expect(tile.index).toBe(1); // frame 0: GID 1

    animator.update(150); // 150ms in, should be on frame 1
    expect(tile.index).toBe(6); // frame 1: tileid 5 + firstgid 1

    animator.update(100); // 250ms total, wraps: 250 % 200 = 50ms, frame 0
    expect(tile.index).toBe(1);
  });

  it('handles variable-duration frames', () => {
    const animator = new TileAnimator();
    const tile = makeTile(1);
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 50 },
          { tileid: 1, duration: 200 },
          { tileid: 2, duration: 50 },
        ],
      },
    }, 1);

    animator.init(tilemap, { Ground: createMockLayer([[tile]]) }, []);

    // At 40ms: still in frame 0 (duration 50)
    animator.update(40);
    expect(tile.index).toBe(1);

    // At 60ms: in frame 1 (accumulated 50, next boundary at 250)
    animator.update(20);
    expect(tile.index).toBe(2); // tileid 1 + firstgid 1

    // At 260ms: in frame 2 (accumulated 250, next boundary at 300)
    animator.update(200);
    expect(tile.index).toBe(3); // tileid 2 + firstgid 1
  });

  it('wraps elapsed time to prevent unbounded growth', () => {
    const animator = new TileAnimator();
    const tile = makeTile(1);
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 100 },
          { tileid: 1, duration: 100 },
        ],
      },
    }, 1);

    animator.init(tilemap, { Ground: createMockLayer([[tile]]) }, []);

    animator.update(10000); // Way past total duration
    const anim = animator._animations.get(1);
    expect(anim.elapsed).toBeLessThan(anim.totalDuration);
  });

  it('handles multiple tilesets with different firstgids', () => {
    const animator = new TileAnimator();
    const tilemap = {
      tilesets: [
        { firstgid: 1, tileData: {} },
        {
          firstgid: 100,
          tileData: {
            5: {
              animation: [
                { tileid: 5, duration: 200 },
                { tileid: 10, duration: 200 },
              ],
            },
          },
        },
      ],
    };

    animator._extractAnimations(tilemap);

    expect(animator._animations.has(105)).toBe(true); // 5 + 100
    const anim = animator._animations.get(105);
    expect(anim.frames[0].gid).toBe(105);
    expect(anim.frames[1].gid).toBe(110);
    expect(anim.firstgid).toBe(100);
  });

  it('handles no animations gracefully', () => {
    const animator = new TileAnimator();
    animator.init({ tilesets: [] }, {}, []);
    expect(animator.animationCount).toBe(0);
    // Should not throw
    animator.update(100);
  });

  it('handles tileset with no tileData', () => {
    const animator = new TileAnimator();
    animator.init({ tilesets: [{ firstgid: 1 }] }, {}, []);
    expect(animator.animationCount).toBe(0);
  });

  it('skips tileData entries without animation', () => {
    const animator = new TileAnimator();
    const tilemap = createMockTilemap({
      0: { properties: { foo: 'bar' } }, // no animation key
      1: { animation: [{ tileid: 1, duration: 100 }] },
    }, 1);

    animator._extractAnimations(tilemap);

    expect(animator.animationCount).toBe(1);
    expect(animator._animations.has(2)).toBe(true); // only tile 1 + firstgid 1
  });

  it('cleans up on destroy', () => {
    const animator = new TileAnimator();
    animator._animations.set(1, {});
    animator._tileLocations.set(1, { tiles: [], sprites: [] });

    animator.destroy();

    expect(animator.animationCount).toBe(0);
    expect(animator._tileLocations.size).toBe(0);
  });

  // --- Mobile Safari resilience ---
  // On Mobile Safari, sprites can have null glTexture (failed WebGL upload)
  // or be destroyed mid-frame. The update loop must not crash.

  it('skips destroyed sprites during animation update', () => {
    const animator = new TileAnimator();
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 100 },
          { tileid: 5, duration: 100 },
        ],
      },
    }, 1);

    const mockSprite = {
      active: true,
      frame: { name: 0 },
      _tileFirstgid: 1,
      texture: { has: () => true },
      setFrame: function(f) { this.frame.name = f; },
    };

    animator.init(tilemap, { Ground: createMockLayer([[makeTile(1)]]) }, []);
    // Manually register the sprite (normally done by _buildSpriteIndex)
    animator._tileLocations.get(1).sprites.push(mockSprite);

    // Destroy the sprite before animation fires
    mockSprite.active = false;

    // Should not throw
    animator.update(150);
    expect(mockSprite.frame.name).toBe(0); // unchanged — skipped
  });

  it('skips sprites when target frame does not exist in texture', () => {
    const animator = new TileAnimator();
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 100 },
          { tileid: 5, duration: 100 },
        ],
      },
    }, 1);

    const mockSprite = {
      active: true,
      frame: { name: 0 },
      _tileFirstgid: 1,
      texture: { has: (frame) => frame === 0 }, // only frame 0 exists
      setFrame: function(f) { this.frame.name = f; },
    };

    animator.init(tilemap, { Ground: createMockLayer([[makeTile(1)]]) }, []);
    animator._tileLocations.get(1).sprites.push(mockSprite);

    // Frame 1 maps to localFrame 5 (GID 6 - firstgid 1), which doesn't exist
    animator.update(150);
    expect(mockSprite.frame.name).toBe(0); // unchanged — frame 5 not in texture
  });

  it('updates sprite when frame exists in texture', () => {
    const animator = new TileAnimator();
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 100 },
          { tileid: 5, duration: 100 },
        ],
      },
    }, 1);

    const mockSprite = {
      active: true,
      frame: { name: 0 },
      _tileFirstgid: 1,
      texture: { has: () => true }, // all frames exist
      setFrame: function(f) { this.frame.name = f; },
    };

    animator.init(tilemap, { Ground: createMockLayer([[makeTile(1)]]) }, []);
    animator._tileLocations.get(1).sprites.push(mockSprite);

    animator.update(150);
    expect(mockSprite.frame.name).toBe(5); // localFrame = GID 6 - firstgid 1
  });

  it('updates multiple tiles sharing the same animation in sync', () => {
    const animator = new TileAnimator();
    const tile1 = makeTile(1);
    const tile2 = makeTile(1);
    const tilemap = createMockTilemap({
      0: {
        animation: [
          { tileid: 0, duration: 100 },
          { tileid: 3, duration: 100 },
        ],
      },
    }, 1);

    animator.init(tilemap, {
      Ground: createMockLayer([[tile1, tile2]]),
    }, []);

    animator.update(150);
    expect(tile1.index).toBe(4); // tileid 3 + firstgid 1
    expect(tile2.index).toBe(4); // same — they share the animation
  });
});
