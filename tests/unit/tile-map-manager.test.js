import { describe, it, expect, vi } from 'vitest';
import { DEPTH_ABOVE_PLAYER } from '../../client/src/core/Constants.js';

// AGENT: TileMapManager depends on Phaser scene APIs. We test logic paths
// with a mock scene — the real tilemap rendering is covered by e2e tests.

function createMockTilemap(layers = {}, objectLayer = null) {
  return {
    widthInPixels: 480,
    heightInPixels: 320,
    addTilesetImage: vi.fn(() => 'tileset-ref'),
    createLayer: vi.fn((name) => {
      if (layers[name]) return layers[name];
      return null;
    }),
    getObjectLayer: vi.fn(() => objectLayer),
    destroy: vi.fn(),
  };
}

function createMockLayer() {
  return {
    setDepth: vi.fn(),
    setVisible: vi.fn(),
    setCollisionByExclusion: vi.fn(),
  };
}

function createMockScene(tilemap) {
  return {
    load: {
      tilemapTiledJSON: vi.fn(),
      image: vi.fn(),
    },
    make: {
      tilemap: vi.fn(() => tilemap),
    },
  };
}

describe('TileMapManager', () => {
  let TileMapManager;

  // Dynamic import so Phaser mock isn't needed at module level
  // (TileMapManager imports only constants, not Phaser directly)

  it('loads and creates tilemap with standard layers', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const groundLayer = createMockLayer();
    const wallsLayer = createMockLayer();
    const wallTopsLayer = createMockLayer();
    const collisionLayer = createMockLayer();

    const tilemap = createMockTilemap(
      {
        Ground: groundLayer,
        Walls: wallsLayer,
        WallTops: wallTopsLayer,
        Collision: collisionLayer,
      },
      { objects: [{ name: 'spawn', type: 'spawn', x: 80, y: 160, width: 16, height: 16 }] },
    );

    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    mgr.preload('test', 'maps/test.json', [{ key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles' }]);
    expect(scene.load.tilemapTiledJSON).toHaveBeenCalledWith('test', 'maps/test.json');
    expect(scene.load.image).toHaveBeenCalledWith('test-tiles', 'tilesets/test-tiles.png');

    mgr.create();

    // Visible layers get correct depth
    expect(groundLayer.setDepth).toHaveBeenCalledWith(0);
    expect(wallsLayer.setDepth).toHaveBeenCalledWith(2);
    expect(wallTopsLayer.setDepth).toHaveBeenCalledWith(DEPTH_ABOVE_PLAYER);

    // Collision layer is hidden and collision-enabled
    expect(collisionLayer.setVisible).toHaveBeenCalledWith(false);
    expect(collisionLayer.setCollisionByExclusion).toHaveBeenCalledWith([-1]);

    // Spawn point parsed
    expect(mgr.spawnPoint).toEqual({ x: 88, y: 168 });

    // World bounds
    expect(mgr.getWorldBounds()).toEqual({ width: 480, height: 320 });
  });

  it('falls back to map center when no spawn point exists', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const tilemap = createMockTilemap({}, { objects: [] });
    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    mgr.preload('test', 'maps/test.json', [{ key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles' }]);
    mgr.create();

    expect(mgr.spawnPoint).toEqual({ x: 240, y: 160 });
  });

  it('falls back to map center when no Objects layer exists', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const tilemap = createMockTilemap({}, null);
    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    mgr.preload('test', 'maps/test.json', [{ key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles' }]);
    mgr.create();

    expect(mgr.spawnPoint).toEqual({ x: 240, y: 160 });
  });

  it('gracefully skips missing layers', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const groundLayer = createMockLayer();
    const tilemap = createMockTilemap({ Ground: groundLayer }, null);
    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    mgr.preload('test', 'maps/test.json', [{ key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles' }]);
    mgr.create();

    expect(mgr.layers.Ground).toBe(groundLayer);
    expect(mgr.layers.Walls).toBeUndefined();
    expect(mgr.collisionLayer).toBeNull();
  });

  it('destroy cleans up tilemap', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const tilemap = createMockTilemap({}, null);
    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    mgr.preload('test', 'maps/test.json', [{ key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles' }]);
    mgr.create();
    mgr.destroy();

    expect(tilemap.destroy).toHaveBeenCalled();
    expect(mgr.tilemap).toBeNull();
    expect(mgr.spawnPoint).toBeNull();
  });
});

describe('MapRegistry', () => {
  it('returns config for known maps', async () => {
    const { getMapConfig, getMapIds } = await import('../../client/src/map/MapRegistry.js');

    const config = getMapConfig('test');
    expect(config.jsonPath).toBe('maps/test.json');
    expect(config.tilesets).toHaveLength(1);
    expect(config.tilesets[0].key).toBe('test-tiles');

    expect(getMapIds()).toContain('test');
  });

  it('throws for unknown maps', async () => {
    const { getMapConfig } = await import('../../client/src/map/MapRegistry.js');
    expect(() => getMapConfig('nonexistent')).toThrow('Unknown map: nonexistent');
  });
});
