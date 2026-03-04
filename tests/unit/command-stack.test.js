import { describe, it, expect, vi } from 'vitest';
import { CommandStack, PaintTilesCommand, BatchCommand, PlaceObjectCommand, MoveObjectCommand, DeleteObjectCommand } from '../../client/src/map-editor/CommandStack.js';
import { SparseLayer } from '../../client/src/map-editor/SparseLayer.js';

describe('CommandStack', () => {
  it('executes a command', () => {
    const stack = new CommandStack();
    const layer = new SparseLayer('Ground');
    const cmd = new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 5 }]);

    stack.execute(cmd);
    expect(layer.get(0, 0)).toBe(5);
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
  });

  it('undo reverses a command', () => {
    const stack = new CommandStack();
    const layer = new SparseLayer('Ground');
    const cmd = new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 5 }]);

    stack.execute(cmd);
    stack.undo();
    expect(layer.get(0, 0)).toBe(0);
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(true);
  });

  it('redo re-applies a command', () => {
    const stack = new CommandStack();
    const layer = new SparseLayer('Ground');
    const cmd = new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 5 }]);

    stack.execute(cmd);
    stack.undo();
    stack.redo();
    expect(layer.get(0, 0)).toBe(5);
    expect(stack.canUndo()).toBe(true);
    expect(stack.canRedo()).toBe(false);
  });

  it('new command clears redo stack', () => {
    const stack = new CommandStack();
    const layer = new SparseLayer('Ground');

    stack.execute(new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 1 }]));
    stack.undo();
    expect(stack.canRedo()).toBe(true);

    stack.execute(new PaintTilesCommand(layer, [{ x: 1, y: 0, oldGid: 0, newGid: 2 }]));
    expect(stack.canRedo()).toBe(false);
  });

  it('respects max size', () => {
    const stack = new CommandStack(3);
    const layer = new SparseLayer('Ground');

    for (let i = 0; i < 5; i++) {
      stack.execute(new PaintTilesCommand(layer, [{ x: i, y: 0, oldGid: 0, newGid: i + 1 }]));
    }

    // Can only undo 3 times (max size)
    let count = 0;
    while (stack.undo()) count++;
    expect(count).toBe(3);
  });

  it('fires onChange callback', () => {
    const stack = new CommandStack();
    const layer = new SparseLayer('Ground');
    const cb = vi.fn();
    stack.onChange = cb;

    stack.execute(new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 1 }]));
    expect(cb).toHaveBeenCalledTimes(1);

    stack.undo();
    expect(cb).toHaveBeenCalledTimes(2);

    stack.redo();
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('clear empties both stacks', () => {
    const stack = new CommandStack();
    const layer = new SparseLayer('Ground');

    stack.execute(new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 1 }]));
    stack.undo();
    stack.clear();
    expect(stack.canUndo()).toBe(false);
    expect(stack.canRedo()).toBe(false);
  });
});

describe('PaintTilesCommand', () => {
  it('paints multiple tiles', () => {
    const layer = new SparseLayer('Ground');
    const cmd = new PaintTilesCommand(layer, [
      { x: 0, y: 0, oldGid: 0, newGid: 1 },
      { x: 1, y: 0, oldGid: 0, newGid: 2 },
      { x: 2, y: 0, oldGid: 0, newGid: 3 },
    ]);
    cmd.execute();
    expect(layer.get(0, 0)).toBe(1);
    expect(layer.get(1, 0)).toBe(2);
    expect(layer.get(2, 0)).toBe(3);
  });

  it('undo restores all tiles', () => {
    const layer = new SparseLayer('Ground');
    layer.set(0, 0, 99);
    const cmd = new PaintTilesCommand(layer, [
      { x: 0, y: 0, oldGid: 99, newGid: 1 },
    ]);
    cmd.execute();
    expect(layer.get(0, 0)).toBe(1);
    cmd.undo();
    expect(layer.get(0, 0)).toBe(99);
  });
});

describe('BatchCommand', () => {
  it('executes all sub-commands', () => {
    const layer = new SparseLayer('Ground');
    const batch = new BatchCommand([
      new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 1 }]),
      new PaintTilesCommand(layer, [{ x: 1, y: 0, oldGid: 0, newGid: 2 }]),
    ]);
    batch.execute();
    expect(layer.get(0, 0)).toBe(1);
    expect(layer.get(1, 0)).toBe(2);
  });

  it('undo reverses all sub-commands in reverse order', () => {
    const layer = new SparseLayer('Ground');
    const batch = new BatchCommand([
      new PaintTilesCommand(layer, [{ x: 0, y: 0, oldGid: 0, newGid: 1 }]),
      new PaintTilesCommand(layer, [{ x: 1, y: 0, oldGid: 0, newGid: 2 }]),
    ]);
    batch.execute();
    batch.undo();
    expect(layer.get(0, 0)).toBe(0);
    expect(layer.get(1, 0)).toBe(0);
  });
});

describe('Object commands', () => {
  it('PlaceObjectCommand adds and removes', () => {
    const doc = { objects: [] };
    const obj = { id: 1, name: 'spawn', type: 'spawn', x: 100, y: 200 };
    const cmd = new PlaceObjectCommand(doc, obj);

    cmd.execute();
    expect(doc.objects).toContain(obj);

    cmd.undo();
    expect(doc.objects).not.toContain(obj);
  });

  it('MoveObjectCommand moves and reverts', () => {
    const obj = { x: 10, y: 20 };
    const cmd = new MoveObjectCommand(obj, 10, 20, 50, 60);

    cmd.execute();
    expect(obj.x).toBe(50);
    expect(obj.y).toBe(60);

    cmd.undo();
    expect(obj.x).toBe(10);
    expect(obj.y).toBe(20);
  });

  it('DeleteObjectCommand removes and restores at same index', () => {
    const a = { id: 1 }, b = { id: 2 }, c = { id: 3 };
    const doc = { objects: [a, b, c] };
    const cmd = new DeleteObjectCommand(doc, b);

    cmd.execute();
    expect(doc.objects).toEqual([a, c]);

    cmd.undo();
    expect(doc.objects).toEqual([a, b, c]);
  });
});
