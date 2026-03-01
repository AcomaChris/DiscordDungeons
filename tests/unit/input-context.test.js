import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  acquireInputFocus,
  releaseInputFocus,
  isGameInputActive,
  _resetForTesting,
} from '../../client/src/core/InputContext.js';
import eventBus from '../../client/src/core/EventBus.js';
import { INPUT_FOCUS_CHANGED } from '../../client/src/core/Events.js';

describe('InputContext', () => {
  beforeEach(() => {
    _resetForTesting();
    eventBus.reset();
  });

  it('game input is active by default', () => {
    expect(isGameInputActive()).toBe(true);
  });

  it('acquireInputFocus suppresses game input', () => {
    acquireInputFocus();
    expect(isGameInputActive()).toBe(false);
  });

  it('releaseInputFocus restores game input', () => {
    acquireInputFocus();
    releaseInputFocus();
    expect(isGameInputActive()).toBe(true);
  });

  it('supports nested focus (two acquires need two releases)', () => {
    acquireInputFocus();
    acquireInputFocus();
    expect(isGameInputActive()).toBe(false);

    releaseInputFocus();
    expect(isGameInputActive()).toBe(false);

    releaseInputFocus();
    expect(isGameInputActive()).toBe(true);
  });

  it('counter does not go below zero', () => {
    releaseInputFocus();
    releaseInputFocus();
    expect(isGameInputActive()).toBe(true);

    // One acquire should still work after extra releases
    acquireInputFocus();
    expect(isGameInputActive()).toBe(false);
  });

  // --- Event emission ---

  it('emits INPUT_FOCUS_CHANGED {active:false} on first acquire', () => {
    const calls = [];
    eventBus.on(INPUT_FOCUS_CHANGED, (data) => calls.push(data));

    acquireInputFocus();
    expect(calls).toEqual([{ active: false }]);
  });

  it('does not emit on second acquire (already suppressed)', () => {
    acquireInputFocus();

    const calls = [];
    eventBus.on(INPUT_FOCUS_CHANGED, (data) => calls.push(data));

    acquireInputFocus();
    expect(calls).toHaveLength(0);
  });

  it('emits INPUT_FOCUS_CHANGED {active:true} on final release', () => {
    acquireInputFocus();

    const calls = [];
    eventBus.on(INPUT_FOCUS_CHANGED, (data) => calls.push(data));

    releaseInputFocus();
    expect(calls).toEqual([{ active: true }]);
  });

  it('does not emit on intermediate release (still suppressed)', () => {
    acquireInputFocus();
    acquireInputFocus();

    const calls = [];
    eventBus.on(INPUT_FOCUS_CHANGED, (data) => calls.push(data));

    releaseInputFocus();
    expect(calls).toHaveLength(0);
  });

  it('does not emit on release when counter is already zero', () => {
    const calls = [];
    eventBus.on(INPUT_FOCUS_CHANGED, (data) => calls.push(data));

    releaseInputFocus();
    expect(calls).toHaveLength(0);
  });
});
