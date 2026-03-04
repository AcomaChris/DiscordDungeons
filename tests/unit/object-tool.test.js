// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectTool } from '../../client/src/map-editor/tools/ObjectTool.js';
import { MapDocument } from '../../client/src/map-editor/MapDocument.js';

function makeEditor() {
  const doc = new MapDocument();
  doc.addTileset({
    name: 'test', image: null, imagePath: 'test.png',
    columns: 4, rows: 4, tileCount: 16,
    tileWidth: 16, tileHeight: 16,
    objectDefs: [
      { id: 'table1', name: 'Table', width: 2, height: 2, tiles: [[{col:0,row:0},{col:1,row:0}],[{col:0,row:1},{col:1,row:1}]] },
    ],
  });
  return {
    mapDocument: doc,
    activeLayerName: 'Ground',
    selectedGid: 0,
    selectedObjectDef: null,
    selectedObjectTileset: null,
    snapToGrid: true,
    showToast: vi.fn(),
  };
}

function mouseEvent(button = 0) {
  return { button };
}

function keyEvent(key) {
  return { key, ctrlKey: false, metaKey: false, preventDefault: vi.fn() };
}

describe('ObjectTool', () => {
  let editor, tool;

  beforeEach(() => {
    editor = makeEditor();
    tool = new ObjectTool(editor);
    tool.activate();
  });

  describe('placement', () => {
    it('places an object at click position', () => {
      const objDef = editor.mapDocument.tilesets[0].objectDefs[0];
      editor.selectedObjectDef = objDef;
      editor.selectedObjectTileset = editor.mapDocument.tilesets[0];

      tool.onMouseDown(48, 64, 3, 4, mouseEvent());

      expect(editor.mapDocument.objects.length).toBe(1);
      const obj = editor.mapDocument.objects[0];
      expect(obj.type).toBe('Table');
      expect(obj.x).toBe(48); // snapped to grid (48 is multiple of 16)
      expect(obj.y).toBe(64);
      expect(obj.width).toBe(32); // 2 * 16
      expect(obj.height).toBe(32);
    });

    it('snaps to grid', () => {
      const objDef = editor.mapDocument.tilesets[0].objectDefs[0];
      editor.selectedObjectDef = objDef;
      editor.selectedObjectTileset = editor.mapDocument.tilesets[0];

      tool.onMouseDown(50, 70, 3, 4, mouseEvent()); // not grid-aligned

      const obj = editor.mapDocument.objects[0];
      expect(obj.x).toBe(48); // rounded to 48
      expect(obj.y).toBe(64); // rounded to 64
    });

    it('placement is undoable', () => {
      const objDef = editor.mapDocument.tilesets[0].objectDefs[0];
      editor.selectedObjectDef = objDef;
      editor.selectedObjectTileset = editor.mapDocument.tilesets[0];

      tool.onMouseDown(0, 0, 0, 0, mouseEvent());
      expect(editor.mapDocument.objects.length).toBe(1);

      editor.mapDocument.commandStack.undo();
      expect(editor.mapDocument.objects.length).toBe(0);
    });
  });

  describe('selection and drag', () => {
    it('selects an object by click', () => {
      // Manually place an object
      const obj = { id: 1, type: 'Table', defId: 'table1', tilesetName: 'test', x: 32, y: 32, width: 32, height: 32 };
      editor.mapDocument.objects.push(obj);

      editor.selectedObjectDef = null; // not in placement mode

      tool.onMouseDown(40, 40, 2, 2, mouseEvent()); // within obj bounds

      expect(tool._selectedObject).toBe(obj);
    });

    it('deselects when clicking empty space', () => {
      const obj = { id: 1, type: 'Table', defId: 'table1', tilesetName: 'test', x: 32, y: 32, width: 32, height: 32 };
      editor.mapDocument.objects.push(obj);
      tool._selectedObject = obj;

      editor.selectedObjectDef = null;
      tool.onMouseDown(200, 200, 12, 12, mouseEvent()); // outside obj

      expect(tool._selectedObject).toBeNull();
    });

    it('moves an object via drag', () => {
      const obj = { id: 1, type: 'Table', defId: 'table1', tilesetName: 'test', x: 32, y: 32, width: 32, height: 32 };
      editor.mapDocument.objects.push(obj);
      editor.selectedObjectDef = null;

      tool.onMouseDown(40, 40, 2, 2, mouseEvent());
      tool.onMouseMove(120, 120, 7, 7, mouseEvent());
      tool.onMouseUp(120, 120, 7, 7, mouseEvent());

      // Object should have moved (snap to grid)
      expect(obj.x).not.toBe(32);
      expect(obj.y).not.toBe(32);

      // Move is undoable
      editor.mapDocument.commandStack.undo();
      expect(obj.x).toBe(32);
      expect(obj.y).toBe(32);
    });
  });

  describe('delete', () => {
    it('Delete key removes selected object', () => {
      const obj = { id: 1, type: 'Table', defId: 'table1', tilesetName: 'test', x: 32, y: 32, width: 32, height: 32 };
      editor.mapDocument.objects.push(obj);
      tool._selectedObject = obj;

      tool.onKeyDown(keyEvent('Delete'));

      expect(editor.mapDocument.objects.length).toBe(0);
      expect(tool._selectedObject).toBeNull();
    });

    it('delete is undoable', () => {
      const obj = { id: 1, type: 'Table', defId: 'table1', tilesetName: 'test', x: 32, y: 32, width: 32, height: 32 };
      editor.mapDocument.objects.push(obj);
      tool._selectedObject = obj;

      tool.onKeyDown(keyEvent('Delete'));
      expect(editor.mapDocument.objects.length).toBe(0);

      editor.mapDocument.commandStack.undo();
      expect(editor.mapDocument.objects.length).toBe(1);
    });
  });
});
