import { describe, it, expect } from 'vitest';
import {
  MOVE_SPEED,
  JUMP_VELOCITY,
  CHAR_WIDTH,
  CHAR_HEIGHT,
  FLOOR_HEIGHT,
  NETWORK_SEND_RATE,
  LOCAL_PLAYER_COLOR,
  REMOTE_PLAYER_COLORS,
} from '../../client/src/core/Constants.js';

describe('Game constants', () => {
  it('movement values are sane', () => {
    expect(MOVE_SPEED).toBeGreaterThan(0);
    expect(JUMP_VELOCITY).toBeLessThan(0);
  });

  it('character dimensions are positive', () => {
    expect(CHAR_WIDTH).toBeGreaterThan(0);
    expect(CHAR_HEIGHT).toBeGreaterThan(0);
    expect(CHAR_HEIGHT).toBeGreaterThan(CHAR_WIDTH);
  });

  it('floor height is positive', () => {
    expect(FLOOR_HEIGHT).toBeGreaterThan(0);
  });

  it('network send rate is reasonable', () => {
    expect(NETWORK_SEND_RATE).toBeGreaterThanOrEqual(5);
    expect(NETWORK_SEND_RATE).toBeLessThanOrEqual(60);
  });

  it('has enough remote player colors', () => {
    expect(REMOTE_PLAYER_COLORS.length).toBeGreaterThanOrEqual(4);
  });

  it('local player color is a number', () => {
    expect(typeof LOCAL_PLAYER_COLOR).toBe('number');
  });
});
