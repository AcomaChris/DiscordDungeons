// --- mergeInputSnapshots ---
// Combines keyboard and touch snapshots into a single input action.
// Touch axis wins when non-zero (intentional touch overrides idle keyboard).

export function mergeInputSnapshots(keyboard, touch) {
  return {
    moveX: touch.moveX !== 0 ? touch.moveX : keyboard.moveX,
    moveY: touch.moveY !== 0 ? touch.moveY : keyboard.moveY,
    sprint: keyboard.sprint || touch.sprint || false,
    jump: keyboard.jump || touch.jump || false,
  };
}
