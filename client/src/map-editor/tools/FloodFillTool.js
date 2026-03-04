// --- FloodFillTool ---
// Paint-bucket tool: BFS flood fill from the clicked tile, replacing all
// contiguous tiles that share the same GID with the selected tile.

import { BaseTool } from './BaseTool.js';
import { PaintTilesCommand } from '../CommandStack.js';

// --- Flood fill algorithm ---
// Exported separately for testability. Returns an array of {x, y, oldGid, newGid}
// changes, or an empty array if the fill would be a no-op.
export function floodFill(layer, startX, startY, newGid, maxTiles = 10000) {
  const targetGid = layer.get(startX, startY);

  // No-op if the target is already the fill color
  if (targetGid === newGid) return [];

  const changes = [];
  const visited = new Set();
  const queue = [{ x: startX, y: startY }];
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    if (changes.length >= maxTiles) return null; // signal limit exceeded

    const { x, y } = queue.shift();

    // Only fill tiles matching the original target GID
    if (layer.get(x, y) !== targetGid) continue;

    changes.push({ x, y, oldGid: targetGid, newGid });

    // 4-directional neighbors
    const neighbors = [
      { x: x - 1, y },
      { x: x + 1, y },
      { x, y: y - 1 },
      { x, y: y + 1 },
    ];

    for (const n of neighbors) {
      const key = `${n.x},${n.y}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (layer.get(n.x, n.y) === targetGid) {
        queue.push(n);
      }
    }
  }

  return changes;
}

export class FloodFillTool extends BaseTool {
  constructor(editor) {
    super('floodFill', editor);
    this._cursorTile = null;
  }

  onMouseDown(_worldX, _worldY, tileX, tileY, event) {
    if (event.button !== 0) return;

    const layer = this._getActiveLayer();
    if (!layer) return;

    const newGid = this.editor.selectedGid;
    if (newGid == null) return;

    const result = floodFill(layer, tileX, tileY, newGid);

    if (result === null) {
      // Exceeded safety limit
      this.editor.showToast('Flood fill stopped: region exceeds 10,000 tiles');
      return;
    }

    if (result.length === 0) return;

    const cmd = new PaintTilesCommand(layer, result);
    this.editor.mapDocument.commandStack.execute(cmd);
  }

  onMouseMove(_worldX, _worldY, tileX, tileY, _event) {
    this._cursorTile = { x: tileX, y: tileY };
  }

  onMouseUp(_worldX, _worldY, _tileX, _tileY, _event) {
    // No drag behavior — fill happens entirely on mousedown
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

    // Cursor outline
    ctx.strokeStyle = '#00ccff';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(s) - 1, Math.round(s) - 1);
  }
}
