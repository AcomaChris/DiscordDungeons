// --- ObjectPlacer ---
// Places object definitions into map layer arrays.
// Used by map generation scripts to convert object IDs + positions
// into Tiled GID data for map JSON.
//
// AGENT: Tile indices in object defs are tileset-local (0-based).
// This module adds firstgid to produce Tiled GIDs.

const TILE_SIZE = 16;

export class ObjectPlacer {
  // objectDefsMap: { tilesetName: parsedObjectsJSON }
  // tilesetConfigs: [{ name, firstgid, columns }]
  constructor(objectDefsMap, tilesetConfigs) {
    this._defs = objectDefsMap;
    this._tilesets = tilesetConfigs;

    // Build object lookup across all tilesets
    this._objectIndex = new Map();
    for (const [tsName, defsFile] of Object.entries(objectDefsMap)) {
      for (const [objId, objDef] of Object.entries(defsFile.objects || {})) {
        this._objectIndex.set(objId, { tilesetName: tsName, def: objDef });
      }
    }

    // Build firstgid lookup
    this._firstgids = new Map();
    for (const ts of tilesetConfigs) {
      this._firstgids.set(ts.name, ts.firstgid);
    }
  }

  // --- Core placement ---
  // Returns a Placement object with tile writes for each layer.
  place(objectId, mapX, mapY, options = {}) {
    const entry = this._objectIndex.get(objectId);
    if (!entry) throw new Error(`Unknown object: ${objectId}`);

    const { tilesetName, def } = entry;
    const firstgid = this._firstgids.get(tilesetName);
    if (firstgid === undefined) throw new Error(`No firstgid for tileset: ${tilesetName}`);

    // Resolve tile grid (with optional stretch)
    const tileGrid = options.stretch !== undefined
      ? this._resolveStretch(def, options.stretch)
      : def.grid.tiles;

    const rows = tileGrid.length;
    const cols = tileGrid[0].length;

    // Build tile writes
    const wallTiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const localIndex = tileGrid[r][c];
        if (localIndex === null) continue;
        wallTiles.push({
          x: mapX + c,
          y: mapY + r,
          gid: localIndex + firstgid,
        });
      }
    }

    // Build collision writes from colliders
    const collisionTiles = this._resolveCollision(def, mapX, mapY, cols, rows);

    return new Placement(wallTiles, collisionTiles);
  }

  // --- Stretch resolution ---
  // Repeats middle columns based on parts definition.
  // stretchCount = number of times to repeat the middle unit.
  _resolveStretch(def, stretchCount) {
    if (!def.parts) {
      throw new Error(`Object "${def.id}" has no parts — cannot stretch`);
    }

    const { layout, roles } = def.parts;
    const baseGrid = def.grid.tiles;
    const rows = baseGrid.length;

    // Identify column roles from the first row of the layout
    const colRoles = layout[0];

    // Find repeatable column indices and non-repeatable column indices
    const leftCols = [];
    const middleCols = [];
    const rightCols = [];

    let phase = 'left';
    for (let c = 0; c < colRoles.length; c++) {
      const role = roles[colRoles[c]];
      if (phase === 'left') {
        if (role && role.repeatable) {
          phase = 'middle';
          middleCols.push(c);
        } else {
          leftCols.push(c);
        }
      } else if (phase === 'middle') {
        if (role && role.repeatable) {
          middleCols.push(c);
        } else {
          phase = 'right';
          rightCols.push(c);
        }
      } else {
        rightCols.push(c);
      }
    }

    // Build expanded grid
    const expandedGrid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      // Left columns
      for (const c of leftCols) row.push(baseGrid[r][c]);
      // Middle columns repeated
      for (let rep = 0; rep < stretchCount; rep++) {
        for (const c of middleCols) row.push(baseGrid[r][c]);
      }
      // Right columns
      for (const c of rightCols) row.push(baseGrid[r][c]);
      expandedGrid.push(row);
    }

    return expandedGrid;
  }

  // --- Collision from colliders ---
  // Determines which tile positions should be solid based on colliders.
  _resolveCollision(def, mapX, mapY, placedCols, placedRows) {
    const tiles = [];

    if (!def.colliders || def.colliders.length === 0) {
      return tiles;
    }

    // For ground-level solid colliders, mark covered tiles
    for (const collider of def.colliders) {
      if (collider.elevation > 0) continue; // only ground-level collision
      if (collider.type !== 'solid') continue;

      // Convert pixel rect to tile positions
      const startCol = Math.floor(collider.x / TILE_SIZE);
      const startRow = Math.floor(collider.y / TILE_SIZE);
      const endCol = Math.ceil((collider.x + collider.width) / TILE_SIZE);
      const endRow = Math.ceil((collider.y + collider.height) / TILE_SIZE);

      // Adjust for stretched objects
      const maxCol = Math.min(endCol, placedCols);
      const maxRow = Math.min(endRow, placedRows);

      for (let r = startRow; r < maxRow; r++) {
        for (let c = startCol; c < maxCol; c++) {
          tiles.push({ x: mapX + c, y: mapY + r });
        }
      }
    }

    return tiles;
  }
}

// --- Placement Result ---
// Holds the tile writes from a single placement operation.

class Placement {
  constructor(wallTiles, collisionTiles) {
    this.wallTiles = wallTiles;
    this.collisionTiles = collisionTiles;
  }

  // Write this placement into flat layer arrays.
  // layers: { walls: Array, collision: Array }
  // mapWidth: number of columns in the map
  applyTo(walls, collision, mapWidth) {
    if (walls) {
      for (const t of this.wallTiles) {
        const idx = t.y * mapWidth + t.x;
        walls[idx] = t.gid;
      }
    }
    if (collision) {
      for (const t of this.collisionTiles) {
        const idx = t.y * mapWidth + t.x;
        collision[idx] = 1;
      }
    }
  }
}
