// --- SelectTool ---
// Select rectangular regions, copy/cut/paste/delete tiles. Rubber-band
// selection on drag, clipboard operations via Ctrl+C/X/V and Delete.

import { BaseTool } from './BaseTool.js';
import { PaintTilesCommand, BatchCommand } from '../CommandStack.js';

export class SelectTool extends BaseTool {
  constructor(editor) {
    super('select', editor);
    this._dragging = false;
    this._startTile = null;   // {x, y} of drag origin
    this._endTile = null;     // {x, y} of drag end
    this._selection = null;   // {x1, y1, x2, y2} finalized selection (x1<=x2, y1<=y2)
    this._clipboard = null;   // {gids[][], cols, rows, sourceLayer}
    this._pasting = false;
    this._cursorTile = null;  // current hover position for paste preview
  }

  activate() {
    this._dragging = false;
    this._startTile = null;
    this._endTile = null;
    this._selection = null;
    this._clipboard = null;
    this._pasting = false;
    this._cursorTile = null;
  }

  deactivate() {
    this._dragging = false;
    this._pasting = false;
  }

  // --- Mouse events ---

  onMouseDown(_worldX, _worldY, tileX, tileY, event) {
    if (event.button !== 0) return;

    // Paste mode — place clipboard tiles at cursor
    if (this._pasting && this._clipboard) {
      this._placeClipboard(tileX, tileY);
      return;
    }

    // Start rubber-band selection
    this._dragging = true;
    this._startTile = { x: tileX, y: tileY };
    this._endTile = { x: tileX, y: tileY };
    this._selection = null;
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

    // Finalize selection with normalized bounds
    const x1 = Math.min(this._startTile.x, this._endTile.x);
    const y1 = Math.min(this._startTile.y, this._endTile.y);
    const x2 = Math.max(this._startTile.x, this._endTile.x);
    const y2 = Math.max(this._startTile.y, this._endTile.y);
    this._selection = { x1, y1, x2, y2 };

    this._startTile = null;
    this._endTile = null;
  }

  // --- Keyboard commands ---

  onKeyDown(event) {
    // Escape — clear selection/clipboard or exit paste mode
    if (event.key === 'Escape') {
      if (this._pasting) {
        this._pasting = false;
      } else {
        this._selection = null;
        this._clipboard = null;
      }
      return;
    }

    // Delete — clear selected tiles
    if (event.key === 'Delete' && this._selection) {
      this._clearSelection();
      return;
    }

    // Ctrl+C — copy
    if (event.key === 'c' && (event.ctrlKey || event.metaKey) && this._selection) {
      event.preventDefault();
      this._copySelection();
      return;
    }

    // Ctrl+X — cut (copy then clear)
    if (event.key === 'x' && (event.ctrlKey || event.metaKey) && this._selection) {
      event.preventDefault();
      this._copySelection();
      this._clearSelection();
      return;
    }

    // Ctrl+V — enter paste mode
    if (event.key === 'v' && (event.ctrlKey || event.metaKey) && this._clipboard) {
      event.preventDefault();
      this._pasting = true;
      return;
    }
  }

  // --- Clipboard operations ---

  _copySelection() {
    const layer = this._getActiveLayer();
    if (!layer || !this._selection) return;

    const { x1, y1, x2, y2 } = this._selection;
    const cols = x2 - x1 + 1;
    const rows = y2 - y1 + 1;
    const gids = [];

    for (let row = 0; row < rows; row++) {
      const rowData = [];
      for (let col = 0; col < cols; col++) {
        rowData.push(layer.get(x1 + col, y1 + row));
      }
      gids.push(rowData);
    }

    this._clipboard = {
      gids,
      cols,
      rows,
      sourceLayer: this.editor.activeLayerName || 'Ground',
    };
  }

  _clearSelection() {
    const layer = this._getActiveLayer();
    if (!layer || !this._selection) return;

    const { x1, y1, x2, y2 } = this._selection;
    const tiles = [];

    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const oldGid = layer.get(x, y);
        if (oldGid === 0) continue; // already empty
        tiles.push({ x, y, oldGid, newGid: 0 });
      }
    }

    if (tiles.length === 0) return;

    const cmd = new PaintTilesCommand(layer, tiles);
    this.editor.mapDocument.commandStack.execute(cmd);
  }

  _placeClipboard(tileX, tileY) {
    const layer = this._getActiveLayer();
    if (!layer || !this._clipboard) return;

    const { gids, cols, rows } = this._clipboard;
    const tiles = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const newGid = gids[row][col];
        const x = tileX + col;
        const y = tileY + row;
        const oldGid = layer.get(x, y);
        if (oldGid === newGid) continue; // no change
        tiles.push({ x, y, oldGid, newGid });
      }
    }

    if (tiles.length === 0) return;

    const cmd = new PaintTilesCommand(layer, tiles);
    this.editor.mapDocument.commandStack.execute(cmd);
  }

  // --- Helpers ---

  _getActiveLayer() {
    if (!this.editor.mapDocument) return null;
    return this.editor.mapDocument.getLayer(this.editor.activeLayerName || 'Ground');
  }

  // --- Preview rendering ---

  renderPreview(ctx, viewTransform) {
    const tileSize = 16;

    // Drawing rubber-band while dragging
    if (this._dragging && this._startTile && this._endTile) {
      const minX = Math.min(this._startTile.x, this._endTile.x);
      const maxX = Math.max(this._startTile.x, this._endTile.x);
      const minY = Math.min(this._startTile.y, this._endTile.y);
      const maxY = Math.max(this._startTile.y, this._endTile.y);

      const topLeft = viewTransform.worldToScreen(minX * tileSize, minY * tileSize);
      const w = (maxX - minX + 1) * tileSize * viewTransform.zoom;
      const h = (maxY - minY + 1) * tileSize * viewTransform.zoom;

      ctx.fillStyle = 'rgba(0, 120, 255, 0.15)';
      ctx.fillRect(topLeft.x, topLeft.y, w, h);

      ctx.strokeStyle = '#0078ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.round(topLeft.x) + 0.5,
        Math.round(topLeft.y) + 0.5,
        Math.round(w) - 1,
        Math.round(h) - 1,
      );
      return;
    }

    // Finalized selection — dashed outline
    if (this._selection && !this._pasting) {
      const { x1, y1, x2, y2 } = this._selection;

      const topLeft = viewTransform.worldToScreen(x1 * tileSize, y1 * tileSize);
      const w = (x2 - x1 + 1) * tileSize * viewTransform.zoom;
      const h = (y2 - y1 + 1) * tileSize * viewTransform.zoom;

      ctx.strokeStyle = '#0078ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        Math.round(topLeft.x) + 0.5,
        Math.round(topLeft.y) + 0.5,
        Math.round(w) - 1,
        Math.round(h) - 1,
      );
      ctx.setLineDash([]);
      return;
    }

    // Paste preview — ghost clipboard tiles at cursor
    if (this._pasting && this._clipboard && this._cursorTile) {
      const { gids, cols, rows } = this._clipboard;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const gid = gids[row][col];
          if (gid === 0) continue;

          const wx = (this._cursorTile.x + col) * tileSize;
          const wy = (this._cursorTile.y + row) * tileSize;
          const { x, y } = viewTransform.worldToScreen(wx, wy);
          const s = tileSize * viewTransform.zoom;

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
        }
      }

      // Outline around the paste region
      const topLeft = viewTransform.worldToScreen(
        this._cursorTile.x * tileSize,
        this._cursorTile.y * tileSize,
      );
      const w = cols * tileSize * viewTransform.zoom;
      const h = rows * tileSize * viewTransform.zoom;

      ctx.strokeStyle = '#00cc44';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        Math.round(topLeft.x) + 0.5,
        Math.round(topLeft.y) + 0.5,
        Math.round(w) - 1,
        Math.round(h) - 1,
      );
      ctx.setLineDash([]);
    }
  }
}
