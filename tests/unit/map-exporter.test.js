// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { MapDocument } from '../../client/src/map-editor/MapDocument.js';
import { exportToTiledJSON, importFromTiledJSON } from '../../client/src/map-editor/MapExporter.js';

// --- Test helpers ---

function makeDocument() {
  const doc = new MapDocument();
  doc.addTileset({
    name: 'test', image: null, imagePath: 'tilesets/test.png',
    columns: 4, rows: 4, tileCount: 16,
    tileWidth: 16, tileHeight: 16,
  });
  return doc;
}

// --- Export ---

describe('exportToTiledJSON', () => {
  let doc;

  beforeEach(() => {
    doc = makeDocument();
  });

  it('exports correct top-level structure', () => {
    doc.getLayer('Ground').set(0, 0, 1);
    const json = exportToTiledJSON(doc);

    expect(json.type).toBe('map');
    expect(json.orientation).toBe('orthogonal');
    expect(json.tilewidth).toBe(16);
    expect(json.tileheight).toBe(16);
    expect(json.infinite).toBe(false);
    expect(json.version).toBe('1.10');
  });

  it('exports tile layers with correct dense data', () => {
    const ground = doc.getLayer('Ground');
    ground.set(0, 0, 1);
    ground.set(1, 0, 2);
    ground.set(0, 1, 3);
    ground.set(1, 1, 4);

    const json = exportToTiledJSON(doc);
    const layer = json.layers.find(l => l.name === 'Ground');

    expect(layer).toBeDefined();
    expect(layer.type).toBe('tilelayer');
    expect(layer.width).toBe(2);
    expect(layer.height).toBe(2);
    expect(layer.data).toEqual([1, 2, 3, 4]);
  });

  it('skips empty layers', () => {
    doc.getLayer('Ground').set(0, 0, 1);
    const json = exportToTiledJSON(doc);

    const layerNames = json.layers.map(l => l.name);
    expect(layerNames).toContain('Ground');
    expect(layerNames).not.toContain('Walls');
    expect(layerNames).not.toContain('GroundDecor');
  });

  it('includes multiple non-empty layers', () => {
    doc.getLayer('Ground').set(0, 0, 1);
    doc.getLayer('Walls').set(0, 0, 5);

    const json = exportToTiledJSON(doc);
    const layerNames = json.layers.map(l => l.name);

    expect(layerNames).toContain('Ground');
    expect(layerNames).toContain('Walls');
  });

  it('exports tileset references', () => {
    doc.getLayer('Ground').set(0, 0, 1);
    const json = exportToTiledJSON(doc);

    expect(json.tilesets.length).toBe(1);
    expect(json.tilesets[0].firstgid).toBe(1);
    expect(json.tilesets[0].name).toBe('test');
  });

  it('trims bounding box to only used tiles', () => {
    const ground = doc.getLayer('Ground');
    // Place tiles at offset (5,3) and (7,5)
    ground.set(5, 3, 1);
    ground.set(7, 5, 2);

    const json = exportToTiledJSON(doc);
    const layer = json.layers.find(l => l.name === 'Ground');

    // Bounding box: 5..7, 3..5 → width=3, height=3
    expect(layer.width).toBe(3);
    expect(layer.height).toBe(3);

    // data[0] = tile at (5,3) = 1
    expect(layer.data[0]).toBe(1);
    // data[8] = tile at (7,5), index = (5-3)*3 + (7-5) = 2*3 + 2 = 8
    expect(layer.data[8]).toBe(2);
  });

  it('exports objects as objectgroup layer', () => {
    doc.getLayer('Ground').set(0, 0, 1);
    doc.addObject({
      name: 'spawn',
      type: 'spawn',
      x: 32,
      y: 48,
      width: 16,
      height: 16,
    });

    const json = exportToTiledJSON(doc);
    const objLayer = json.layers.find(l => l.type === 'objectgroup');

    expect(objLayer).toBeDefined();
    expect(objLayer.name).toBe('Objects');
    expect(objLayer.objects.length).toBe(1);
    expect(objLayer.objects[0].name).toBe('spawn');
    expect(objLayer.objects[0].x).toBe(32);
    expect(objLayer.objects[0].y).toBe(48);
  });

  it('omits object layer when no objects', () => {
    doc.getLayer('Ground').set(0, 0, 1);
    const json = exportToTiledJSON(doc);
    const objLayer = json.layers.find(l => l.type === 'objectgroup');
    expect(objLayer).toBeUndefined();
  });

  it('handles multi-tileset firstgids', () => {
    doc.addTileset({
      name: 'test2', image: null, imagePath: 'tilesets/test2.png',
      columns: 4, rows: 4, tileCount: 16,
      tileWidth: 16, tileHeight: 16,
    });
    doc.getLayer('Ground').set(0, 0, 17); // first tile of second tileset

    const json = exportToTiledJSON(doc);

    expect(json.tilesets.length).toBe(2);
    expect(json.tilesets[0].firstgid).toBe(1);
    expect(json.tilesets[1].firstgid).toBe(17);
  });
});

// --- Import ---

describe('importFromTiledJSON', () => {
  let doc;

  beforeEach(() => {
    doc = makeDocument();
  });

  it('imports tile layer data', () => {
    const json = {
      width: 2,
      height: 2,
      tilesets: [{ name: 'test', firstgid: 1 }],
      layers: [{
        name: 'Ground',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [1, 2, 3, 4],
      }],
    };

    importFromTiledJSON(json, doc);
    const ground = doc.getLayer('Ground');

    expect(ground.get(0, 0)).toBe(1);
    expect(ground.get(1, 0)).toBe(2);
    expect(ground.get(0, 1)).toBe(3);
    expect(ground.get(1, 1)).toBe(4);
  });

  it('skips GID 0 (empty) tiles', () => {
    const json = {
      width: 2,
      height: 1,
      tilesets: [],
      layers: [{
        name: 'Ground',
        type: 'tilelayer',
        width: 2,
        height: 1,
        data: [0, 5],
      }],
    };

    importFromTiledJSON(json, doc);
    const ground = doc.getLayer('Ground');

    expect(ground.get(0, 0)).toBe(0);
    expect(ground.get(1, 0)).toBe(5);
    expect(ground.size).toBe(1);
  });

  it('imports objects from objectgroup', () => {
    const json = {
      width: 10,
      height: 10,
      tilesets: [],
      layers: [{
        name: 'Objects',
        type: 'objectgroup',
        objects: [
          { id: 1, name: 'spawn', type: 'spawn', x: 32, y: 48, width: 16, height: 16 },
          { id: 2, name: 'door', type: 'door', x: 64, y: 80 },
        ],
      }],
    };

    importFromTiledJSON(json, doc);

    expect(doc.objects.length).toBe(2);
    expect(doc.objects[0].name).toBe('spawn');
    expect(doc.objects[0].x).toBe(32);
    expect(doc.objects[1].name).toBe('door');
    expect(doc.objects[1].type).toBe('door');
  });

  it('skips unknown layer names', () => {
    const json = {
      width: 2,
      height: 2,
      tilesets: [],
      layers: [{
        name: 'UnknownLayer',
        type: 'tilelayer',
        width: 2,
        height: 2,
        data: [1, 2, 3, 4],
      }],
    };

    // Should not throw
    importFromTiledJSON(json, doc);
  });

  it('resets document before importing', () => {
    doc.getLayer('Ground').set(5, 5, 10);
    doc.addObject({ name: 'old', type: 'old', x: 0, y: 0, width: 16, height: 16 });

    const json = {
      width: 1,
      height: 1,
      tilesets: [],
      layers: [{
        name: 'Ground',
        type: 'tilelayer',
        width: 1,
        height: 1,
        data: [3],
      }],
    };

    importFromTiledJSON(json, doc);

    // Old data should be gone
    expect(doc.getLayer('Ground').get(5, 5)).toBe(0);
    expect(doc.objects.length).toBe(0);
    // New data present
    expect(doc.getLayer('Ground').get(0, 0)).toBe(3);
  });

  it('returns tileset names for loading', () => {
    const json = {
      width: 1,
      height: 1,
      tilesets: [
        { name: 'Interior_1st_floor', firstgid: 1 },
        { name: 'Walls_interior', firstgid: 100 },
      ],
      layers: [],
    };

    const result = importFromTiledJSON(json, doc);
    expect(result.tilesetNames).toEqual(['Interior_1st_floor', 'Walls_interior']);
  });

  it('imports multiple tile layers', () => {
    const json = {
      width: 2,
      height: 1,
      tilesets: [],
      layers: [
        { name: 'Ground', type: 'tilelayer', width: 2, height: 1, data: [1, 2] },
        { name: 'Walls', type: 'tilelayer', width: 2, height: 1, data: [3, 0] },
      ],
    };

    importFromTiledJSON(json, doc);

    expect(doc.getLayer('Ground').get(0, 0)).toBe(1);
    expect(doc.getLayer('Ground').get(1, 0)).toBe(2);
    expect(doc.getLayer('Walls').get(0, 0)).toBe(3);
    expect(doc.getLayer('Walls').get(1, 0)).toBe(0);
  });
});

// --- Round-trip ---

describe('round-trip export → import', () => {
  it('preserves tile data through export/import cycle', () => {
    const doc1 = makeDocument();
    const ground = doc1.getLayer('Ground');
    ground.set(0, 0, 1);
    ground.set(1, 0, 5);
    ground.set(0, 1, 3);
    ground.set(2, 2, 8);

    const walls = doc1.getLayer('Walls');
    walls.set(0, 0, 10);
    walls.set(1, 1, 12);

    // Export
    const json = exportToTiledJSON(doc1);

    // Import into fresh document
    const doc2 = makeDocument();
    importFromTiledJSON(json, doc2);

    // Verify tile data matches
    const g2 = doc2.getLayer('Ground');
    expect(g2.get(0, 0)).toBe(1);
    expect(g2.get(1, 0)).toBe(5);
    expect(g2.get(0, 1)).toBe(3);
    expect(g2.get(2, 2)).toBe(8);

    const w2 = doc2.getLayer('Walls');
    expect(w2.get(0, 0)).toBe(10);
    expect(w2.get(1, 1)).toBe(12);
  });

  it('preserves objects through export/import cycle', () => {
    const doc1 = makeDocument();
    doc1.getLayer('Ground').set(0, 0, 1); // need at least one tile for bounds
    doc1.addObject({
      name: 'spawn',
      type: 'spawn',
      x: 48,
      y: 64,
      width: 16,
      height: 16,
    });

    const json = exportToTiledJSON(doc1);
    const doc2 = makeDocument();
    importFromTiledJSON(json, doc2);

    expect(doc2.objects.length).toBe(1);
    expect(doc2.objects[0].name).toBe('spawn');
    expect(doc2.objects[0].type).toBe('spawn');
    expect(doc2.objects[0].x).toBe(48);
    expect(doc2.objects[0].y).toBe(64);
  });

  it('preserves __components and __connections through export/import cycle', () => {
    const doc1 = makeDocument();
    doc1.getLayer('Ground').set(0, 0, 1);

    const components = JSON.stringify([
      { id: 'door', isOpen: false, lockId: 'key_01' },
      { id: 'interactable', promptText: 'Open Door' },
    ]);
    const connections = JSON.stringify([
      { name: 'link1', targetId: 'lever1', event: 'switch:toggled' },
    ]);

    doc1.addObject({
      name: 'test_door',
      type: 'door',
      x: 32,
      y: 48,
      width: 16,
      height: 16,
      properties: {
        __components: components,
        __connections: connections,
        customProp: 'hello',
      },
    });

    const json = exportToTiledJSON(doc1);
    const doc2 = makeDocument();
    importFromTiledJSON(json, doc2);

    expect(doc2.objects.length).toBe(1);
    const imported = doc2.objects[0];
    expect(imported.properties.__components).toBe(components);
    expect(imported.properties.__connections).toBe(connections);
    expect(imported.properties.customProp).toBe('hello');
  });

  it('produces identical JSON on double export', () => {
    const doc1 = makeDocument();
    doc1.getLayer('Ground').set(0, 0, 1);
    doc1.getLayer('Ground').set(3, 2, 7);
    doc1.getLayer('GroundDecor').set(1, 1, 4);

    const json1 = exportToTiledJSON(doc1);

    const doc2 = makeDocument();
    importFromTiledJSON(json1, doc2);
    const json2 = exportToTiledJSON(doc2);

    // Compare structure (excluding tilesets since they're reset on import)
    expect(json2.width).toBe(json1.width);
    expect(json2.height).toBe(json1.height);
    expect(json2.layers.length).toBe(json1.layers.length);

    for (let i = 0; i < json1.layers.length; i++) {
      expect(json2.layers[i].name).toBe(json1.layers[i].name);
      expect(json2.layers[i].data).toEqual(json1.layers[i].data);
    }
  });
});
