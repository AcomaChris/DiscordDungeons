// --- BaseTool ---
// Base class for all map editor tools. Defines the interface that
// MapEditorCanvas dispatches to.

export class BaseTool {
  constructor(name, editor) {
    this.name = name;
    this.editor = editor; // MapEditor reference for accessing document, palette, etc.
  }

  // Called when this tool becomes the active tool
  activate() {}

  // Called when switching away from this tool
  deactivate() {}

  // Mouse events — coordinates are provided in both world pixels and tile grid
  onMouseDown(worldX, worldY, tileX, tileY, event) {}
  onMouseMove(worldX, worldY, tileX, tileY, event) {}
  onMouseUp(worldX, worldY, tileX, tileY, event) {}

  // Render tool-specific overlay (cursor preview, drag rect, etc.)
  renderPreview(ctx, viewTransform) {}

  // Keyboard events
  onKeyDown(event) {}
  onKeyUp(event) {}
}
