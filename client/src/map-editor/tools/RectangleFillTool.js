// --- RectangleFillTool ---
// Drag a rectangle and fill the area with the selected tile on mouseup.
// Commits one PaintTilesCommand covering all tiles in the rectangle.

// @doc-creator-tools 01:Map Editor > Rectangle Fill
// Fill a rectangular area with the selected tile. Click and drag to define
// the area; tiles are placed when you release. Shortcut: **R**.

import { BaseTool } from './BaseTool.js';
import { PaintTilesCommand } from '../CommandStack.js';

export class RectangleFillTool extends BaseTool {
  constructor(editor) {
    super('rectangleFill', editor);
    this._dragging = false;
    this._startTile = null;  // {x, y} of drag origin
    this._endTile = null;    // {x, y} of current drag end
    this._cursorTile = null; // hover position when not dragging
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
    this._fillRect();
    this._startTile = null;
    this._endTile = null;
  }

  _fillRect() {
    const layer = this._getActiveLayer();
    if (!layer) return;

    const gid = this._getSelectedGid();
    if (gid === 0) return;

    if (!this._startTile || !this._endTile) return;

    // Handle any drag direction by computing min/max
    const minX = Math.min(this._startTile.x, this._endTile.x);
    const maxX = Math.max(this._startTile.x, this._endTile.x);
    const minY = Math.min(this._startTile.y, this._endTile.y);
    const maxY = Math.max(this._startTile.y, this._endTile.y);

    const tiles = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const oldGid = layer.get(x, y);
        if (oldGid === gid) continue; // no change needed
        tiles.push({ x, y, oldGid, newGid: gid });
      }
    }

    if (tiles.length === 0) return;

    const cmd = new PaintTilesCommand(layer, tiles);
    this.editor.mapDocument.commandStack.execute(cmd);
  }

  _getActiveLayer() {
    if (!this.editor.mapDocument) return null;
    return this.editor.mapDocument.getLayer(this.editor.activeLayerName || 'Ground');
  }

  _getSelectedGid() {
    if (this.editor.selectedGid) return this.editor.selectedGid;
    return 0;
  }

  renderPreview(ctx, viewTransform) {
    const tileSize = 16;

    // When dragging, show the rectangle that will be filled
    if (this._dragging && this._startTile && this._endTile) {
      const minX = Math.min(this._startTile.x, this._endTile.x);
      const maxX = Math.max(this._startTile.x, this._endTile.x);
      const minY = Math.min(this._startTile.y, this._endTile.y);
      const maxY = Math.max(this._startTile.y, this._endTile.y);

      const topLeft = viewTransform.worldToScreen(minX * tileSize, minY * tileSize);
      const w = (maxX - minX + 1) * tileSize * viewTransform.zoom;
      const h = (maxY - minY + 1) * tileSize * viewTransform.zoom;

      // Semi-transparent fill
      ctx.fillStyle = 'rgba(0, 204, 255, 0.15)';
      ctx.fillRect(topLeft.x, topLeft.y, w, h);

      // Cyan outline
      ctx.strokeStyle = '#00ccff';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(topLeft.x) + 0.5,
        Math.round(topLeft.y) + 0.5,
        Math.round(w) - 1,
        Math.round(h) - 1,
      );
      return;
    }

    // When hovering (not dragging), show single-tile cursor
    if (!this._cursorTile) return;

    const gid = this._getSelectedGid();
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
