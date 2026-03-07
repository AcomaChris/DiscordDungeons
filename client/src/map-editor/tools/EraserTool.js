// --- EraserTool ---
// Erases tiles on the active layer (sets GID to 0).
// Same accumulation pattern as BrushTool.

// @doc-creator-tools 01:Map Editor > Eraser Tool
// Remove tiles from the active layer. Click or drag to erase.
// Shortcut: **E**.

import { BaseTool } from './BaseTool.js';
import { PaintTilesCommand } from '../CommandStack.js';
import { bresenham } from './BrushTool.js';

export class EraserTool extends BaseTool {
  constructor(editor) {
    super('eraser', editor);
    this._erasing = false;
    this._lastTile = null;
    this._changes = new Map();
    this._cursorTile = null;
  }

  activate() {
    this._erasing = false;
    this._changes.clear();
  }

  deactivate() {
    this._commitIfNeeded();
  }

  onMouseDown(worldX, worldY, tileX, tileY, event) {
    if (event.button !== 0) return;
    this._erasing = true;
    this._changes.clear();
    this._lastTile = { x: tileX, y: tileY };
    this._eraseAt(tileX, tileY);
  }

  onMouseMove(_worldX, _worldY, tileX, tileY, _event) {
    this._cursorTile = { x: tileX, y: tileY };

    if (!this._erasing) return;

    if (this._lastTile) {
      const points = bresenham(this._lastTile.x, this._lastTile.y, tileX, tileY);
      for (const p of points) {
        this._eraseAt(p.x, p.y);
      }
    } else {
      this._eraseAt(tileX, tileY);
    }
    this._lastTile = { x: tileX, y: tileY };
  }

  onMouseUp(_worldX, _worldY, _tileX, _tileY, _event) {
    if (!this._erasing) return;
    this._erasing = false;
    this._lastTile = null;
    this._commitIfNeeded();
  }

  _eraseAt(x, y) {
    const layer = this._getActiveLayer();
    if (!layer) return;

    const key = `${x},${y}`;
    const oldGid = this._changes.has(key)
      ? this._changes.get(key).oldGid
      : layer.get(x, y);

    if (oldGid === 0) return; // already empty

    this._changes.set(key, { x, y, oldGid, newGid: 0 });
    layer.set(x, y, 0);
  }

  _commitIfNeeded() {
    if (this._changes.size === 0) return;

    const layer = this._getActiveLayer();
    if (!layer) return;

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

  renderPreview(ctx, viewTransform) {
    if (!this._cursorTile) return;

    const tileSize = 16;
    const { x, y } = viewTransform.worldToScreen(
      this._cursorTile.x * tileSize,
      this._cursorTile.y * tileSize,
    );
    const s = tileSize * viewTransform.zoom;

    // Red X cursor for eraser
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    const pad = s * 0.25;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad);
    ctx.lineTo(x + s - pad, y + s - pad);
    ctx.moveTo(x + s - pad, y + pad);
    ctx.lineTo(x + pad, y + s - pad);
    ctx.stroke();

    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
  }
}
