// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapDocument } from '../../client/src/map-editor/MapDocument.js';

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
    showToast: vi.fn(),
  };
}

function mouseEvent(button = 0) {
  return { button };
}

// --- RectangleFillTool ---

describe('RectangleFillTool', () => {
  let RectangleFillTool, editor, tool;

  beforeEach(async () => {
    ({ RectangleFillTool } = await import('../../client/src/map-editor/tools/RectangleFillTool.js'));
    editor = makeEditor();
    tool = new RectangleFillTool(editor);
    tool.activate();
  });

  it('fills a rectangle on mouseup', () => {
    editor.selectedGid = 5;
    tool.onMouseDown(0, 0, 1, 1, mouseEvent());
    tool.onMouseMove(48, 48, 3, 3, mouseEvent());
    tool.onMouseUp(48, 48, 3, 3, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(layer.get(x, y)).toBe(5);
      }
    }
  });

  it('handles reverse drag (end before start)', () => {
    editor.selectedGid = 3;
    tool.onMouseDown(48, 48, 3, 3, mouseEvent());
    tool.onMouseMove(16, 16, 1, 1, mouseEvent());
    tool.onMouseUp(16, 16, 1, 1, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        expect(layer.get(x, y)).toBe(3);
      }
    }
  });

  it('single tile rectangle', () => {
    editor.selectedGid = 7;
    tool.onMouseDown(0, 0, 2, 2, mouseEvent());
    tool.onMouseUp(0, 0, 2, 2, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(2, 2)).toBe(7);
  });

  it('creates undoable command', () => {
    editor.selectedGid = 4;
    tool.onMouseDown(0, 0, 0, 0, mouseEvent());
    tool.onMouseMove(32, 16, 2, 1, mouseEvent());
    tool.onMouseUp(32, 16, 2, 1, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(0, 0)).toBe(4);
    expect(layer.get(2, 1)).toBe(4);

    editor.mapDocument.commandStack.undo();
    expect(layer.get(0, 0)).toBe(0);
    expect(layer.get(2, 1)).toBe(0);
  });

  it('ignores non-left-click', () => {
    editor.selectedGid = 5;
    tool.onMouseDown(0, 0, 1, 1, mouseEvent(2));
    tool.onMouseUp(0, 0, 3, 3, mouseEvent(2));

    expect(editor.mapDocument.commandStack.canUndo()).toBe(false);
  });
});

// --- FloodFillTool ---

describe('FloodFillTool', () => {
  let FloodFillTool, floodFill, editor, tool;

  beforeEach(async () => {
    ({ FloodFillTool, floodFill } = await import('../../client/src/map-editor/tools/FloodFillTool.js'));
    editor = makeEditor();
    tool = new FloodFillTool(editor);
    tool.activate();
  });

  describe('floodFill function', () => {
    it('fills contiguous empty region', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      // Surround a 3x3 area with GID 1
      for (let x = 0; x <= 4; x++) { layer.set(x, 0, 1); layer.set(x, 4, 1); }
      for (let y = 1; y <= 3; y++) { layer.set(0, y, 1); layer.set(4, y, 1); }

      const changes = floodFill(layer, 2, 2, 5);
      expect(changes.length).toBe(9); // 3x3 interior
      for (const c of changes) {
        expect(c.oldGid).toBe(0);
        expect(c.newGid).toBe(5);
      }
    });

    it('replaces existing GID', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(0, 0, 3);
      layer.set(1, 0, 3);
      layer.set(0, 1, 3);
      layer.set(2, 0, 5); // boundary

      const changes = floodFill(layer, 0, 0, 7);
      expect(changes.length).toBe(3);
      for (const c of changes) {
        expect(c.oldGid).toBe(3);
        expect(c.newGid).toBe(7);
      }
    });

    it('does nothing when target equals fill GID', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(0, 0, 5);
      const changes = floodFill(layer, 0, 0, 5);
      expect(changes.length).toBe(0);
    });

    it('returns null when safety limit is exceeded', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      // All tiles are GID 0 — fill will hit limit
      const result = floodFill(layer, 0, 0, 1, 100);
      expect(result).toBeNull();
    });

    it('does not cross boundaries', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      // Create a sealed 3x1 corridor: walls on all sides
      // Wall at y=0, y=2 (horizontal), and x=-1, x=3 (vertical)
      for (let x = -1; x <= 3; x++) { layer.set(x, 0, 1); layer.set(x, 2, 1); }
      layer.set(-1, 1, 1);
      layer.set(3, 1, 1);

      // Fill inside the corridor (y=1, x=0..2)
      const changes = floodFill(layer, 0, 1, 5, 1000);
      expect(changes).not.toBeNull();
      expect(changes.length).toBe(3);
      for (const c of changes) {
        expect(c.y).toBe(1);
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('FloodFillTool integration', () => {
    it('fills on mousedown and creates undoable command', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(0, 0, 3);
      layer.set(1, 0, 3);
      layer.set(0, 1, 3);

      editor.selectedGid = 9;
      tool.onMouseDown(0, 0, 0, 0, mouseEvent());

      expect(layer.get(0, 0)).toBe(9);
      expect(layer.get(1, 0)).toBe(9);
      expect(layer.get(0, 1)).toBe(9);

      editor.mapDocument.commandStack.undo();
      expect(layer.get(0, 0)).toBe(3);
      expect(layer.get(1, 0)).toBe(3);
      expect(layer.get(0, 1)).toBe(3);
    });

    it('shows toast when safety limit reached', () => {
      editor.selectedGid = 2;
      tool.onMouseDown(0, 0, 0, 0, mouseEvent()); // fill empty space

      expect(editor.showToast).toHaveBeenCalled();
    });
  });
});

// --- LineTool ---

describe('LineTool', () => {
  let LineTool, editor, tool;

  beforeEach(async () => {
    ({ LineTool } = await import('../../client/src/map-editor/tools/LineTool.js'));
    editor = makeEditor();
    tool = new LineTool(editor);
    tool.activate();
  });

  it('paints a horizontal line', () => {
    editor.selectedGid = 4;
    tool.onMouseDown(0, 0, 0, 0, mouseEvent());
    tool.onMouseMove(64, 0, 4, 0, mouseEvent());
    tool.onMouseUp(64, 0, 4, 0, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    for (let x = 0; x <= 4; x++) {
      expect(layer.get(x, 0)).toBe(4);
    }
  });

  it('paints a vertical line', () => {
    editor.selectedGid = 6;
    tool.onMouseDown(0, 0, 2, 0, mouseEvent());
    tool.onMouseMove(0, 48, 2, 3, mouseEvent());
    tool.onMouseUp(0, 48, 2, 3, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    for (let y = 0; y <= 3; y++) {
      expect(layer.get(2, y)).toBe(6);
    }
  });

  it('creates undoable command', () => {
    editor.selectedGid = 3;
    tool.onMouseDown(0, 0, 0, 0, mouseEvent());
    tool.onMouseUp(32, 32, 2, 2, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(0, 0)).toBe(3);

    editor.mapDocument.commandStack.undo();
    expect(layer.get(0, 0)).toBe(0);
  });

  it('ignores non-left-click', () => {
    editor.selectedGid = 5;
    tool.onMouseDown(0, 0, 0, 0, mouseEvent(2));
    tool.onMouseUp(32, 32, 2, 2, mouseEvent(2));

    expect(editor.mapDocument.commandStack.canUndo()).toBe(false);
  });
});
