// --- Tile Metadata Schema ---
// Shared between the tile editor tool and the game runtime.
// AGENT: Keep defaults and enums in sync — both sides import this file.

export const TILE_CATEGORIES = ['floor', 'wall', 'decor', 'obstacle', 'ceiling', 'door', 'stairs'];
export const TILE_COLLISIONS = ['none', 'solid', 'platform'];
export const TILE_SURFACES = ['stone', 'wood', 'water', 'grass', 'carpet', 'metal', 'dirt'];

export const FOOTSTEP_SOUNDS = [
  'step_stone', 'step_wood', 'step_water', 'step_grass',
  'step_carpet', 'step_metal', 'step_dirt',
];

export const TILE_DEFAULTS = {
  category: 'floor',
  collision: 'none',
  surface: 'stone',
  elevationHint: 0,
  lightEmission: 0,
  footstepSound: 'step_stone',
  walkable: true,
  transparency: 0,
  zLayerOverride: null,
};

// Returns tile properties with defaults applied for missing fields.
export function getTileProperties(metadata, tileIndex) {
  const tile = metadata.tiles?.[String(tileIndex)];
  if (!tile) return { ...TILE_DEFAULTS };
  return { ...TILE_DEFAULTS, ...tile };
}

// Returns true if tile properties match all defaults (should be omitted from JSON).
export function isDefaultTile(props) {
  return Object.entries(TILE_DEFAULTS).every(([key, defaultVal]) => {
    const val = props[key];
    if (defaultVal === null) return val === null || val === undefined;
    return val === defaultVal;
  });
}
