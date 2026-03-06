// @vitest-environment jsdom
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

  // --- DOM creation ---

  it('creates DOM overlay with joystick and action buttons on touch devices', () => {
    const tm = new TouchManager();
    const container = document.getElementById('touch-controls');
    expect(container).not.toBeNull();
    expect(container.querySelector('.joystick-base')).not.toBeNull();
    expect(container.querySelector('.joystick-knob')).not.toBeNull();
    expect(container.querySelector('.btn-jump')).not.toBeNull();
    expect(container.querySelector('.btn-sprint')).not.toBeNull();
    tm.destroy();
  });

  it('does not create DOM on non-touch devices', () => {
    delete window.ontouchstart;
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0, configurable: true });

    const tm = new TouchManager();
    expect(document.getElementById('touch-controls')).toBeNull();
    tm.destroy();
  });

  // --- Default state ---

  it('getSnapshot returns neutral state by default', () => {
    const tm = new TouchManager();
    expect(tm.getSnapshot()).toEqual({ moveX: 0, moveY: 0, sprint: false, jump: false, interact: false });
    tm.destroy();
  });

  // --- Joystick math ---

  it('joystick touch right produces positive moveX', () => {
    const tm = new TouchManager();
    tm._baseRadius = 70;
    tm._baseCenterX = 100;
    tm._baseCenterY = 100;

    // Touch full right
    tm._processJoystickTouch(170, 100);
    const snap = tm.getSnapshot();
    expect(snap.moveX).toBeCloseTo(1.0, 1);
    expect(snap.moveY).toBeCloseTo(0, 1);
    tm.destroy();
  });

  it('joystick touch left produces negative moveX', () => {
    const tm = new TouchManager();
    tm._baseRadius = 70;
    tm._baseCenterX = 100;
    tm._baseCenterY = 100;

    tm._processJoystickTouch(30, 100);
    const snap = tm.getSnapshot();
    expect(snap.moveX).toBeCloseTo(-1.0, 1);
    expect(snap.moveY).toBeCloseTo(0, 1);
    tm.destroy();
  });

  it('joystick touch down produces positive moveY', () => {
    const tm = new TouchManager();
    tm._baseRadius = 70;
    tm._baseCenterX = 100;
    tm._baseCenterY = 100;

    tm._processJoystickTouch(100, 170);
    const snap = tm.getSnapshot();
    expect(snap.moveX).toBeCloseTo(0, 1);
    expect(snap.moveY).toBeCloseTo(1.0, 1);
    tm.destroy();
  });

  it('joystick dead zone returns zero', () => {
    const tm = new TouchManager();
    tm._baseRadius = 70;
    tm._baseCenterX = 100;
    tm._baseCenterY = 100;

    // Touch within 15% = 10.5px of 70px radius
    tm._processJoystickTouch(105, 100);
    expect(tm.getSnapshot().moveX).toBe(0);
    expect(tm.getSnapshot().moveY).toBe(0);
    tm.destroy();
  });

  it('joystick clamps to unit circle when touch exceeds radius', () => {
    const tm = new TouchManager();
    tm._baseRadius = 70;
    tm._baseCenterX = 100;
    tm._baseCenterY = 100;

    // Touch far beyond the base boundary
    tm._processJoystickTouch(300, 100);
    const snap = tm.getSnapshot();
    expect(snap.moveX).toBeCloseTo(1.0, 1);
    expect(snap.moveY).toBeCloseTo(0, 1);
    tm.destroy();
  });

  it('diagonal joystick produces proportional values', () => {
    const tm = new TouchManager();
    tm._baseRadius = 70;
    tm._baseCenterX = 100;
    tm._baseCenterY = 100;

    // Touch at 45 degrees (equal dx, dy)
    tm._processJoystickTouch(170, 170);
    const snap = tm.getSnapshot();
    expect(snap.moveX).toBeGreaterThan(0);
    expect(snap.moveY).toBeGreaterThan(0);
    expect(Math.abs(snap.moveX - snap.moveY)).toBeLessThan(0.01);
    tm.destroy();
  });

  it('partial joystick tilt produces values less than 1', () => {
    const tm = new TouchManager();
    tm._baseRadius = 70;
    tm._baseCenterX = 100;
    tm._baseCenterY = 100;

    // Touch halfway right (35px of 70px radius)
    tm._processJoystickTouch(135, 100);
    const snap = tm.getSnapshot();
    expect(snap.moveX).toBeGreaterThan(0);
    expect(snap.moveX).toBeLessThan(1);
    expect(snap.moveY).toBeCloseTo(0, 1);
    tm.destroy();
  });

  // --- Action buttons ---

  it('jump button sets jump to true', () => {
    const tm = new TouchManager();
    const btn = document.querySelector('.btn-jump');

    fireTouchEvent(btn, 'touchstart');
    expect(tm.getSnapshot().jump).toBe(true);

    fireTouchEvent(btn, 'touchend');
    expect(tm.getSnapshot().jump).toBe(false);
    tm.destroy();
  });

  it('sprint button sets sprint to true', () => {
    const tm = new TouchManager();
    const btn = document.querySelector('.btn-sprint');

    fireTouchEvent(btn, 'touchstart');
    expect(tm.getSnapshot().sprint).toBe(true);

    fireTouchEvent(btn, 'touchend');
    expect(tm.getSnapshot().sprint).toBe(false);
    tm.destroy();
  });

  it('touchcancel on sprint button resets sprint', () => {
    const tm = new TouchManager();
    const btn = document.querySelector('.btn-sprint');

    fireTouchEvent(btn, 'touchstart');
    expect(tm.getSnapshot().sprint).toBe(true);

    fireTouchEvent(btn, 'touchcancel');
    expect(tm.getSnapshot().sprint).toBe(false);
    tm.destroy();
  });

  // --- Ability visibility ---

  it('hides jump button when jump ability not equipped', () => {
    const tm = new TouchManager();
    const mockAM = { has: (id) => id !== 'jump' };
    tm.setAbilityManager(mockAM);
    expect(document.querySelector('.btn-jump').style.display).toBe('none');
    tm.destroy();
  });

  it('hides sprint button when movement ability not equipped', () => {
    const tm = new TouchManager();
    const mockAM = { has: (id) => id !== 'movement' };
    tm.setAbilityManager(mockAM);
    expect(document.querySelector('.btn-sprint').style.display).toBe('none');
    tm.destroy();
  });

  it('shows both buttons when abilities are equipped', () => {
    const tm = new TouchManager();
    const mockAM = { has: () => true };
    tm.setAbilityManager(mockAM);
    expect(document.querySelector('.btn-jump').style.display).toBe('');
    expect(document.querySelector('.btn-sprint').style.display).toBe('');
    tm.destroy();
  });

  // --- Visibility & cleanup ---

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
});
