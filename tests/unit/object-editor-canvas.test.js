// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectEditorCanvas } from '../../client/src/tile-editor/ObjectEditorCanvas.js';

// --- Test helpers ---

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  // jsdom doesn't implement canvas 2D context — stub it
  canvas.getContext = () => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    save: vi.fn(),
    restore: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    globalCompositeOperation: '',
    lineDashOffset: 0,
  });
  // getBoundingClientRect for mouse position calculation
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 256, height: 256 });
  // parentElement for scroll operations
  Object.defineProperty(canvas, 'parentElement', {
    get: () => ({ clientWidth: 256, clientHeight: 256, scrollLeft: 0, scrollTop: 0 }),
  });
  return canvas;
}

// Build a mouse event at a given tile position (zoom=4, TILE_SIZE=16 → pixel = tile * 64 + 32)
function mouseEvent(col, row, opts = {}) {
  const TILE_SIZE = 16;
  const zoom = 4;
  const px = col * TILE_SIZE * zoom + TILE_SIZE * zoom / 2;
  const py = row * TILE_SIZE * zoom + TILE_SIZE * zoom / 2;
  return new MouseEvent('mousedown', {
    clientX: px,
    clientY: py,
    ctrlKey: opts.ctrlKey || false,
    metaKey: opts.metaKey || false,
    shiftKey: opts.shiftKey || false,
    altKey: opts.altKey || false,
    ...opts,
  });
}

// Sample object defs: 4×4 tileset grid, two objects occupying different tiles
// Object A at tiles (0,0) and (1,0) → tile indices 0, 1
// Object B at tiles (2,0) and (3,0) → tile indices 2, 3
function sampleDefs() {
  return {
    objA: {
      name: 'Table',
      category: 'furniture',
      grid: { cols: 2, rows: 1, tiles: [[0, 1]] },
      colliders: [],
      nodes: [],
    },
    objB: {
      name: 'Chair',
      category: 'furniture',
      grid: { cols: 2, rows: 1, tiles: [[2, 3]] },
      colliders: [],
      nodes: [],
    },
    objC: {
      name: 'Lamp',
      category: 'lighting',
      grid: { cols: 1, rows: 1, tiles: [[4]] },
      colliders: [],
      nodes: [],
    },
  };
}

describe('ObjectEditorCanvas', () => {
  let canvas, editor;

  beforeEach(() => {
    canvas = createCanvas();
    editor = new ObjectEditorCanvas(canvas, null, null);
    editor.loadImage(new Image(), 4, 4); // 4 columns × 4 rows tileset
    editor.setActive(true);
    editor.loadDefs(sampleDefs());
  });

  // --- Selection basics ---

  describe('single selection', () => {
    it('selects an object when clicking on its tile', () => {
      const cb = vi.fn();
      editor.onObjectSelect = cb;

      // Click on tile (0,0) which belongs to objA
      editor._onMouseDown(mouseEvent(0, 0));

      expect(editor.selectedObjectId).toBe('objA');
      expect([...editor.selectedObjectIds]).toEqual(['objA']);
      expect(cb).toHaveBeenCalledWith('objA', editor.selectedObjectIds);
    });

    it('switches selection when clicking a different object', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      editor._onMouseDown(mouseEvent(2, 0)); // select objB

      expect(editor.selectedObjectId).toBe('objB');
      expect([...editor.selectedObjectIds]).toEqual(['objB']);
    });

    it('deselects when clicking on empty tile', () => {
      const cb = vi.fn();
      editor.onObjectSelect = cb;

      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      editor._onMouseDown(mouseEvent(0, 2)); // click empty tile (row 2 has no objects)

      expect(editor.selectedObjectId).toBeNull();
      expect(editor.selectedObjectIds.size).toBe(0);
    });
  });

  // --- Multi-select (Ctrl+click) ---

  describe('multi-select with Ctrl+click', () => {
    it('adds a second object with Ctrl+click', () => {
      const cb = vi.fn();
      editor.onObjectSelect = cb;

      // Normal click on objA
      editor._onMouseDown(mouseEvent(0, 0));
      expect(editor.selectedObjectIds.size).toBe(1);

      // Ctrl+click on objB
      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true }));

      expect(editor.selectedObjectIds.size).toBe(2);
      expect(editor.selectedObjectIds.has('objA')).toBe(true);
      expect(editor.selectedObjectIds.has('objB')).toBe(true);
      // Primary should be first in the set (objA)
      expect(editor.selectedObjectId).toBe('objA');
    });

    it('adds a third object with Ctrl+click', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true })); // add objB
      editor._onMouseDown(mouseEvent(0, 1, { ctrlKey: true })); // add objC (tile 4 is at col 0, row 1)

      expect(editor.selectedObjectIds.size).toBe(3);
      expect(editor.selectedObjectIds.has('objA')).toBe(true);
      expect(editor.selectedObjectIds.has('objB')).toBe(true);
      expect(editor.selectedObjectIds.has('objC')).toBe(true);
    });

    it('removes an object with Ctrl+click on already-selected', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true })); // add objB
      expect(editor.selectedObjectIds.size).toBe(2);

      // Ctrl+click on objA again to remove it
      editor._onMouseDown(mouseEvent(0, 0, { ctrlKey: true }));

      expect(editor.selectedObjectIds.size).toBe(1);
      expect(editor.selectedObjectIds.has('objB')).toBe(true);
      expect(editor.selectedObjectIds.has('objA')).toBe(false);
      // Primary should update to remaining object
      expect(editor.selectedObjectId).toBe('objB');
    });

    it('works with metaKey (Cmd on Mac)', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      editor._onMouseDown(mouseEvent(2, 0, { metaKey: true })); // Cmd+click objB

      expect(editor.selectedObjectIds.size).toBe(2);
      expect(editor.selectedObjectIds.has('objA')).toBe(true);
      expect(editor.selectedObjectIds.has('objB')).toBe(true);
    });

    it('normal click after multi-select resets to single selection', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true })); // add objB
      expect(editor.selectedObjectIds.size).toBe(2);

      // Normal click on objB
      editor._onMouseDown(mouseEvent(2, 0));

      expect(editor.selectedObjectIds.size).toBe(1);
      expect(editor.selectedObjectIds.has('objB')).toBe(true);
      expect(editor.selectedObjectId).toBe('objB');
    });

    it('Ctrl+click on empty tile deselects (falls through to normal click)', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA

      // Ctrl+click on empty tile — objectId is undefined so Ctrl branch skipped,
      // falls through to normal click deselect logic
      editor._onMouseDown(mouseEvent(0, 2, { ctrlKey: true }));

      expect(editor.selectedObjectIds.size).toBe(0);
      expect(editor.selectedObjectId).toBeNull();
    });

    it('callback receives selectedObjectIds set', () => {
      const cb = vi.fn();
      editor.onObjectSelect = cb;

      editor._onMouseDown(mouseEvent(0, 0));
      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true }));

      // Second call should include both objects
      const lastCall = cb.mock.calls[cb.mock.calls.length - 1];
      expect(lastCall[0]).toBe('objA'); // primary
      const ids = lastCall[1];
      expect(ids.size).toBe(2);
      expect(ids.has('objA')).toBe(true);
      expect(ids.has('objB')).toBe(true);
    });

    it('Ctrl+click without prior selection starts multi-select from scratch', () => {
      // No prior selection — Ctrl+click on objA
      editor._onMouseDown(mouseEvent(0, 0, { ctrlKey: true }));

      expect(editor.selectedObjectIds.size).toBe(1);
      expect(editor.selectedObjectIds.has('objA')).toBe(true);
      expect(editor.selectedObjectId).toBe('objA');
    });

    it('removing all via Ctrl+click clears selectedObjectId', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      // Ctrl+click to remove objA
      editor._onMouseDown(mouseEvent(0, 0, { ctrlKey: true }));

      expect(editor.selectedObjectIds.size).toBe(0);
      expect(editor.selectedObjectId).toBeNull();
    });
  });

  // --- Resize handle vs. adjacent object ---

  describe('resize handle does not block adjacent object clicks', () => {
    it('clicking on an adjacent objects tile selects it instead of resize', () => {
      // objA occupies tiles 0,1 (cols 0-1, row 0). East resize handle is at col 2.
      // objB occupies tiles 2,3 (cols 2-3, row 0). Col 2 is objB's tile.
      // Clicking col 2 should select objB, NOT start a resize on objA.
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      expect(editor.selectedObjectId).toBe('objA');

      editor._onMouseDown(mouseEvent(2, 0)); // click on objB tile

      expect(editor.selectedObjectId).toBe('objB');
      expect(editor._isResizing).toBe(false);
    });

    it('resize handle works on empty tiles adjacent to selected object', () => {
      // objC is at tile 4 (col 0, row 1). South handle at row 2 is empty.
      editor._onMouseDown(mouseEvent(0, 1)); // select objC
      expect(editor.selectedObjectId).toBe('objC');

      // Click on south handle (col 0, row 2) — empty tile, should start resize
      editor._onMouseDown(mouseEvent(0, 2));

      expect(editor._isResizing).toBe(true);
      expect(editor._resizeHandle).toBe('s');
    });
  });

  // --- selectObject() programmatic API ---

  describe('selectObject()', () => {
    it('resets multi-select to single', () => {
      editor._onMouseDown(mouseEvent(0, 0));
      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true }));
      expect(editor.selectedObjectIds.size).toBe(2);

      editor.selectObject('objB');

      expect(editor.selectedObjectId).toBe('objB');
      expect(editor.selectedObjectIds.size).toBe(1);
      expect(editor.selectedObjectIds.has('objB')).toBe(true);
    });

    it('clears selection when called with null', () => {
      editor._onMouseDown(mouseEvent(0, 0));
      editor.selectObject(null);

      expect(editor.selectedObjectId).toBeNull();
      expect(editor.selectedObjectIds.size).toBe(0);
    });
  });

  // --- Split mode ---

  describe('split mode', () => {
    it('enters and exits split mode', () => {
      editor.enterSplitMode();
      expect(editor.isInSplitMode()).toBe(true);

      editor.exitSplitMode();
      expect(editor.isInSplitMode()).toBe(false);
    });

    it('split mode prevents normal selection clicks', () => {
      editor._onMouseDown(mouseEvent(0, 0)); // select objA
      editor.enterSplitMode();

      // Set up a split preview so the split branch is taken
      editor._splitPreview = { axis: 'v', position: 1, bounds: { x: 0, y: 0, w: 2, h: 1 } };

      const splitCb = vi.fn();
      editor.onObjectSplit = splitCb;

      // Click — should trigger split, not change selection
      editor._onMouseDown(mouseEvent(1, 0));

      expect(splitCb).toHaveBeenCalledWith({
        objectId: 'objA',
        axis: 'v',
        position: 1,
      });
      // Selection unchanged
      expect(editor.selectedObjectId).toBe('objA');
    });
  });

  // --- Tile-to-object mapping ---

  describe('tile-to-object map', () => {
    it('maps tiles to correct objects', () => {
      expect(editor._tileToObject.get(0)).toBe('objA');
      expect(editor._tileToObject.get(1)).toBe('objA');
      expect(editor._tileToObject.get(2)).toBe('objB');
      expect(editor._tileToObject.get(3)).toBe('objB');
      expect(editor._tileToObject.get(4)).toBe('objC');
      expect(editor._tileToObject.has(5)).toBe(false);
    });

    it('rebuilds map when defs change', () => {
      editor.loadDefs({
        newObj: {
          name: 'New',
          category: 'furniture',
          grid: { cols: 1, rows: 1, tiles: [[7]] },
          colliders: [],
          nodes: [],
        },
      });

      expect(editor._tileToObject.has(0)).toBe(false);
      expect(editor._tileToObject.get(7)).toBe('newObj');
    });
  });

  // --- Mode guards ---

  describe('mode guards prevent Ctrl+click', () => {
    it('paint mode intercepts clicks before Ctrl+click', () => {
      editor.setPaintMode({ paintObjectAtTile: vi.fn(() => false) });

      const cb = vi.fn();
      editor.onObjectSelect = cb;

      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true }));

      // Paint mode returns early — no selection change
      expect(cb).not.toHaveBeenCalled();

      editor.setPaintMode(null);
    });

    it('reassign mode intercepts clicks before Ctrl+click', () => {
      editor.enterReassignMode('objA');

      const cb = vi.fn();
      editor.onObjectSelect = cb;

      editor._onMouseDown(mouseEvent(2, 0, { ctrlKey: true }));

      // Reassign mode returns early — starts drag instead
      expect(cb).not.toHaveBeenCalled();

      editor.exitReassignMode();
    });
  });
});
