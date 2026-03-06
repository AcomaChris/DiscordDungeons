// --- MapRegistry ---
// Central lookup for map metadata. Each entry defines the JSON path and
// tileset entries needed to load a map via TileMapManager.

const maps = {
  test: {
    jsonPath: 'maps/test.json',
    tilesets: [
      { key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles', tileSize: 16 },
    ],
  },
  test2: {
    jsonPath: 'maps/test2.json',
    tilesets: [
      { key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles', tileSize: 16 },
    ],
  },
  tavern: {
    jsonPath: 'maps/tavern.json',
    tilesets: [
      { key: 'walls-interior', path: 'tilesets/Walls_interior.png', tiledName: 'Walls_interior', tileSize: 16 },
      { key: 'interior-1st', path: 'tilesets/Interior_1st_floor.png', tiledName: 'Interior_1st_floor', tileSize: 16 },
    ],
  },
};

export function getMapConfig(mapId) {
  const config = maps[mapId];
  if (!config) throw new Error(`Unknown map: ${mapId}`);
  return config;
}

export function getMapIds() {
  return Object.keys(maps);
}
