export const Actions = {
  MOVE_LEFT: 'moveLeft',
  MOVE_RIGHT: 'moveRight',
  JUMP: 'jump',
};

// AGENT: Key codes use Phaser.Input.Keyboard.KeyCodes string names.
// This default mapping is loaded at startup and can be overridden via rebind().
export const DEFAULT_KEY_BINDINGS = {
  [Actions.MOVE_LEFT]: ['LEFT', 'A'],
  [Actions.MOVE_RIGHT]: ['RIGHT', 'D'],
  [Actions.JUMP]: ['UP', 'W', 'SPACE'],
};
