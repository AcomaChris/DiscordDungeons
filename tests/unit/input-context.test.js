import { describe, it, expect, beforeEach } from 'vitest';
import {
  acquireInputFocus,
  releaseInputFocus,
  isGameInputActive,
  _resetForTesting,
} from '../../client/src/core/InputContext.js';

describe('InputContext', () => {
  beforeEach(() => {
    _resetForTesting();
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
});
