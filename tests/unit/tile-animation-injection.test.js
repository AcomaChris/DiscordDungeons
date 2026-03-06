import { describe, it, expect, beforeAll } from 'vitest';

// --- TileMapManager Animation Injection Tests ---
// Tests _injectAnimationData() which bridges .animations.json files
// into Phaser tileset tileData so TileAnimator can use them.

let TileMapManager;

beforeAll(async () => {
  const mod = await import('../../client/src/map/TileMapManager.js');
  TileMapManager = mod.TileMapManager;
});

function createManager(cacheEntries = {}) {
  const mgr = new TileMapManager({
    cache: {
      json: {
        has(key) { return key in cacheEntries; },
        get(key) { return cacheEntries[key]; },
      },
    },
  });
  return mgr;
}

describe('TileMapManager._injectAnimationData', () => {
  it('injects animation data into tileset tileData', () => {
    const animData = {
      tileset: 'TestTileset',
      animations: {
        '10': [
          { tileid: 10, duration: 150 },
          { tileid: 20, duration: 150 },
        ],
        '11': [
          { tileid: 11, duration: 200 },
          { tileid: 21, duration: 200 },
        ],
      },
    };

    const mgr = createManager({ 'anim-TestTileset': animData });
    mgr.tilemap = {
      tilesets: [{ name: 'TestTileset', firstgid: 1 }],
    };

    mgr._injectAnimationData();

    const td = mgr.tilemap.tilesets[0].tileData;
    expect(td).toBeDefined();
    expect(td['10'].animation).toEqual(animData.animations['10']);
    expect(td['11'].animation).toEqual(animData.animations['11']);
  });

  it('skips tilesets without matching animation data', () => {
    const mgr = createManager({});
    mgr.tilemap = {
      tilesets: [{ name: 'NoAnimations', firstgid: 1 }],
    };

    mgr._injectAnimationData();

    expect(mgr.tilemap.tilesets[0].tileData).toBeUndefined();
  });

  it('preserves existing tileData and does not overwrite', () => {
    const existing = [{ tileid: 99, duration: 500 }];
    const animData = {
      tileset: 'Mixed',
      animations: {
        '5': [{ tileid: 5, duration: 100 }, { tileid: 15, duration: 100 }],
      },
    };

    const mgr = createManager({ 'anim-Mixed': animData });
    mgr.tilemap = {
      tilesets: [{
        name: 'Mixed',
        firstgid: 1,
        tileData: { '5': { animation: existing } },
      }],
    };

    mgr._injectAnimationData();

    // Should keep the existing animation, not overwrite
    expect(mgr.tilemap.tilesets[0].tileData['5'].animation).toBe(existing);
  });

  it('handles multiple tilesets', () => {
    const animA = {
      tileset: 'TilesetA',
      animations: { '0': [{ tileid: 0, duration: 100 }, { tileid: 1, duration: 100 }] },
    };
    const animB = {
      tileset: 'TilesetB',
      animations: { '3': [{ tileid: 3, duration: 200 }, { tileid: 4, duration: 200 }] },
    };

    const mgr = createManager({ 'anim-TilesetA': animA, 'anim-TilesetB': animB });
    mgr.tilemap = {
      tilesets: [
        { name: 'TilesetA', firstgid: 1 },
        { name: 'TilesetB', firstgid: 100 },
      ],
    };

    mgr._injectAnimationData();

    expect(mgr.tilemap.tilesets[0].tileData['0'].animation).toEqual(animA.animations['0']);
    expect(mgr.tilemap.tilesets[1].tileData['3'].animation).toEqual(animB.animations['3']);
  });

  it('handles animation data with null animations object', () => {
    const mgr = createManager({ 'anim-Bad': { tileset: 'Bad' } });
    mgr.tilemap = {
      tilesets: [{ name: 'Bad', firstgid: 1 }],
    };

    // Should not throw
    mgr._injectAnimationData();
    expect(mgr.tilemap.tilesets[0].tileData).toBeUndefined();
  });

  it('merges into existing tileData without losing other properties', () => {
    const animData = {
      tileset: 'Props',
      animations: {
        '7': [{ tileid: 7, duration: 100 }, { tileid: 17, duration: 100 }],
      },
    };

    const mgr = createManager({ 'anim-Props': animData });
    mgr.tilemap = {
      tilesets: [{
        name: 'Props',
        firstgid: 1,
        tileData: { '7': { properties: { collision: 'solid' } } },
      }],
    };

    mgr._injectAnimationData();

    const td = mgr.tilemap.tilesets[0].tileData['7'];
    expect(td.properties).toEqual({ collision: 'solid' });
    expect(td.animation).toEqual(animData.animations['7']);
  });
});
