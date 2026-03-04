// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectTool } from '../../client/src/map-editor/tools/SelectTool.js';
import { BrushTool } from '../../client/src/map-editor/tools/BrushTool.js';
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
    selectedGid: 0,
    selectedStamp: null,
    showToast: vi.fn(),
  };
}

function mouseEvent(button = 0) {
  return { button };
}

function keyEvent(key, opts = {}) {
  return {
    key,
    ctrlKey: opts.ctrl || false,
    metaKey: opts.meta || false,
    shiftKey: opts.shift || false,
    preventDefault: vi.fn(),
  };
}

// --- SelectTool ---

describe('SelectTool', () => {
  let editor, tool;

  beforeEach(() => {
    editor = makeEditor();
    tool = new SelectTool(editor);
    tool.activate();
  });

  describe('selection', () => {
    it('creates selection from drag', () => {
      tool.onMouseDown(0, 0, 1, 1, mouseEvent());
      tool.onMouseMove(48, 48, 3, 3, mouseEvent());
      tool.onMouseUp(48, 48, 3, 3, mouseEvent());

      expect(tool._selection).toEqual({ x1: 1, y1: 1, x2: 3, y2: 3 });
    });

    it('normalizes reverse drag', () => {
      tool.onMouseDown(48, 48, 3, 3, mouseEvent());
      tool.onMouseMove(0, 0, 0, 0, mouseEvent());
      tool.onMouseUp(0, 0, 0, 0, mouseEvent());

      expect(tool._selection).toEqual({ x1: 0, y1: 0, x2: 3, y2: 3 });
    });

    it('Escape clears selection', () => {
      tool.onMouseDown(0, 0, 1, 1, mouseEvent());
      tool.onMouseUp(16, 16, 2, 2, mouseEvent());

      tool.onKeyDown(keyEvent('Escape'));
      expect(tool._selection).toBeNull();
    });
  });

  describe('copy/paste', () => {
    it('Ctrl+C copies selection to clipboard', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(1, 1, 5);
      layer.set(2, 1, 6);
      layer.set(1, 2, 7);
      layer.set(2, 2, 8);

      // Select 2x2 area
      tool.onMouseDown(0, 0, 1, 1, mouseEvent());
      tool.onMouseUp(32, 32, 2, 2, mouseEvent());

      tool.onKeyDown(keyEvent('c', { ctrl: true }));

      expect(tool._clipboard).not.toBeNull();
      expect(tool._clipboard.cols).toBe(2);
      expect(tool._clipboard.rows).toBe(2);
      expect(tool._clipboard.gids).toEqual([[5, 6], [7, 8]]);
    });

    it('Ctrl+V + click pastes tiles', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(0, 0, 5);
      layer.set(1, 0, 6);

      // Select 2x1 area
      tool.onMouseDown(0, 0, 0, 0, mouseEvent());
      tool.onMouseUp(16, 0, 1, 0, mouseEvent());

      // Copy
      tool.onKeyDown(keyEvent('c', { ctrl: true }));
      // Enter paste mode
      tool.onKeyDown(keyEvent('v', { ctrl: true }));
      expect(tool._pasting).toBe(true);

      // Paste at (5, 5)
      tool.onMouseMove(0, 0, 5, 5, mouseEvent());
      tool.onMouseDown(0, 0, 5, 5, mouseEvent());

      expect(layer.get(5, 5)).toBe(5);
      expect(layer.get(6, 5)).toBe(6);
    });

    it('Ctrl+X copies and clears', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(0, 0, 5);
      layer.set(1, 0, 6);

      tool.onMouseDown(0, 0, 0, 0, mouseEvent());
      tool.onMouseUp(16, 0, 1, 0, mouseEvent());

      tool.onKeyDown(keyEvent('x', { ctrl: true }));

      expect(tool._clipboard.gids).toEqual([[5, 6]]);
      expect(layer.get(0, 0)).toBe(0);
      expect(layer.get(1, 0)).toBe(0);
    });

    it('undo reverses paste', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(0, 0, 5);

      tool.onMouseDown(0, 0, 0, 0, mouseEvent());
      tool.onMouseUp(0, 0, 0, 0, mouseEvent());
      tool.onKeyDown(keyEvent('c', { ctrl: true }));
      tool.onKeyDown(keyEvent('v', { ctrl: true }));

      tool.onMouseMove(0, 0, 3, 3, mouseEvent());
      tool.onMouseDown(0, 0, 3, 3, mouseEvent());
      expect(layer.get(3, 3)).toBe(5);

      editor.mapDocument.commandStack.undo();
      expect(layer.get(3, 3)).toBe(0);
    });
  });

  describe('delete', () => {
    it('Delete key clears selected tiles', () => {
      const layer = editor.mapDocument.getLayer('Ground');
      layer.set(2, 2, 9);
      layer.set(3, 2, 10);

      tool.onMouseDown(0, 0, 2, 2, mouseEvent());
      tool.onMouseUp(48, 0, 3, 2, mouseEvent());

      tool.onKeyDown(keyEvent('Delete'));

      expect(layer.get(2, 2)).toBe(0);
      expect(layer.get(3, 2)).toBe(0);
    });
  });
});

// --- BrushTool stamp mode ---

describe('BrushTool stamp mode', () => {
  let editor, brush;

  beforeEach(() => {
    editor = makeEditor();
    brush = new BrushTool(editor);
    brush.activate();
  });

  it('paints multi-tile stamp at click position', () => {
    editor.selectedStamp = {
      gids: [[1, 2], [3, 4]],
      cols: 2,
      rows: 2,
    };

    brush.onMouseDown(0, 0, 5, 5, mouseEvent());
    brush.onMouseUp(0, 0, 5, 5, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(5, 5)).toBe(1);
    expect(layer.get(6, 5)).toBe(2);
    expect(layer.get(5, 6)).toBe(3);
    expect(layer.get(6, 6)).toBe(4);
  });

  it('stamp paint is undoable', () => {
    editor.selectedStamp = {
      gids: [[7, 8]],
      cols: 2,
      rows: 1,
    };

    brush.onMouseDown(0, 0, 0, 0, mouseEvent());
    brush.onMouseUp(0, 0, 0, 0, mouseEvent());

    const layer = editor.mapDocument.getLayer('Ground');
    expect(layer.get(0, 0)).toBe(7);
    expect(layer.get(1, 0)).toBe(8);

    editor.mapDocument.commandStack.undo();
    expect(layer.get(0, 0)).toBe(0);
    expect(layer.get(1, 0)).toBe(0);
  });

  it('skips GID 0 tiles in stamp', () => {
    editor.selectedStamp = {
      gids: [[5, 0], [0, 6]],
      cols: 2,
      rows: 2,
    };

    const layer = editor.mapDocument.getLayer('Ground');
    layer.set(1, 0, 99); // should remain since stamp has 0 here

    brush.onMouseDown(0, 0, 0, 0, mouseEvent());
    brush.onMouseUp(0, 0, 0, 0, mouseEvent());

    expect(layer.get(0, 0)).toBe(5);
    expect(layer.get(1, 0)).toBe(99); // preserved
    expect(layer.get(0, 1)).toBe(0);  // 0 in stamp, was already 0
    expect(layer.get(1, 1)).toBe(6);
  });
});
