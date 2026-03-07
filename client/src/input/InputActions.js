// @doc-player 01:Controls > Keyboard
// Move with **WASD** or **arrow keys**. Additional bindings:
//
// | Action | Keys |
// |--------|------|
// | Move | WASD / Arrow keys |
// | Sprint | Shift |
// | Jump | Space |
// | Interact | E |
//
// Diagonal movement is normalized so you move at the same speed in all directions.
// On mobile, use the on-screen joystick (left) and action buttons (right).

export const Actions = {
  MOVE_LEFT: 'moveLeft',
  MOVE_RIGHT: 'moveRight',
  MOVE_UP: 'moveUp',
  MOVE_DOWN: 'moveDown',
  INTERACT: 'interact',
  SPRINT: 'sprint',
  JUMP: 'jump',
};

// AGENT: Key codes use Phaser.Input.Keyboard.KeyCodes string names.
// This default mapping is loaded at startup and can be overridden via rebind().
export const DEFAULT_KEY_BINDINGS = {
  [Actions.MOVE_LEFT]: ['LEFT', 'A'],
  [Actions.MOVE_RIGHT]: ['RIGHT', 'D'],
  [Actions.MOVE_UP]: ['UP', 'W'],
  [Actions.MOVE_DOWN]: ['DOWN', 'S'],
  [Actions.INTERACT]: ['E'],
  [Actions.SPRINT]: ['SHIFT'],
  [Actions.JUMP]: ['SPACE'],
};
