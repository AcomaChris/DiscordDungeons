# Map Editor

<!-- @doc-auto-start -->
### Layers

<sub>Source: `client/src/map-editor/LayerPanel.js`</sub>

Switch between map layers using the layer panel or number keys `1`-`7`.
Standard layers: **Ground**, **GroundDecor**, **Walls**, **WallTops**,
**Overlay**, **Collision**, **Elevation**. Each layer has a visibility
toggle and opacity slider.

### Overview

<sub>Source: `client/src/map-editor/MapEditor.js`</sub>

The map editor creates **Tiled-compatible JSON maps** for use in the game.
Access it via the cog menu → **Map Editor**, or directly at `/map-editor.html`.
Supports multiple layers, object placement, undo/redo, and import/export.
Maps follow the standard layer convention (Ground, GroundDecor, Walls, WallTops, Overlay, Collision, Objects).

### Import and Export

<sub>Source: `client/src/map-editor/MapExporter.js`</sub>

**Export** maps as Tiled JSON format (`Ctrl+S` or the export button).
**Import** existing Tiled JSON files to continue editing. Also supports
creating new blank maps and auto-populating the **Collision** layer from
wall tiles.

### Tile Palette

<sub>Source: `client/src/map-editor/TilePalette.js`</sub>

Browse and select tiles from loaded tilesets. Click a tile to select it
for painting. Drag to select a rectangular multi-tile stamp. Use the
tileset dropdown to switch between available tilesets.

### Keyboard Shortcuts

<sub>Source: `client/src/map-editor/ToolBar.js`</sub>

| Shortcut | Action |
|---|---|
| `B` | **Brush** tool |
| `E` | **Eraser** tool |
| `R` | **Rectangle Fill** tool |
| `G` | **Flood Fill** tool |
| `L` | **Line** tool |
| `S` | **Select** tool |
| `O` | **Object** tool |
| `1`-`7` | Quick layer switch |
| `Ctrl+S` | Export map |
| `Ctrl+G` | Toggle grid |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Space+Click` | Pan the viewport |
| `Scroll` | Zoom in/out |

### Brush Tool

<sub>Source: `client/src/map-editor/tools/BrushTool.js`</sub>

Paint tiles on the active layer. Select a tile from the **Tile Palette**,
then click or drag to paint. Handles fast mouse movement without gaps.
Shortcut: **B**.

### Eraser Tool

<sub>Source: `client/src/map-editor/tools/EraserTool.js`</sub>

Remove tiles from the active layer. Click or drag to erase.
Shortcut: **E**.

### Flood Fill

<sub>Source: `client/src/map-editor/tools/FloodFillTool.js`</sub>

Fill connected tiles of the same type with the selected tile.
Click any tile to flood-fill outward from that point. Shortcut: **G**.

### Line Tool

<sub>Source: `client/src/map-editor/tools/LineTool.js`</sub>

Draw a straight line of tiles. Click to set the start point, drag to the
endpoint, and release to place. Shortcut: **L**.

### Object Tool

<sub>Source: `client/src/map-editor/tools/ObjectTool.js`</sub>

Place interactive objects (spawn points, doors, chests, NPCs, etc.) on the
**Objects** layer. Select an object type from the palette, then click to
place. Click existing objects to select, drag to move. Shortcut: **O**.

### Rectangle Fill

<sub>Source: `client/src/map-editor/tools/RectangleFillTool.js`</sub>

Fill a rectangular area with the selected tile. Click and drag to define
the area; tiles are placed when you release. Shortcut: **R**.

### Select Tool

<sub>Source: `client/src/map-editor/tools/SelectTool.js`</sub>

Select rectangular tile regions. Click and drag to select, then use
`Ctrl+C`/`Ctrl+X`/`Ctrl+V` to copy, cut, and paste. Press `Delete` to
clear the selection. Shortcut: **S**.

<!-- @doc-auto-end -->
