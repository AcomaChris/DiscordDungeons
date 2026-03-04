// --- LineTool ---
// Click-and-drag to paint a Bresenham line from start to end.
// Commits one PaintTilesCommand on mouseup.

import { BaseTool } from './BaseTool.js';
import { PaintTilesCommand } from '../CommandStack.js';
import { bresenham } from './BrushTool.js';

export class LineTool extends BaseTool {
  constructor(editor) {
    super('line', editor);
    this._dragging = false;
    this._startTile = null;  // {x, y} where drag began
    this._endTile = null;    // {x, y} current drag end
    this._cursorTile = null; // hover position for cursor preview when not dragging
  }

  activate() {
    this._dragging = false;
    this._startTile = null;
    this._endTile = null;
  }

  deactivate() {
    this._dragging = false;
    this._startTile = null;
    this._endTile = null;
  }

  onMouseDown(_worldX, _worldY, tileX, tileY, event) {
    if (event.button !== 0) return;
    this._dragging = true;
    this._startTile = { x: tileX, y: tileY };
    this._endTile = { x: tileX, y: tileY };
  }

  onMouseMove(_worldX, _worldY, tileX, tileY, _event) {
    this._cursorTile = { x: tileX, y: tileY };

    if (!this._dragging) return;
    this._endTile = { x: tileX, y: tileY };
  }

  onMouseUp(_worldX, _worldY, tileX, tileY, _event) {
    if (!this._dragging) return;
    this._dragging = false;
    this._endTile = { x: tileX, y: tileY };

    this._commitLine();
    this._startTile = null;
    this._endTile = null;
  }

  _commitLine() {
    if (!this._startTile || !this._endTile) return;

    const layer = this._getActiveLayer();
    if (!layer) return;

    const gid = this._getBrushGid();
    if (gid === 0) return;

    const points = bresenham(
      this._startTile.x, this._startTile.y,
      this._endTile.x, this._endTile.y,
    );

    // Collect changes, only include tiles that actually change
    const tiles = [];
    const seen = new Set();
    for (const p of points) {
      const key = `${p.x},${p.y}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const oldGid = layer.get(p.x, p.y);
      if (oldGid === gid) continue;

      tiles.push({ x: p.x, y: p.y, oldGid, newGid: gid });
    }

    if (tiles.length === 0) return;

    const cmd = new PaintTilesCommand(layer, tiles);
    this.editor.mapDocument.commandStack.execute(cmd);
  }

  _getActiveLayer() {
    if (!this.editor.mapDocument) return null;
    return this.editor.mapDocument.getLayer(this.editor.activeLayerName || 'Ground');
  }

  _getBrushGid() {
    if (this.editor.selectedGid) return this.editor.selectedGid;
    return 0;
  }

  renderPreview(ctx, viewTransform) {
    const tileSize = 16;

    // While dragging, draw the line preview
    if (this._dragging && this._startTile && this._endTile) {
      const points = bresenham(
        this._startTile.x, this._startTile.y,
        this._endTile.x, this._endTile.y,
      );

      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 1;

      for (const p of points) {
        const { x, y } = viewTransform.worldToScreen(p.x * tileSize, p.y * tileSize);
        const s = tileSize * viewTransform.zoom;
        ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
      }
      return;
    }

    // When not dragging, show cursor tile preview
    if (!this._cursorTile) return;

    const gid = this._getBrushGid();
    if (gid === 0) return;

    const { x, y } = viewTransform.worldToScreen(
      this._cursorTile.x * tileSize,
      this._cursorTile.y * tileSize,
    );
    const s = tileSize * viewTransform.zoom;

    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
  }
}
