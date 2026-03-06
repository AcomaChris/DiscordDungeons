// --- MapRegistry ---
// Central lookup for map metadata. Each entry defines the JSON path and
// tileset entries needed to load a map via TileMapManager.

const maps = {
  test: {
    instanced: false, // shared hub map
    jsonPath: 'maps/test.json',
    tilesets: [
      { key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles', tileSize: 16 },
    ],
  },
  test2: {
    instanced: false,
    jsonPath: 'maps/test2.json',
    tilesets: [
      { key: 'test-tiles', path: 'tilesets/test-tiles.png', tiledName: 'test-tiles', tileSize: 16 },
      { key: 'anim-knight', path: 'tilesets/Animation_knight.png', tiledName: 'Animation_knight', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-dancer', path: 'tilesets/Animation_dancer.png', tiledName: 'Animation_dancer', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-windows-doors', path: 'tilesets/Animation_windows_doors.png', tiledName: 'Animation_windows_doors', tileSize: 16, hasAnimationJson: true },
    ],
  },
  tavern: {
    instanced: false,
    jsonPath: 'maps/tavern.json',
    tilesets: [
      { key: 'walls-interior', path: 'tilesets/Walls_interior.png', tiledName: 'Walls_interior', tileSize: 16 },
      { key: 'door-small', path: 'tilesets/door_small.png', tiledName: 'door_small', tileSize: 16 },
      { key: 'anim-windows-doors', path: 'tilesets/Animation_windows_doors.png', tiledName: 'Animation_windows_doors', tileSize: 16, hasAnimationJson: true },
      { key: 'interior-1st', path: 'tilesets/Interior_1st_floor.png', tiledName: 'Interior_1st_floor', tileSize: 16 },
      { key: 'anim-drinker4', path: 'tilesets/Animation_Drinker4.png', tiledName: 'Animation_Drinker4', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-drinker3', path: 'tilesets/Animation_Drinker3.png', tiledName: 'Animation_Drinker3', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-sleep-guy2', path: 'tilesets/Animation_sleep_guy2.png', tiledName: 'Animation_sleep_guy2', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-sit-char', path: 'tilesets/Animation_ sit_char.png', tiledName: 'Animation_ sit_char', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-knight', path: 'tilesets/Animation_knight.png', tiledName: 'Animation_knight', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-think-guy', path: 'tilesets/Animation_think_guy.png', tiledName: 'Animation_think_guy', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-lute-player', path: 'tilesets/Animation_Lute_player_full.png', tiledName: 'Animation_Lute_player_full', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-drinker5', path: 'tilesets/Animation_drinker5.png', tiledName: 'Animation_drinker5', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-watcher', path: 'tilesets/Animation_watcher.png', tiledName: 'Animation_watcher', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-orc-player', path: 'tilesets/Animation_orc_player.png', tiledName: 'Animation_orc_player', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-player-drow', path: 'tilesets/Animation_player_drow.png', tiledName: 'Animation_player_drow', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-dwarf-player', path: 'tilesets/Animation_dwarf_player.png', tiledName: 'Animation_dwarf_player', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-host', path: 'tilesets/Animation_host.png', tiledName: 'Animation_host', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-client', path: 'tilesets/Animation_client.png', tiledName: 'Animation_client', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-dancer', path: 'tilesets/Animation_dancer.png', tiledName: 'Animation_dancer', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-drinker6', path: 'tilesets/Animation_drinker6.png', tiledName: 'Animation_drinker6', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-drinker7', path: 'tilesets/Animation_drinker7.png', tiledName: 'Animation_drinker7', tileSize: 16, hasAnimationJson: true },
      { key: 'anim-killer', path: 'tilesets/Animation_killer.png', tiledName: 'Animation_killer', tileSize: 16, hasAnimationJson: true },
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

export function isInstancedMap(mapId) {
  const config = maps[mapId];
  return config ? !!config.instanced : false;
}
