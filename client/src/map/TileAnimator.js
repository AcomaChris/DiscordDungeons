// --- TileAnimator ---
// Drives tile animations by swapping tile indices each frame. Parses
// animation definitions from Phaser tileset tileData, tracks per-animation
// timing state, and updates tile/sprite indices when frames change.
// One timer per unique animation (not per tile instance) — all tiles
// sharing a base ID animate in sync.
//
// AGENT: Animation data uses LOCAL tile IDs (0-based within tileset).
// Runtime tiles use GIDs (localId + tileset.firstgid). Always convert.

// Layers whose tiles get index-swapped. Walls/WallTops are converted to
// individual sprites by TileMapManager and handled separately.
const ANIMATABLE_LAYERS = ['Ground', 'GroundDecor'];

export class TileAnimator {
  constructor() {
    // Map<baseGID, AnimState>
    // AnimState = { frames: [{gid, duration}], frameIndex, elapsed,
    //              totalDuration, currentGID, firstgid }
    this._animations = new Map();

    // Map<baseGID, {tiles: [{layer, row, col}], sprites: [Sprite]}>
    // Pre-built reverse index: which tiles/sprites use each animated base tile
    this._tileLocations = new Map();
  }

  // Call after TileMapManager.create(). Extracts animation defs from
  // the loaded tilemap's tilesets and builds the tile location index.
  init(tilemap, layers, wallSprites) {
    this._extractAnimations(tilemap);
    if (this._animations.size === 0) return;
    this._buildTileIndex(layers);
    this._buildSpriteIndex(wallSprites, tilemap);
  }

  // --- Extract Animations ---
  // Reads tileset.tileData[localId].animation for every tileset.
  // Converts local IDs to GIDs for both the base tile and frame targets.
  _extractAnimations(tilemap) {
    for (const tileset of tilemap.tilesets) {
      if (!tileset.tileData) continue;
      for (const localIdStr of Object.keys(tileset.tileData)) {
        const data = tileset.tileData[localIdStr];
        if (!data.animation) continue;

        const localId = parseInt(localIdStr, 10);
        const baseGID = localId + tileset.firstgid;

        const frames = data.animation.map((f) => ({
          gid: f.tileid + tileset.firstgid,
          duration: f.duration,
        }));

        const totalDuration = frames.reduce((sum, f) => sum + f.duration, 0);

        this._animations.set(baseGID, {
          frames,
          frameIndex: 0,
          elapsed: 0,
          totalDuration,
          currentGID: frames[0].gid,
          firstgid: tileset.firstgid,
        });
      }
    }
  }

  // --- Build Tile Index ---
  // Scans animatable tile layers once to record which tiles use each
  // animated base GID. Stores {layer, row, col} for O(1) tile access.
  _buildTileIndex(layers) {
    for (const layerName of ANIMATABLE_LAYERS) {
      const layer = layers[layerName];
      if (!layer) continue;

      const layerData = layer.layer.data; // Tile[][]
      for (let row = 0; row < layerData.length; row++) {
        for (let col = 0; col < layerData[row].length; col++) {
          const tile = layerData[row][col];
          if (tile.index <= 0) continue;
          if (!this._animations.has(tile.index)) continue;

          let locs = this._tileLocations.get(tile.index);
          if (!locs) {
            locs = { tiles: [], sprites: [] };
            this._tileLocations.set(tile.index, locs);
          }
          locs.tiles.push({ layer, row, col });
        }
      }
    }
  }

  // --- Build Sprite Index ---
  // For Y-sorted wall sprites, track which ones need frame animation.
  // AGENT: Sprites store _tileFirstgid (set by TileMapManager) so we can
  // reconstruct the correct GID for multi-tileset maps.
  _buildSpriteIndex(wallSprites, tilemap) {
    if (!wallSprites || wallSprites.length === 0) return;

    for (const sprite of wallSprites) {
      const localId = typeof sprite.frame.name === 'number'
        ? sprite.frame.name
        : parseInt(sprite.frame.name, 10);

      // Use stored firstgid from TileMapManager, fall back to tileset[0]
      const firstgid = sprite._tileFirstgid || tilemap.tilesets[0].firstgid;
      const gid = localId + firstgid;

      if (this._animations.has(gid)) {
        sprite._animBaseGID = gid;
        let locs = this._tileLocations.get(gid);
        if (!locs) {
          locs = { tiles: [], sprites: [] };
          this._tileLocations.set(gid, locs);
        }
        locs.sprites.push(sprite);
      }
    }
  }

  // --- Update ---
  // Call from scene.update(time, delta). Advances all animation timers
  // and swaps tile indices when frames change.
  update(delta) {
    if (this._animations.size === 0) return;

    for (const [baseGID, anim] of this._animations) {
      anim.elapsed += delta;

      // Wrap elapsed time to prevent unbounded growth
      if (anim.elapsed >= anim.totalDuration) {
        anim.elapsed %= anim.totalDuration;
      }

      const newFrameIndex = this._getFrameIndex(anim);
      if (newFrameIndex === anim.frameIndex) continue;

      // Frame changed — update tiles and sprites
      anim.frameIndex = newFrameIndex;
      const newGID = anim.frames[newFrameIndex].gid;
      anim.currentGID = newGID;

      const locs = this._tileLocations.get(baseGID);
      if (!locs) continue;

      // Swap tile layer indices
      for (const { layer, row, col } of locs.tiles) {
        layer.layer.data[row][col].index = newGID;
      }

      // Swap wall sprite frames (local ID = GID - firstgid)
      const localFrame = newGID - anim.firstgid;
      for (const sprite of locs.sprites) {
        sprite.setFrame(localFrame);
      }
    }
  }

  // Given current elapsed time, find which frame index we're on.
  _getFrameIndex(anim) {
    let accumulated = 0;
    for (let i = 0; i < anim.frames.length; i++) {
      accumulated += anim.frames[i].duration;
      if (anim.elapsed < accumulated) return i;
    }
    return anim.frames.length - 1;
  }

  get animationCount() {
    return this._animations.size;
  }

  destroy() {
    this._animations.clear();
    this._tileLocations.clear();
  }
}
