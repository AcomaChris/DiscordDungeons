# Maps

<!-- @doc-auto-start -->
### Map Registry

<sub>Source: `client/src/map/MapRegistry.js`</sub>

Register maps here so the game can load them. Each entry defines:
```js
mapId: {
  instanced: false,       // true = per-party instance, false = shared hub
  jsonPath: 'maps/my-map.json',  // path to Tiled JSON (relative to public/)
  tilesets: [
    { key: 'my-tiles', path: 'tilesets/my-tiles.png', tiledName: 'my-tiles',
      tileSize: 16, hasAnimationJson: false }
  ]
}
```
`tiledName` must match the tileset name in your Tiled project. Set `hasAnimationJson: true`
if the tileset has an extracted `.animations.json` file for tile animations.

### Layer Convention

<sub>Source: `client/src/map/TileMapManager.js`</sub>

All Tiled maps must use these layer names (case-sensitive):
| Layer | Type | Depth | Purpose |
|-------|------|-------|---------|
| `Ground` | tile | 0 | Floor/terrain base |
| `GroundDecor` | tile | 1 | Rugs, cracks, floor details |
| `Walls` | tile | 2 | Furniture, wall bases, props |
| `WallTops` | tile | 10000 | Upper wall parts (rendered above player) |
| `Overlay` | tile | 10001 | Ceiling, always-on-top decor |
| `Collision` | tile | hidden | Invisible collision mask (any tile = blocked) |
| `Elevation` | tile | hidden | Per-tile height data (tile index = elevation level) |
| `Objects` | object | parsed | Interactive objects (`spawn`, `door`, `chest`, etc.) |

AGENT: layer names are case-sensitive and must match the Tiled export.

<!-- @doc-auto-end -->
