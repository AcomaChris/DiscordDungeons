// --- ObjectTool ---
// Object placement and manipulation tool. Places new objects from the
// ObjectPalette selection, or picks/moves/deletes existing objects on the map.

import { BaseTool } from './BaseTool.js';
import { PlaceObjectCommand, MoveObjectCommand, DeleteObjectCommand } from '../CommandStack.js';

export class ObjectTool extends BaseTool {
  constructor(editor) {
    super('object', editor);
    this._selectedObject = null;
    this._dragging = false;
    this._dragOffset = { x: 0, y: 0 };
    this._cursorWorld = { x: 0, y: 0 };
    // Stash the position at drag start so we can detect if it actually moved
    this._dragStartX = 0;
    this._dragStartY = 0;
  }

  activate() {
    this._selectedObject = null;
    this._dragging = false;
  }

  deactivate() {
    this._dragging = false;
  }

  // --- Grid snap ---

  _snap(val) {
    return Math.round(val / 16) * 16;
  }

  // --- Mouse events ---

  onMouseDown(worldX, worldY, _tileX, _tileY, event) {
    if (event.button !== 0) return;

    const objectDef = this.editor.selectedObjectDef;

    // Placement mode — objectDef selected from palette
    if (objectDef) {
      this._placeObject(objectDef, worldX, worldY);
      return;
    }

    // Selection/drag mode — try to pick an existing object
    const hit = this._hitTest(worldX, worldY);
    if (hit) {
      this._selectedObject = hit;
      this._dragging = true;
      this._dragOffset = {
        x: worldX - hit.x,
        y: worldY - hit.y,
      };
      this._dragStartX = hit.x;
      this._dragStartY = hit.y;
    } else {
      this._selectedObject = null;
    }
    if (this.onSelectionChange) this.onSelectionChange(this._selectedObject);
  }

  onMouseMove(worldX, worldY, _tileX, _tileY, _event) {
    this._cursorWorld = { x: worldX, y: worldY };

    if (!this._dragging || !this._selectedObject) return;

    let newX = worldX - this._dragOffset.x;
    let newY = worldY - this._dragOffset.y;

    if (this.editor.snapToGrid) {
      newX = this._snap(newX);
      newY = this._snap(newY);
    }

    // Move immediately for visual feedback (command issued on release)
    this._selectedObject.x = newX;
    this._selectedObject.y = newY;
  }

  onMouseUp(_worldX, _worldY, _tileX, _tileY, _event) {
    if (!this._dragging || !this._selectedObject) return;

    this._dragging = false;

    const newX = this._selectedObject.x;
    const newY = this._selectedObject.y;

    // Only issue a command if the object actually moved
    if (newX !== this._dragStartX || newY !== this._dragStartY) {
      // Reset to original position so the command's execute() applies the move
      this._selectedObject.x = this._dragStartX;
      this._selectedObject.y = this._dragStartY;

      const cmd = new MoveObjectCommand(
        this._selectedObject,
        this._dragStartX, this._dragStartY,
        newX, newY,
      );
      this.editor.mapDocument.commandStack.execute(cmd);
    }
  }

  // --- Keyboard events ---

  onKeyDown(event) {
    if (event.key === 'Delete' && this._selectedObject) {
      const cmd = new DeleteObjectCommand(this.editor.mapDocument, this._selectedObject);
      this.editor.mapDocument.commandStack.execute(cmd);
      this._selectedObject = null;
      if (this.onSelectionChange) this.onSelectionChange(null);
    }
  }

  // --- Object placement ---

  _placeObject(objectDef, worldX, worldY) {
    let x = worldX;
    let y = worldY;

    if (this.editor.snapToGrid) {
      x = this._snap(x);
      y = this._snap(y);
    }

    const obj = {
      id: 0,
      type: objectDef.name,
      defId: objectDef.id,
      tilesetName: this.editor.selectedObjectTileset.name,
      x,
      y,
      width: objectDef.width * 16,
      height: objectDef.height * 16,
    };

    const cmd = new PlaceObjectCommand(this.editor.mapDocument, obj);
    this.editor.mapDocument.commandStack.execute(cmd);
    this._selectedObject = obj;
    if (this.onSelectionChange) this.onSelectionChange(obj);
  }

  // --- Hit testing ---

  _hitTest(worldX, worldY) {
    const objects = this.editor.mapDocument?.objects;
    if (!objects) return null;

    // Iterate in reverse so topmost (last-added) objects are picked first
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (
        worldX >= obj.x && worldX < obj.x + obj.width &&
        worldY >= obj.y && worldY < obj.y + obj.height
      ) {
        return obj;
      }
    }
    return null;
  }

  // --- Preview rendering ---

  renderPreview(ctx, viewTransform) {
    const tileSize = 16;
    const objectDef = this.editor.selectedObjectDef;

    if (objectDef) {
      // Placement ghost preview at cursor
      this._renderGhostPreview(ctx, viewTransform, tileSize, objectDef);
    } else if (this._selectedObject) {
      // Selection outline for the selected object
      this._renderSelectionOutline(ctx, viewTransform, this._selectedObject);
    }
  }

  _renderGhostPreview(ctx, viewTransform, tileSize, objectDef) {
    let x = this._cursorWorld.x;
    let y = this._cursorWorld.y;

    if (this.editor.snapToGrid) {
      x = this._snap(x);
      y = this._snap(y);
    }

    const tileset = this.editor.selectedObjectTileset;
    if (!tileset?.image || !objectDef.tiles) return;

    ctx.globalAlpha = 0.5;
    ctx.imageSmoothingEnabled = false;

    // objectDef.tiles is a 2D array: tiles[row][col] = {col: srcCol, row: srcRow}
    for (let r = 0; r < objectDef.tiles.length; r++) {
      for (let c = 0; c < objectDef.tiles[r].length; c++) {
        const tile = objectDef.tiles[r][c];
        if (!tile) continue;

        const wx = x + c * tileSize;
        const wy = y + r * tileSize;
        const screen = viewTransform.worldToScreen(wx, wy);
        const s = tileSize * viewTransform.zoom;

        ctx.drawImage(
          tileset.image,
          tile.col * tileSize, tile.row * tileSize, tileSize, tileSize,
          screen.x, screen.y, s, s,
        );
      }
    }

    ctx.globalAlpha = 1.0;

    // Outline around the ghost
    const screen = viewTransform.worldToScreen(x, y);
    const w = objectDef.width * tileSize * viewTransform.zoom;
    const h = objectDef.height * tileSize * viewTransform.zoom;
    ctx.strokeStyle = '#00cc44';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      Math.round(screen.x) + 0.5, Math.round(screen.y) + 0.5,
      Math.round(w) - 1, Math.round(h) - 1,
    );
    ctx.setLineDash([]);
  }

  _renderSelectionOutline(ctx, viewTransform, obj) {
    const { x, y } = viewTransform.worldToScreen(obj.x, obj.y);
    const w = obj.width * viewTransform.zoom;
    const h = obj.height * viewTransform.zoom;

    ctx.strokeStyle = '#0078ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(
      Math.round(x) + 0.5, Math.round(y) + 0.5,
      Math.round(w) - 1, Math.round(h) - 1,
    );
    ctx.setLineDash([]);
  }
}
