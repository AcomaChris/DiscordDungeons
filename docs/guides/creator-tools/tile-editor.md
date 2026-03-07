# Tile Editor

<!-- @doc-auto-start -->
### Object Mode

<sub>Source: `client/src/tile-editor/ObjectEditorCanvas.js`</sub>

Visual editor for defining multi-tile objects from tilesets. Select tile
groups with `Shift+drag`, name them, and assign categories (furniture,
structure, decoration, etc.). Defined objects can be placed in the map editor.

### Overview

<sub>Source: `client/src/tile-editor/TileEditor.js`</sub>

The tile editor manages tileset metadata and object definitions.
Access via the cog menu → **Tile Editor**, or directly at `/editor.html`.
Two modes: **Tile Mode** (edit per-tile properties like collision and category)
and **Object Mode** (define multi-tile objects from tilesets).

### Tile Mode

<sub>Source: `client/src/tile-editor/TileEditorCanvas.js`</sub>

Displays the tileset image with a selection overlay. Click tiles to select
them for property editing. Use the zoom slider for precise work. Shows
tile index and coordinates for the hovered tile.

<!-- @doc-auto-end -->
