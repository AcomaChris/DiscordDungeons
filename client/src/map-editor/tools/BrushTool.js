// --- BrushTool ---
// Paints selected tile(s) on the active layer. Accumulates changes during
// a drag stroke and commits one PaintTilesCommand on mouseup.
// Uses Bresenham line interpolation to avoid gaps at fast mouse movement.

// @doc-creator-tools 01:Map Editor > Brush Tool
// Paint tiles on the active layer. Select a tile from the **Tile Palette**,
// then click or drag to paint. Handles fast mouse movement without gaps.
// Shortcut: **B**.

import { BaseTool } from './BaseTool.js';
import { PaintTilesCommand } from '../CommandStack.js';

export class BrushTool extends BaseTool {
  constructor(editor) {
    super('brush', editor);
    this._painting = false;
    this._lastTile = null;     // {x, y} of last painted tile
    this._changes = new Map(); // "x,y" → {x, y, oldGid, newGid}
    this._cursorTile = null;   // current hover position for preview
  }

  activate() {
    this._painting = false;
    this._changes.clear();
  }

  deactivate() {
    this._commitIfNeeded();
  }

  onMouseDown(worldX, worldY, tileX, tileY, event) {
    if (event.button !== 0) return;
    this._painting = true;
    this._changes.clear();
    this._lastTile = { x: tileX, y: tileY };
    this._paintAt(tileX, tileY);
  }

  onMouseMove(_worldX, _worldY, tileX, tileY, _event) {
    this._cursorTile = { x: tileX, y: tileY };

    if (!this._painting) return;

    // Bresenham interpolation from last tile to current
    if (this._lastTile) {
      const points = bresenham(this._lastTile.x, this._lastTile.y, tileX, tileY);
      for (const p of points) {
        this._paintAt(p.x, p.y);
      }
    } else {
      this._paintAt(tileX, tileY);
    }
    this._lastTile = { x: tileX, y: tileY };
  }

  onMouseUp(_worldX, _worldY, _tileX, _tileY, _event) {
    if (!this._painting) return;
    this._painting = false;
    this._lastTile = null;
    this._commitIfNeeded();
  }

  _paintAt(x, y) {
    const layer = this._getActiveLayer();
    if (!layer) return;

    const stamp = this.editor.selectedStamp;
    if (stamp) {
      // Paint multi-tile stamp anchored at (x, y)
      for (let row = 0; row < stamp.rows; row++) {
        for (let col = 0; col < stamp.cols; col++) {
          const gid = stamp.gids[row][col];
          if (gid === 0) continue;
          this._paintSingleTile(layer, x + col, y + row, gid);
        }
      }
      return;
    }

    const gid = this._getBrushGid();
    if (gid === 0) return;
    this._paintSingleTile(layer, x, y, gid);
  }

  _paintSingleTile(layer, x, y, gid) {
    const key = `${x},${y}`;
    const oldGid = this._changes.has(key)
      ? this._changes.get(key).oldGid  // preserve original old value
      : layer.get(x, y);

    if (oldGid === gid) return; // no change

    this._changes.set(key, { x, y, oldGid, newGid: gid });

    // Apply immediately for visual feedback (will be undone/redone by command)
    layer.set(x, y, gid);
  }

  _commitIfNeeded() {
    if (this._changes.size === 0) return;

    const layer = this._getActiveLayer();
    if (!layer) return;

    // Undo the immediate applies (command.execute() will re-apply)
    for (const change of this._changes.values()) {
      layer.set(change.x, change.y, change.oldGid);
    }

    const tiles = [...this._changes.values()];
    this._changes.clear();

    const cmd = new PaintTilesCommand(layer, tiles);
    this.editor.mapDocument.commandStack.execute(cmd);
  }

  _getActiveLayer() {
    if (!this.editor.mapDocument) return null;
    return this.editor.mapDocument.getLayer(this.editor.activeLayerName || 'Ground');
  }

  _getBrushGid() {
    // Stamp mode or single tile from palette
    if (this.editor.selectedGid) return this.editor.selectedGid;
    return 0;
  }

  renderPreview(ctx, viewTransform) {
    if (!this._cursorTile) return;

    const tileSize = 16;
    const s = tileSize * viewTransform.zoom;
    const stamp = this.editor.selectedStamp;

    if (stamp) {
      // Multi-tile stamp preview
      ctx.globalAlpha = 0.5;
      ctx.imageSmoothingEnabled = false;
      for (let row = 0; row < stamp.rows; row++) {
        for (let col = 0; col < stamp.cols; col++) {
          const gid = stamp.gids[row][col];
          if (gid === 0) continue;
          const resolved = this.editor.mapDocument?.resolveGid(gid);
          if (resolved && resolved.tileset.image) {
            const srcCol = resolved.localId % resolved.tileset.columns;
            const srcRow = Math.floor(resolved.localId / resolved.tileset.columns);
            const wx = (this._cursorTile.x + col) * tileSize;
            const wy = (this._cursorTile.y + row) * tileSize;
            const { x, y } = viewTransform.worldToScreen(wx, wy);
            ctx.drawImage(
              resolved.tileset.image,
              srcCol * tileSize, srcRow * tileSize, tileSize, tileSize,
              x, y, s, s,
            );
          }
        }
      }
      ctx.globalAlpha = 1.0;

      // Outline around the entire stamp
      const topLeft = viewTransform.worldToScreen(
        this._cursorTile.x * tileSize,
        this._cursorTile.y * tileSize,
      );
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(topLeft.x) + 0.5, Math.round(topLeft.y) + 0.5,
        Math.round(stamp.cols * s) - 1, Math.round(stamp.rows * s) - 1,
      );
      return;
    }

    // Single tile preview
    const gid = this._getBrushGid();
    if (gid === 0) return;

    const { x, y } = viewTransform.worldToScreen(
      this._cursorTile.x * tileSize,
      this._cursorTile.y * tileSize,
    );

    const resolved = this.editor.mapDocument?.resolveGid(gid);
    if (resolved && resolved.tileset.image) {
      const localCol = resolved.localId % resolved.tileset.columns;
      const localRow = Math.floor(resolved.localId / resolved.tileset.columns);

      ctx.globalAlpha = 0.5;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        resolved.tileset.image,
        localCol * tileSize, localRow * tileSize, tileSize, tileSize,
        x, y, s, s,
      );
      ctx.globalAlpha = 1.0;
    }

    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
  }
}

// --- Bresenham line algorithm ---
// Returns array of {x, y} points from (x0,y0) to (x1,y1) inclusive
export function bresenham(x0, y0, x1, y1) {
  const points = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }

  return points;
}
