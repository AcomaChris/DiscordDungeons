// @vitest-environment jsdom
/* global window, document, navigator */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the CSS import so it doesn't fail in Node
vi.mock('../../client/src/styles/touch-controls.css', () => ({}));

import { TouchManager } from '../../client/src/input/TouchManager.js';

// --- Helpers ---
// jsdom doesn't support TouchEvent — use a plain Event instead
function fireTouchEvent(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

describe('TouchManager', () => {
  let originalOntouchstart;

  beforeEach(() => {
    originalOntouchstart = window.ontouchstart;
    // Simulate touch-capable device
    window.ontouchstart = null;

    // jsdom doesn't implement matchMedia — provide a stub
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    if (originalOntouchstart === undefined) {
      delete window.ontouchstart;
    } else {
      window.ontouchstart = originalOntouchstart;
    }
    delete window.matchMedia;
    // Clean up any leftover DOM
    const el = document.getElementById('touch-controls');
    if (el) el.remove();
  });

  it('creates DOM overlay on touch devices', () => {
    const tm = new TouchManager();
    const container = document.getElementById('touch-controls');
    expect(container).not.toBeNull();
    expect(container.querySelectorAll('button').length).toBe(3);
    tm.destroy();
  });

  it('does not create DOM on non-touch devices', () => {
    delete window.ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

    const tm = new TouchManager();
    expect(document.getElementById('touch-controls')).toBeNull();
    tm.destroy();
  });

  it('getSnapshot returns neutral state by default', () => {
    const tm = new TouchManager();
    expect(tm.getSnapshot()).toEqual({ moveX: 0, jump: false });
    tm.destroy();
  });

  it('left button sets moveX to -1', () => {
    const tm = new TouchManager();
    const btn = document.querySelector('.btn-left');

    fireTouchEvent(btn, 'touchstart');
    expect(tm.getSnapshot().moveX).toBe(-1);

    fireTouchEvent(btn, 'touchend');
    expect(tm.getSnapshot().moveX).toBe(0);
    tm.destroy();
  });

  it('right button sets moveX to 1', () => {
    const tm = new TouchManager();
    const btn = document.querySelector('.btn-right');

    fireTouchEvent(btn, 'touchstart');
    expect(tm.getSnapshot().moveX).toBe(1);

    fireTouchEvent(btn, 'touchend');
    expect(tm.getSnapshot().moveX).toBe(0);
    tm.destroy();
  });

  it('jump button triggers jump once then resets', () => {
    const tm = new TouchManager();
    const btn = document.querySelector('.btn-jump');

    fireTouchEvent(btn, 'touchstart');
    expect(tm.getSnapshot().jump).toBe(true);
    // Consumed — should be false on next read
    expect(tm.getSnapshot().jump).toBe(false);
    tm.destroy();
  });

  it('show/hide toggle visibility class', () => {
    const tm = new TouchManager();
    const container = document.getElementById('touch-controls');

    tm.show();
    expect(container.classList.contains('visible')).toBe(true);

    tm.hide();
    expect(container.classList.contains('visible')).toBe(false);
    tm.destroy();
  });

  it('destroy removes DOM element', () => {
    const tm = new TouchManager();
    expect(document.getElementById('touch-controls')).not.toBeNull();

    tm.destroy();
    expect(document.getElementById('touch-controls')).toBeNull();
  });

  it('touchcancel resets move state', () => {
    const tm = new TouchManager();
    const btn = document.querySelector('.btn-left');

    fireTouchEvent(btn, 'touchstart');
    expect(tm.getSnapshot().moveX).toBe(-1);

    fireTouchEvent(btn, 'touchcancel');
    expect(tm.getSnapshot().moveX).toBe(0);
    tm.destroy();
  });
});
