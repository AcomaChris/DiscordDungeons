// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { BrushTool, bresenham } from '../../client/src/map-editor/tools/BrushTool.js';
import { EraserTool } from '../../client/src/map-editor/tools/EraserTool.js';
import { MapDocument } from '../../client/src/map-editor/MapDocument.js';

// --- Bresenham algorithm ---

describe('bresenham', () => {
  it('returns single point for same start and end', () => {
    expect(bresenham(3, 5, 3, 5)).toEqual([{ x: 3, y: 5 }]);
  });

  it('horizontal line', () => {
    const pts = bresenham(0, 0, 4, 0);
    expect(pts).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
      { x: 3, y: 0 }, { x: 4, y: 0 },
    ]);
  });

  it('vertical line', () => {
    const pts = bresenham(2, 1, 2, 4);
    expect(pts).toEqual([
      { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 },
    ]);
  });

  it('diagonal line', () => {
    const pts = bresenham(0, 0, 3, 3);
    expect(pts.length).toBe(4);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 3, y: 3 });
  });

  it('negative direction', () => {
    const pts = bresenham(3, 3, 0, 0);
    expect(pts.length).toBe(4);
    expect(pts[0]).toEqual({ x: 3, y: 3 });
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it('steep line', () => {
    const pts = bresenham(0, 0, 1, 5);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 1, y: 5 });
    // All points should be connected (no gaps > 1 in either axis)
    for (let i = 1; i < pts.length; i++) {
      expect(Math.abs(pts[i].x - pts[i - 1].x)).toBeLessThanOrEqual(1);
      expect(Math.abs(pts[i].y - pts[i - 1].y)).toBeLessThanOrEqual(1);
    }
  });

  it('includes both endpoints', () => {
    const pts = bresenham(2, 3, 7, 1);
    expect(pts[0]).toEqual({ x: 2, y: 3 });
    expect(pts[pts.length - 1]).toEqual({ x: 7, y: 1 });
  });
});

// --- Test helpers ---

function makeEditor() {
  const doc = new MapDocument();
  doc.addTileset({
    name: 'test', image: null, imagePath: 'test.png',
    columns: 4, rows: 4, tileCount: 16,
    tileWidth: 16, tileHeight: 16,
  });
  return {
    mapDocument: doc,
    activeLayerName: 'Ground',
    selectedGid: 1,
    selectedStamp: null,
  };
}

function mouseEvent(button = 0) {
  return { button };
}

// --- BrushTool ---

describe('BrushTool', () => {
  let editor, brush;

  beforeEach(() => {
    editor = makeEditor();
    brush = new BrushTool(editor);
    brush.activate();
  });

  it('paints a single tile on mousedown+mouseup', () => {
    editor.selectedGid = 5;
    brush.onMouseDown(0, 0, 2, 3, mouseEvent());
    brush.onMouseUp(0, 0, 2, 3, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(2, 3)).toBe(5);
  });

  it('does nothing for non-left-click', () => {
    editor.selectedGid = 5;
    brush.onMouseDown(0, 0, 2, 3, mouseEvent(2)); // right click
    brush.onMouseUp(0, 0, 2, 3, mouseEvent(2));

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(2, 3)).toBe(0);
  });

  it('paints along a drag with Bresenham interpolation', () => {
    editor.selectedGid = 3;
    brush.onMouseDown(0, 0, 0, 0, mouseEvent());
    brush.onMouseMove(64, 0, 4, 0, mouseEvent()); // drag to (4,0)
    brush.onMouseUp(64, 0, 4, 0, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    // All tiles from 0,0 to 4,0 should be painted
    for (let x = 0; x <= 4; x++) {
      expect(layer.get(x, 0)).toBe(3);
    }
  });

  it('commits a single PaintTilesCommand (undoable)', () => {
    editor.selectedGid = 7;
    brush.onMouseDown(0, 0, 1, 1, mouseEvent());
    brush.onMouseMove(32, 0, 3, 1, mouseEvent());
    brush.onMouseUp(32, 0, 3, 1, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(1, 1)).toBe(7);
    expect(layer.get(2, 1)).toBe(7);
    expect(layer.get(3, 1)).toBe(7);

    // Undo should revert all tiles
    editor.mapDocument.commandStack.undo();
    expect(layer.get(1, 1)).toBe(0);
    expect(layer.get(2, 1)).toBe(0);
    expect(layer.get(3, 1)).toBe(0);

    // Redo should restore them
    editor.mapDocument.commandStack.redo();
    expect(layer.get(1, 1)).toBe(7);
    expect(layer.get(2, 1)).toBe(7);
    expect(layer.get(3, 1)).toBe(7);
  });

  it('does not paint when selectedGid is 0', () => {
    editor.selectedGid = 0;
    brush.onMouseDown(0, 0, 1, 1, mouseEvent());
    brush.onMouseUp(0, 0, 1, 1, mouseEvent());

    expect(editor.mapDocument.commandStack.canUndo()).toBe(false);
  });

  it('does not commit if painting same GID over existing', () => {
    const layer = editor.mapDocument.getLayer('Ground');
    layer.set(2, 2, 5);

    editor.selectedGid = 5;
    brush.onMouseDown(0, 0, 2, 2, mouseEvent());
    brush.onMouseUp(0, 0, 2, 2, mouseEvent());

    // No command should have been created
    expect(editor.mapDocument.commandStack.canUndo()).toBe(false);
  });

  it('paints on the active layer', () => {
    editor.activeLayerName = 'Walls';
    editor.selectedGid = 10;
    brush.onMouseDown(0, 0, 0, 0, mouseEvent());
    brush.onMouseUp(0, 0, 0, 0, mouseEvent());

    expect(editor.mapDocument.getLayer('Walls').get(0, 0)).toBe(10);
    expect(editor.mapDocument.getLayer('Ground').get(0, 0)).toBe(0);
  });

  it('preserves original oldGid when painting same tile multiple times in one drag', () => {
    const layer = editor.mapDocument.getLayer('Ground');
    layer.set(1, 0, 2); // original value

    editor.selectedGid = 5;
    brush.onMouseDown(0, 0, 0, 0, mouseEvent());
    brush.onMouseMove(16, 0, 1, 0, mouseEvent());
    brush.onMouseMove(0, 0, 0, 0, mouseEvent());  // back over tile (1,0) again
    brush.onMouseMove(16, 0, 1, 0, mouseEvent());
    brush.onMouseUp(16, 0, 1, 0, mouseEvent());

    expect(layer.get(1, 0)).toBe(5);

    // Undo should restore to original value (2), not an intermediate value
    editor.mapDocument.commandStack.undo();
    expect(layer.get(1, 0)).toBe(2);
  });
});

// --- EraserTool ---

describe('EraserTool', () => {
  let editor, eraser;

  beforeEach(() => {
    editor = makeEditor();
    eraser = new EraserTool(editor);
    eraser.activate();

    // Pre-fill some tiles
    const layer = editor.mapDocument.getLayer('Ground');
    for (let x = 0; x < 5; x++) {
      layer.set(x, 0, 3);
    }
  });

  it('erases a single tile', () => {
    eraser.onMouseDown(0, 0, 2, 0, mouseEvent());
    eraser.onMouseUp(0, 0, 2, 0, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(2, 0)).toBe(0);
    expect(layer.get(1, 0)).toBe(3); // adjacent untouched
  });

  it('erases along a drag', () => {
    eraser.onMouseDown(0, 0, 0, 0, mouseEvent());
    eraser.onMouseMove(48, 0, 3, 0, mouseEvent());
    eraser.onMouseUp(48, 0, 3, 0, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    for (let x = 0; x <= 3; x++) {
      expect(layer.get(x, 0)).toBe(0);
    }
    expect(layer.get(4, 0)).toBe(3); // beyond drag
  });

  it('undo restores erased tiles', () => {
    eraser.onMouseDown(0, 0, 1, 0, mouseEvent());
    eraser.onMouseUp(0, 0, 1, 0, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(1, 0)).toBe(0);

    editor.mapDocument.commandStack.undo();
    expect(layer.get(1, 0)).toBe(3);
  });

  it('does not commit when erasing already-empty tiles', () => {
    eraser.onMouseDown(0, 0, 0, 5, mouseEvent()); // empty tile
    eraser.onMouseUp(0, 0, 0, 5, mouseEvent());

    expect(editor.mapDocument.commandStack.canUndo()).toBe(false);
  });
});

// --- CanvasRenderer GID resolution ---

describe('CanvasRenderer GID resolution (via MapDocument.resolveGid)', () => {
  it('resolves GID from single tileset', () => {
    const doc = new MapDocument();
    doc.addTileset({ name: 'A', image: null, imagePath: 'a.png', columns: 4, rows: 4, tileCount: 16, tileWidth: 16, tileHeight: 16 });

    // firstgid=1, so GID 1 = localId 0, GID 5 = localId 4
    const r1 = doc.resolveGid(1);
    expect(r1.tileset.name).toBe('A');
    expect(r1.localId).toBe(0);

    const r5 = doc.resolveGid(5);
    expect(r5.tileset.name).toBe('A');
    expect(r5.localId).toBe(4);
  });

  it('resolves GID from multiple tilesets', () => {
    const doc = new MapDocument();
    doc.addTileset({ name: 'A', image: null, imagePath: 'a.png', columns: 4, rows: 4, tileCount: 16, tileWidth: 16, tileHeight: 16 });
    doc.addTileset({ name: 'B', image: null, imagePath: 'b.png', columns: 8, rows: 2, tileCount: 16, tileWidth: 16, tileHeight: 16 });

    // A: firstgid=1, tileCount=16 → GIDs 1-16
    // B: firstgid=17, tileCount=16 → GIDs 17-32
    expect(doc.tilesets[0].firstgid).toBe(1);
    expect(doc.tilesets[1].firstgid).toBe(17);

    // GID 16 → A, localId 15
    const r16 = doc.resolveGid(16);
    expect(r16.tileset.name).toBe('A');
    expect(r16.localId).toBe(15);

    // GID 17 → B, localId 0
    const r17 = doc.resolveGid(17);
    expect(r17.tileset.name).toBe('B');
    expect(r17.localId).toBe(0);

    // GID 20 → B, localId 3
    const r20 = doc.resolveGid(20);
    expect(r20.tileset.name).toBe('B');
    expect(r20.localId).toBe(3);
  });

  it('returns null for GID 0', () => {
    const doc = new MapDocument();
    doc.addTileset({ name: 'A', image: null, imagePath: 'a.png', columns: 4, rows: 4, tileCount: 16, tileWidth: 16, tileHeight: 16 });
    expect(doc.resolveGid(0)).toBeNull();
  });

  it('returns null for negative GID', () => {
    const doc = new MapDocument();
    doc.addTileset({ name: 'A', image: null, imagePath: 'a.png', columns: 4, rows: 4, tileCount: 16, tileWidth: 16, tileHeight: 16 });
    expect(doc.resolveGid(-1)).toBeNull();
  });
});
