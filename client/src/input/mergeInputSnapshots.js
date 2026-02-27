// --- mergeInputSnapshots ---
// Combines keyboard and touch snapshots into a single input action.
// Touch moveX wins when non-zero (intentional touch overrides idle keyboard).
// Jump is OR'd from both sources so either input can trigger it.

export function mergeInputSnapshots(keyboard, touch) {
  return {
    moveX: touch.moveX !== 0 ? touch.moveX : keyboard.moveX,
    jump: keyboard.jump || touch.jump,
  };
}
