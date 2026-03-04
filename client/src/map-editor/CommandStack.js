// --- CommandStack ---
// Undo/redo system using the command pattern. All map mutations go through commands.

export class CommandStack {
  constructor(maxSize = 500) {
    this._undoStack = [];
    this._redoStack = [];
    this._maxSize = maxSize;
    this.onChange = null; // callback when stack changes
  }

  execute(command) {
    command.execute();
    this._undoStack.push(command);
    this._redoStack = [];
    if (this._undoStack.length > this._maxSize) this._undoStack.shift();
    if (this.onChange) this.onChange();
  }

  undo() {
    const cmd = this._undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this._redoStack.push(cmd);
    if (this.onChange) this.onChange();
    return true;
  }

  redo() {
    const cmd = this._redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this._undoStack.push(cmd);
    if (this.onChange) this.onChange();
    return true;
  }

  canUndo() { return this._undoStack.length > 0; }
  canRedo() { return this._redoStack.length > 0; }

  clear() {
    this._undoStack = [];
    this._redoStack = [];
    if (this.onChange) this.onChange();
  }
}

// --- Commands ---

// Paint/erase tiles on a single layer
export class PaintTilesCommand {
  constructor(layer, tiles) {
    this.layer = layer; // SparseLayer instance
    this.tiles = tiles; // [{x, y, oldGid, newGid}]
  }

  execute() {
    for (const t of this.tiles) {
      this.layer.set(t.x, t.y, t.newGid);
    }
  }

  undo() {
    for (const t of this.tiles) {
      this.layer.set(t.x, t.y, t.oldGid);
    }
  }
}

// Wrap multiple commands as one undo unit
export class BatchCommand {
  constructor(commands) {
    this.commands = commands;
  }

  execute() {
    for (const cmd of this.commands) cmd.execute();
  }

  undo() {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}

// Place a new object
export class PlaceObjectCommand {
  constructor(document, object) {
    this._doc = document;
    this._object = object;
  }

  execute() {
    this._doc.objects.push(this._object);
  }

  undo() {
    const idx = this._doc.objects.indexOf(this._object);
    if (idx >= 0) this._doc.objects.splice(idx, 1);
  }
}

// Move an object to a new position
export class MoveObjectCommand {
  constructor(object, oldX, oldY, newX, newY) {
    this._object = object;
    this._oldX = oldX;
    this._oldY = oldY;
    this._newX = newX;
    this._newY = newY;
  }

  execute() {
    this._object.x = this._newX;
    this._object.y = this._newY;
  }

  undo() {
    this._object.x = this._oldX;
    this._object.y = this._oldY;
  }
}

// Delete an object
export class DeleteObjectCommand {
  constructor(document, object) {
    this._doc = document;
    this._object = object;
    this._index = -1;
  }

  execute() {
    this._index = this._doc.objects.indexOf(this._object);
    if (this._index >= 0) this._doc.objects.splice(this._index, 1);
  }

  undo() {
    if (this._index >= 0) {
      this._doc.objects.splice(this._index, 0, this._object);
    } else {
      this._doc.objects.push(this._object);
    }
  }
}
