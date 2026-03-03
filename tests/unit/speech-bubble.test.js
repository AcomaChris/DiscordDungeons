import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpeechBubble } from '../../client/src/entities/SpeechBubble.js';

// --- Speech Bubble Tests ---
// Tests the SpeechBubble lifecycle: show, replace, update position, destroy.

function mockScene() {
  const texts = [];
  const rects = [];
  return {
    add: {
      text: (_x, _y, _str, _style) => {
        const t = {
          x: _x, y: _y, text: _str, alpha: 1, visible: false, depth: 0,
          _origin: { x: 0.5, y: 1 },
          setText(s) { t.text = s; return t; },
          setOrigin(ox, oy) { t._origin = { x: ox, y: oy }; return t; },
          setVisible(v) { t.visible = v; return t; },
          setPosition(x, y) { t.x = x; t.y = y; return t; },
          setAlpha(a) { t.alpha = a; return t; },
          setDepth(d) { t.depth = d; return t; },
          getBounds() { return { width: 60, height: 12 }; },
          destroy: vi.fn(),
        };
        texts.push(t);
        return t;
      },
      rectangle: (_x, _y, _w, _h, _color, _alpha) => {
        const r = {
          x: _x, y: _y, width: _w, height: _h, alpha: _alpha, visible: false, depth: 0,
          _origin: { x: 0.5, y: 1 },
          setOrigin(ox, oy) { r._origin = { x: ox, y: oy }; return r; },
          setVisible(v) { r.visible = v; return r; },
          setPosition(x, y) { r.x = x; r.y = y; return r; },
          setSize(w, h) { r.width = w; r.height = h; return r; },
          setAlpha(a) { r.alpha = a; return r; },
          setDepth(d) { r.depth = d; return r; },
          destroy: vi.fn(),
        };
        rects.push(r);
        return r;
      },
    },
    time: {
      delayedCall: vi.fn((_delay, cb) => {
        const timer = { destroy: vi.fn(), _cb: cb };
        return timer;
      }),
    },
    tweens: {
      add: vi.fn(),
      killTweensOf: vi.fn(),
    },
    _texts: texts,
    _rects: rects,
  };
}

describe('SpeechBubble', () => {
  let scene;
  let bubble;

  beforeEach(() => {
    scene = mockScene();
    bubble = new SpeechBubble(scene);
  });

  it('starts not showing', () => {
    expect(bubble.isShowing).toBe(false);
  });

  it('creates text and background on first show()', () => {
    bubble.show('Hello!', 100, 50);
    expect(scene._texts).toHaveLength(1);
    expect(scene._rects).toHaveLength(1);
    expect(scene._texts[0].text).toBe('Hello!');
    expect(bubble.isShowing).toBe(true);
  });

  it('positions text at given coordinates', () => {
    bubble.show('Hello!', 100, 50);
    expect(scene._texts[0].x).toBe(100);
    expect(scene._texts[0].y).toBe(50);
  });

  it('replaces text on subsequent show() calls', () => {
    bubble.show('First', 100, 50);
    bubble.show('Second', 100, 50);
    // Should reuse same text object, not create a new one
    expect(scene._texts).toHaveLength(1);
    expect(scene._texts[0].text).toBe('Second');
  });

  it('sets up a delayed fade timer', () => {
    bubble.show('Hello!', 100, 50, 3000);
    expect(scene.time.delayedCall).toHaveBeenCalledTimes(1);
    // Hold time = duration - fade duration = 3000 - 800 = 2200ms
    expect(scene.time.delayedCall.mock.calls[0][0]).toBe(2200);
  });

  it('update() repositions text and background', () => {
    bubble.show('Hello!', 100, 50);
    bubble.update(200, 80);
    expect(scene._texts[0].x).toBe(200);
    expect(scene._texts[0].y).toBe(80);
    expect(scene._rects[0].x).toBe(200);
    expect(scene._rects[0].y).toBe(80);
  });

  it('update() does nothing when not showing', () => {
    bubble.update(200, 80);
    // No text objects should exist
    expect(scene._texts).toHaveLength(0);
  });

  it('setDepth() sets background and text depth', () => {
    bubble.show('Hello!', 100, 50);
    bubble.setDepth(500);
    expect(scene._rects[0].depth).toBe(500);
    expect(scene._texts[0].depth).toBe(501);
  });

  it('destroy() cleans up objects', () => {
    bubble.show('Hello!', 100, 50);
    const textDestroy = scene._texts[0].destroy;
    const rectDestroy = scene._rects[0].destroy;
    bubble.destroy();
    expect(textDestroy).toHaveBeenCalled();
    expect(rectDestroy).toHaveBeenCalled();
    expect(bubble.isShowing).toBe(false);
  });

  it('destroy() is safe to call when never shown', () => {
    expect(() => bubble.destroy()).not.toThrow();
  });
});
