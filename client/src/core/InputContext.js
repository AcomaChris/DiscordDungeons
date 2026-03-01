// --- Input Context ---
// Tracks whether game input should be active. DOM overlays (dialogs, menus)
// call acquireInputFocus/releaseInputFocus so InputManager knows to suppress
// game controls and yield keyboard to form fields.
// Uses a counter to support nested overlays correctly.

let _uiFocusCount = 0;

export function acquireInputFocus() {
  _uiFocusCount++;
}

export function releaseInputFocus() {
  _uiFocusCount = Math.max(0, _uiFocusCount - 1);
}

export function isGameInputActive() {
  return _uiFocusCount === 0;
}

// AGENT: Only used by tests to reset state between runs.
export function _resetForTesting() {
  _uiFocusCount = 0;
}
