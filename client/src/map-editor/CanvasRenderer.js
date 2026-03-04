// --- CanvasRenderer ---
// Draws tile layers, grid, objects, and tool previews onto the map editor canvas.
// Separated from MapEditorCanvas for testability and reuse.

const TILE_SIZE = 16;

export class CanvasRenderer {
  constructor(ctx, viewTransform) {
    this.ctx = ctx;
    this.view = viewTransform;
  }

  // Clear the entire canvas
  clear(width, height) {
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#121228';
    this.ctx.fillRect(0, 0, width, height);
  }

  // Draw the tile grid overlay
  renderGrid(canvasWidth, canvasHeight) {
    const { ctx, view } = this;
    const s = TILE_SIZE * view.zoom;

    // Don't draw grid if tiles are too small to see
    if (s < 4) return;

    const topLeft = view.screenToWorld(0, 0);
    const bottomRight = view.screenToWorld(canvasWidth, canvasHeight);

    // First visible tile (floor to snap to grid)
    const startCol = Math.floor(topLeft.x / TILE_SIZE);
    const startRow = Math.floor(topLeft.y / TILE_SIZE);
    const endCol = Math.ceil(bottomRight.x / TILE_SIZE);
    const endRow = Math.ceil(bottomRight.y / TILE_SIZE);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Vertical lines
    for (let col = startCol; col <= endCol; col++) {
      const screen = view.worldToScreen(col * TILE_SIZE, 0);
      const x = Math.round(screen.x) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
    }

    // Horizontal lines
    for (let row = startRow; row <= endRow; row++) {
      const screen = view.worldToScreen(0, row * TILE_SIZE);
      const y = Math.round(screen.y) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
    }

    ctx.stroke();

    // Draw origin crosshair (world 0,0) if visible
    const origin = view.worldToScreen(0, 0);
    if (origin.x >= -2 && origin.x <= canvasWidth + 2 &&
        origin.y >= -2 && origin.y <= canvasHeight + 2) {
      ctx.strokeStyle = 'rgba(0, 204, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(origin.x) + 0.5, 0);
      ctx.lineTo(Math.round(origin.x) + 0.5, canvasHeight);
      ctx.moveTo(0, Math.round(origin.y) + 0.5);
      ctx.lineTo(canvasWidth, Math.round(origin.y) + 0.5);
      ctx.stroke();
    }
  }

  // Draw a single tile layer from SparseLayer data
  renderTileLayer(layer, tilesets, canvasWidth, canvasHeight, opacity = 1.0) {
    if (!layer || !tilesets || tilesets.length === 0) return;

    const { ctx, view } = this;
    const range = this.getVisibleTileRange(canvasWidth, canvasHeight);

    ctx.imageSmoothingEnabled = false;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = opacity;

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const gid = layer.get(col, row);
        if (gid <= 0) continue;

        // Resolve GID to tileset + local tile ID
        const resolved = resolveTileGid(gid, tilesets);
        if (!resolved || !resolved.tileset.image) continue;

        const { tileset, localId } = resolved;
        const srcCol = localId % tileset.columns;
        const srcRow = Math.floor(localId / tileset.columns);

        const screen = view.worldToScreen(col * TILE_SIZE, row * TILE_SIZE);
        const s = TILE_SIZE * view.zoom;

        ctx.drawImage(
          tileset.image,
          srcCol * TILE_SIZE, srcRow * TILE_SIZE, TILE_SIZE, TILE_SIZE,
          screen.x, screen.y, s, s,
        );
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  // Compute visible tile range for a given canvas size
  getVisibleTileRange(canvasWidth, canvasHeight) {
    const topLeft = this.view.screenToWorld(0, 0);
    const bottomRight = this.view.screenToWorld(canvasWidth, canvasHeight);
    return {
      startCol: Math.floor(topLeft.x / TILE_SIZE),
      startRow: Math.floor(topLeft.y / TILE_SIZE),
      endCol: Math.ceil(bottomRight.x / TILE_SIZE),
      endRow: Math.ceil(bottomRight.y / TILE_SIZE),
    };
  }

  // Draw the Collision layer as colored overlay (red = solid, green = passable)
  renderCollisionLayer(layer, canvasWidth, canvasHeight, opacity = 1.0) {
    if (!layer) return;

    const { ctx, view } = this;
    const range = this.getVisibleTileRange(canvasWidth, canvasHeight);

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = opacity * 0.5;

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const gid = layer.get(col, row);
        if (gid <= 0) continue;

        const screen = view.worldToScreen(col * TILE_SIZE, row * TILE_SIZE);
        const s = TILE_SIZE * view.zoom;

        ctx.fillStyle = '#ff4444';
        ctx.fillRect(screen.x, screen.y, s, s);

        // Draw X pattern
        ctx.strokeStyle = '#ff8888';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(screen.x + 2, screen.y + 2);
        ctx.lineTo(screen.x + s - 2, screen.y + s - 2);
        ctx.moveTo(screen.x + s - 2, screen.y + 2);
        ctx.lineTo(screen.x + 2, screen.y + s - 2);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  // Draw the Elevation layer as numbered labels
  renderElevationLayer(layer, canvasWidth, canvasHeight, opacity = 1.0) {
    if (!layer) return;

    const { ctx, view } = this;
    const range = this.getVisibleTileRange(canvasWidth, canvasHeight);
    const s = TILE_SIZE * view.zoom;

    // Only draw labels if tiles are large enough to read
    if (s < 12) return;

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = opacity * 0.7;

    const fontSize = Math.max(8, Math.min(14, s * 0.5));
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let row = range.startRow; row <= range.endRow; row++) {
      for (let col = range.startCol; col <= range.endCol; col++) {
        const gid = layer.get(col, row);
        if (gid <= 0) continue;

        const screen = view.worldToScreen(col * TILE_SIZE, row * TILE_SIZE);

        // Background
        ctx.fillStyle = 'rgba(0, 100, 255, 0.4)';
        ctx.fillRect(screen.x, screen.y, s, s);

        // Number label (GID serves as elevation value)
        ctx.fillStyle = '#ffffff';
        ctx.fillText(String(gid), screen.x + s / 2, screen.y + s / 2);
      }
    }

    ctx.globalAlpha = prevAlpha;
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // Placeholder: renderObjects will be added in Commit 8
}

// Resolve a GID to its tileset and local tile ID
function resolveTileGid(gid, tilesets) {
  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) {
      return {
        tileset: tilesets[i],
        localId: gid - tilesets[i].firstgid,
      };
    }
  }
  return null;
}
