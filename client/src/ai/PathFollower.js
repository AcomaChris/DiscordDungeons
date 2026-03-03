// --- PathFollower ---
// Converts a tile path (from A*) into frame-by-frame velocity commands.
// Each frame: steer toward the next waypoint center, advance when close enough.

import { TILE_SIZE } from '../core/Constants.js';

// How close (in pixels) to a waypoint center before advancing to the next one
const ARRIVAL_THRESHOLD = 2;

export class PathFollower {
  constructor(speed = 60) {
    this._speed = speed;
    this._path = null;       // array of { tx, ty }
    this._waypointIndex = 0;
    this._tileSize = TILE_SIZE;
  }

  // Begin following a tile path. The path should NOT include the start tile.
  startPath(path) {
    if (!path || path.length === 0) {
      this._path = null;
      return;
    }
    this._path = path;
    this._waypointIndex = 0;
  }

  // Compute velocity for this frame. Returns { vx, vy, facing, arrived }.
  // spriteX, spriteY = current world position of the NPC sprite.
  update(spriteX, spriteY) {
    if (!this._path) return { vx: 0, vy: 0, facing: null, arrived: true };

    const wp = this._path[this._waypointIndex];
    const targetX = wp.tx * this._tileSize + this._tileSize / 2;
    const targetY = wp.ty * this._tileSize + this._tileSize / 2;

    const dx = targetX - spriteX;
    const dy = targetY - spriteY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Close enough to this waypoint — advance
    if (dist < ARRIVAL_THRESHOLD) {
      this._waypointIndex++;
      if (this._waypointIndex >= this._path.length) {
        this._path = null;
        return { vx: 0, vy: 0, facing: null, arrived: true };
      }
      // Recurse once to immediately steer toward next waypoint
      return this.update(spriteX, spriteY);
    }

    // Steer toward waypoint
    const vx = (dx / dist) * this._speed;
    const vy = (dy / dist) * this._speed;

    // Determine facing from dominant axis
    const facing = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');

    return { vx, vy, facing, arrived: false };
  }

  cancel() {
    this._path = null;
    this._waypointIndex = 0;
  }

  get isFollowing() {
    return this._path !== null;
  }

  // 0..1 fraction of path completed
  get progress() {
    if (!this._path) return 1;
    return this._waypointIndex / this._path.length;
  }
}
