// --- ViewTransform ---
// Camera state for the map editor canvas: pan offset and zoom level.
// All coordinate conversions between screen pixels and world pixels go through here.

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 16;
const DEFAULT_ZOOM = 2;

export class ViewTransform {
  constructor() {
    this.offsetX = 0;  // world-space offset (what world coord is at screen origin)
    this.offsetY = 0;
    this.zoom = DEFAULT_ZOOM;
  }

  // World pixel → screen pixel
  worldToScreen(wx, wy) {
    return {
      x: (wx - this.offsetX) * this.zoom,
      y: (wy - this.offsetY) * this.zoom,
    };
  }

  // Screen pixel → world pixel
  screenToWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.offsetX,
      y: sy / this.zoom + this.offsetY,
    };
  }

  // Screen pixel → tile grid coordinates
  screenToTile(sx, sy, tileSize = 16) {
    const { x, y } = this.screenToWorld(sx, sy);
    return {
      tileX: Math.floor(x / tileSize),
      tileY: Math.floor(y / tileSize),
    };
  }

  // Zoom toward a specific screen point (keeps that point fixed)
  zoomAt(screenX, screenY, newZoom) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.zoom = clamped;
    const worldAfter = this.screenToWorld(screenX, screenY);
    this.offsetX += worldBefore.x - worldAfter.x;
    this.offsetY += worldBefore.y - worldAfter.y;
  }

  // Get the visible world-space rectangle for a given canvas size
  getVisibleBounds(canvasWidth, canvasHeight) {
    const topLeft = this.screenToWorld(0, 0);
    const bottomRight = this.screenToWorld(canvasWidth, canvasHeight);
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    };
  }

  // Pan by screen-space delta
  pan(screenDx, screenDy) {
    this.offsetX -= screenDx / this.zoom;
    this.offsetY -= screenDy / this.zoom;
  }
}
