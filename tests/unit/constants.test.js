import { describe, it, expect } from 'vitest';
import {
  MOVE_SPEED,
  TILE_SIZE,
  CHAR_WIDTH,
  CHAR_HEIGHT,
  NETWORK_SEND_RATE,
  MAX_PLAYERS,
  PLAYER_COLORS,
  CAMERA_ZOOM,
  DEPTH_ABOVE_PLAYER,
} from '../../client/src/core/Constants.js';

describe('Game constants', () => {
  it('movement speed is positive', () => {
    expect(MOVE_SPEED).toBeGreaterThan(0);
  });

  it('tile size is positive', () => {
    expect(TILE_SIZE).toBeGreaterThan(0);
  });

  it('character dimensions are positive', () => {
    expect(CHAR_WIDTH).toBeGreaterThan(0);
    expect(CHAR_HEIGHT).toBeGreaterThan(0);
    expect(CHAR_HEIGHT).toBeGreaterThan(CHAR_WIDTH);
  });

  it('character width matches tile size for 3/4 view', () => {
    expect(CHAR_WIDTH).toBe(TILE_SIZE);
  });

  it('network send rate is reasonable', () => {
    expect(NETWORK_SEND_RATE).toBeGreaterThanOrEqual(5);
    expect(NETWORK_SEND_RATE).toBeLessThanOrEqual(60);
  });

  it('has exactly MAX_PLAYERS colors', () => {
    expect(PLAYER_COLORS.length).toBe(MAX_PLAYERS);
    PLAYER_COLORS.forEach((c) => expect(typeof c).toBe('number'));
  });

  it('all player colors are unique', () => {
    const unique = new Set(PLAYER_COLORS);
    expect(unique.size).toBe(PLAYER_COLORS.length);
  });

  it('CAMERA_ZOOM is positive', () => {
    expect(CAMERA_ZOOM).toBeGreaterThan(0);
  });

  it('DEPTH_ABOVE_PLAYER is large enough to be above any Y position', () => {
    expect(DEPTH_ABOVE_PLAYER).toBeGreaterThanOrEqual(10000);
  });
});
