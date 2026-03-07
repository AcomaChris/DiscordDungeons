# Scripts

<!-- @doc-auto-start -->
### analyze-tileset

<sub>Source: `scripts/analyze-tileset.js`</sub>

Multi-step tileset analysis pipeline. Detects tile size, extracts individual
tiles, groups multi-tile objects, and generates catalog sheets.
Usage: `node scripts/analyze-tileset.js <tileset-name> [--step <1-5>]`.
Output: `tmp/tile-analysis/<tileset>/`.

### convert-tmx

<sub>Source: `scripts/convert-tmx.js`</sub>

Converts Tiled `.tmx` files (infinite/chunk format) to finite Tiled JSON
compatible with the game engine. Merges TMX layers into standard game layer
names (Ground, Walls, etc.). Usage: `node scripts/convert-tmx.js`.

### create-test-map

<sub>Source: `scripts/create-test-map.js`</sub>

Generates a minimal 30x20 test map with a 9-tile tileset. Includes animated
floor, static floor, walls, wall tops, elevated platform, and elevation data.
Output: `client/public/maps/test.json` + `client/public/tilesets/test-tiles.png`.
Usage: `node scripts/create-test-map.js`.

### import-tilesets

<sub>Source: `scripts/import-tilesets.js`</sub>

Copies tileset PNGs to `client/public/tilesets/` and scaffolds metadata
JSON files for the tile editor. Idempotent -- skips existing metadata,
overwrites PNGs. Usage: `node scripts/import-tilesets.js`.

<!-- @doc-auto-end -->
