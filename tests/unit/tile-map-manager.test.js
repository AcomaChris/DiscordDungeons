import { describe, it, expect, vi } from 'vitest';
import { DEPTH_ABOVE_PLAYER } from '../../client/src/core/Constants.js';

// AGENT: TileMapManager depends on Phaser scene APIs. We test logic paths
// with a mock scene — the real tilemap rendering is covered by e2e tests.

function createMockTilemap(layers = {}, objectLayer = null) {
  return {
    widthInPixels: 480,
    heightInPixels: 320,
    tileHeight: 16,
    tilesets: [{ firstgid: 1 }],
    addTilesetImage: vi.fn(() => 'tileset-ref'),
    createLayer: vi.fn((name) => {
      if (layers[name]) return layers[name];
      return null;
    }),
    getObjectLayer: vi.fn(() => objectLayer),
    destroy: vi.fn(),
  };
}

function createMockLayer({ tiles = [] } = {}) {
  return {
    setDepth: vi.fn(),
    setVisible: vi.fn(),
    setCollisionByExclusion: vi.fn(),
    forEachTile: vi.fn((callback) => {
      for (const tile of tiles) callback(tile);
    }),
  };
}

function createMockScene(tilemap) {
  return {
    load: {
      tilemapTiledJSON: vi.fn(),
      image: vi.fn(),
      spritesheet: vi.fn(),
    },
    make: {
      tilemap: vi.fn(() => tilemap),
    },
    add: {
      sprite: vi.fn(() => ({
        setDepth: vi.fn(),
        destroy: vi.fn(),
      })),
    },
  };
}

const TILESET_ENTRY = { key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles', tileSize: 16 };

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

    mgr.preload('test', 'maps/test.json', [TILESET_ENTRY]);
    expect(scene.load.tilemapTiledJSON).toHaveBeenCalledWith('test', 'maps/test.json');
    expect(scene.load.spritesheet).toHaveBeenCalledWith('test-tiles', 'tilesets/test-tiles.png', { frameWidth: 16, frameHeight: 16 });

    mgr.create();

    // Ground keeps its depth; Walls/WallTops get depth then are hidden for Y-sorted sprites
    expect(groundLayer.setDepth).toHaveBeenCalledWith(0);
    expect(wallsLayer.setDepth).toHaveBeenCalledWith(2);
    expect(wallTopsLayer.setDepth).toHaveBeenCalledWith(DEPTH_ABOVE_PLAYER);

    // Walls/WallTops layers hidden after Y-sorted sprite conversion
    expect(wallsLayer.setVisible).toHaveBeenCalledWith(false);
    expect(wallTopsLayer.setVisible).toHaveBeenCalledWith(false);

    // Collision layer is hidden and collision-enabled
    expect(collisionLayer.setVisible).toHaveBeenCalledWith(false);
    expect(collisionLayer.setCollisionByExclusion).toHaveBeenCalledWith([-1]);

    // Spawn point parsed
    expect(mgr.spawnPoint).toEqual({ x: 88, y: 168 });

    // World bounds
    expect(mgr.getWorldBounds()).toEqual({ width: 480, height: 320 });
  });

  it('creates Y-sorted sprites for wall tiles', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const wallTile = { index: 2, pixelX: 160, pixelY: 128, width: 16, height: 16 };
    const wallTopTile = { index: 3, pixelX: 160, pixelY: 112, width: 16, height: 16 };

    const wallsLayer = createMockLayer({ tiles: [wallTile] });
    const wallTopsLayer = createMockLayer({ tiles: [wallTopTile] });

    const tilemap = createMockTilemap(
      { Walls: wallsLayer, WallTops: wallTopsLayer },
      null,
    );

    const depthCalls = [];
    const scene = createMockScene(tilemap);
    scene.add.sprite = vi.fn(() => {
      const mockSprite = { setDepth: vi.fn((d) => depthCalls.push(d)), destroy: vi.fn() };
      return mockSprite;
    });

    const mgr = new TileMapManager(scene);
    mgr.preload('test', 'maps/test.json', [TILESET_ENTRY]);
    mgr.create();

    // Two sprites created: one for wall tile, one for wall top tile
    expect(scene.add.sprite).toHaveBeenCalledTimes(2);

    // Wall sprite: positioned at tile center, using tileset frame 1 (index 2 - firstgid 1)
    expect(scene.add.sprite).toHaveBeenCalledWith(168, 136, 'test-tiles', 1);
    // WallTop sprite: frame 2 (index 3 - firstgid 1)
    expect(scene.add.sprite).toHaveBeenCalledWith(168, 120, 'test-tiles', 2);

    // Depth = pixelY + tileHeight (bottom edge for Y-sorting)
    expect(depthCalls).toContain(144); // wall: 128 + 16
    expect(depthCalls).toContain(128); // wall top: 112 + 16

    // Original layers hidden
    expect(wallsLayer.setVisible).toHaveBeenCalledWith(false);
    expect(wallTopsLayer.setVisible).toHaveBeenCalledWith(false);

    // Wall sprites tracked for cleanup
    expect(mgr.wallSprites).toHaveLength(2);
  });

  it('falls back to image loading when tileSize not provided', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const tilemap = createMockTilemap({}, null);
    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    const entryWithoutTileSize = { key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles' };
    mgr.preload('test', 'maps/test.json', [entryWithoutTileSize]);

    expect(scene.load.image).toHaveBeenCalledWith('test-tiles', 'tilesets/test-tiles.png');
    expect(scene.load.spritesheet).not.toHaveBeenCalled();
  });

  it('falls back to map center when no spawn point exists', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const tilemap = createMockTilemap({}, { objects: [] });
    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    mgr.preload('test', 'maps/test.json', [TILESET_ENTRY]);
    mgr.create();

    expect(mgr.spawnPoint).toEqual({ x: 240, y: 160 });
  });

  it('falls back to map center when no Objects layer exists', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const tilemap = createMockTilemap({}, null);
    const scene = createMockScene(tilemap);
    const mgr = new TileMapManager(scene);

    mgr.preload('test', 'maps/test.json', [TILESET_ENTRY]);
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

    mgr.preload('test', 'maps/test.json', [TILESET_ENTRY]);
    mgr.create();

    expect(mgr.layers.Ground).toBe(groundLayer);
    expect(mgr.layers.Walls).toBeUndefined();
    expect(mgr.collisionLayer).toBeNull();
  });

  it('destroy cleans up tilemap and wall sprites', async () => {
    const mod = await import('../../client/src/map/TileMapManager.js');
    TileMapManager = mod.TileMapManager;

    const wallTile = { index: 2, pixelX: 0, pixelY: 0, width: 16, height: 16 };
    const wallsLayer = createMockLayer({ tiles: [wallTile] });
    const tilemap = createMockTilemap({ Walls: wallsLayer }, null);

    const mockSprite = { setDepth: vi.fn(), destroy: vi.fn() };
    const scene = createMockScene(tilemap);
    scene.add.sprite = vi.fn(() => mockSprite);

    const mgr = new TileMapManager(scene);
    mgr.preload('test', 'maps/test.json', [TILESET_ENTRY]);
    mgr.create();
    mgr.destroy();

    expect(mockSprite.destroy).toHaveBeenCalled();
    expect(tilemap.destroy).toHaveBeenCalled();
    expect(mgr.tilemap).toBeNull();
    expect(mgr.spawnPoint).toBeNull();
    expect(mgr.wallSprites).toEqual([]);
  });
});

describe('MapRegistry', () => {
  it('returns config for known maps', async () => {
    const { getMapConfig, getMapIds } = await import('../../client/src/map/MapRegistry.js');

    const config = getMapConfig('test');
    expect(config.jsonPath).toBe('maps/test.json');
    expect(config.tilesets).toHaveLength(1);
    expect(config.tilesets[0].key).toBe('test-tiles');
    expect(config.tilesets[0].tileSize).toBe(16);

    expect(getMapIds()).toContain('test');
  });

  it('throws for unknown maps', async () => {
    const { getMapConfig } = await import('../../client/src/map/MapRegistry.js');
    expect(() => getMapConfig('nonexistent')).toThrow('Unknown map: nonexistent');
  });
});
