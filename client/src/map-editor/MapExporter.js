// --- MapExporter ---
// Export MapDocument to Tiled JSON format and import Tiled JSON back into a MapDocument.

// @doc-creator-tools 01:Map Editor > Import and Export
// **Export** maps as Tiled JSON format (`Ctrl+S` or the export button).
// **Import** existing Tiled JSON files to continue editing. Also supports
// creating new blank maps and auto-populating the **Collision** layer from
// wall tiles.

import { ALL_LAYER_NAMES } from './MapDocument.js';

// --- Export ---

export function exportToTiledJSON(mapDocument) {
  const bounds = mapDocument.getGlobalBounds();
  const { minX, minY, width, height } = bounds;
  const { tileWidth, tileHeight } = mapDocument.metadata;

  const layers = [];

  // Build tile layers from the fixed layer list
  for (const name of ALL_LAYER_NAMES) {
    const layer = mapDocument.getLayer(name);
    if (!layer || layer.size === 0) continue;

    const data = layer.toDenseArray(minX, minY, width, height);

    layers.push({
      name,
      type: 'tilelayer',
      width,
      height,
      x: 0,
      y: 0,
      visible: true,
      opacity: 1,
      data,
    });
  }

  // Build object layer if any objects exist
  if (mapDocument.objects.length > 0) {
    const objects = mapDocument.objects.map(obj => ({
      id: obj.id,
      name: obj.name || '',
      type: obj.type || '',
      x: obj.x,
      y: obj.y,
      width: obj.width || 0,
      height: obj.height || 0,
      visible: obj.visible !== undefined ? obj.visible : true,
      ...(obj.properties ? { properties: obj.properties } : {}),
    }));

    layers.push({
      name: 'Objects',
      type: 'objectgroup',
      objects,
    });
  }

  // Build tileset references
  const tilesets = mapDocument.tilesets.map(ts => ({
    firstgid: ts.firstgid,
    name: ts.name,
    source: ts.imagePath || `tilesets/${ts.name}.tsx`,
  }));

  return {
    width,
    height,
    tilewidth: tileWidth,
    tileheight: tileHeight,
    orientation: 'orthogonal',
    renderorder: 'right-down',
    type: 'map',
    version: '1.10',
    tiledversion: '1.10.0',
    infinite: false,
    tilesets,
    layers,
  };
}

// --- Import ---

export function importFromTiledJSON(json, mapDocument) {
  mapDocument.reset();

  // Collect tileset names for the caller to load
  const tilesetNames = (json.tilesets || []).map(ts => ts.name || ts.source);

  const width = json.width;
  const height = json.height;

  for (const layerDef of (json.layers || [])) {
    if (layerDef.type === 'tilelayer') {
      const layer = mapDocument.getLayer(layerDef.name);
      if (!layer) continue; // Skip unknown layer names

      const data = layerDef.data;
      for (let i = 0; i < data.length; i++) {
        const gid = data[i];
        if (gid === 0) continue;
        const col = i % width;
        const row = Math.floor(i / width);
        layer.set(col, row, gid);
      }
    } else if (layerDef.type === 'objectgroup') {
      for (const obj of (layerDef.objects || [])) {
        mapDocument.addObject({
          id: obj.id,
          name: obj.name || '',
          type: obj.type || '',
          x: obj.x,
          y: obj.y,
          width: obj.width || 0,
          height: obj.height || 0,
          visible: obj.visible !== undefined ? obj.visible : true,
          ...(obj.properties ? { properties: obj.properties } : {}),
        });
      }
    }
  }

  return { tilesetNames, width, height };
}

// --- Download helper ---

export function downloadJSON(obj, filename) {
  const jsonStr = JSON.stringify(obj, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // Cleanup after the browser has started the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
