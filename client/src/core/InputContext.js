// --- Input Context ---
// Tracks whether game input should be active. DOM overlays (dialogs, menus)
// call acquireInputFocus/releaseInputFocus, which emit INPUT_FOCUS_CHANGED
// so InputManager can react immediately without per-frame polling.
// Uses a counter to support nested overlays correctly.

import eventBus from './EventBus.js';
import { INPUT_FOCUS_CHANGED } from './Events.js';

let _uiFocusCount = 0;

export function acquireInputFocus() {
  _uiFocusCount++;
  // Only emit on the transition from active → suppressed
  if (_uiFocusCount === 1) {
    eventBus.emit(INPUT_FOCUS_CHANGED, { active: false });
  }
}

export function releaseInputFocus() {
  if (_uiFocusCount <= 0) {
    _uiFocusCount = 0;
    return;
  }
  _uiFocusCount--;
  // Only emit on the transition from suppressed → active
  if (_uiFocusCount === 0) {
    eventBus.emit(INPUT_FOCUS_CHANGED, { active: true });
  }
}

export function isGameInputActive() {
  return _uiFocusCount === 0;
}

// AGENT: Only used by tests to reset state between runs.
export function _resetForTesting() {
  _uiFocusCount = 0;
}
