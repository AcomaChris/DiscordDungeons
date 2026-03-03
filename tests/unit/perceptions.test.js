import { describe, it, expect, vi } from 'vitest';

// Mock Constants so TILE_SIZE is available
vi.mock('../../client/src/core/Constants.js', () => ({
  TILE_SIZE: 16,
}));

const { buildPerceptionMessage } = await import('../../client/src/ai/Perceptions.js');

describe('buildPerceptionMessage', () => {
  const npcState = { x: 160, y: 192, z: 0, facing: 'down', isJumping: false };
  const playerState = { x: 128, y: 224, facing: 'up', name: 'Chris' };
  const mapSize = { width: 20, height: 15 };

  it('includes NPC position as tile coordinates', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, mapSize);
    // 160/16=10, 192/16=12
    expect(msg).toContain('tile (10, 12)');
  });

  it('includes NPC facing direction', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, mapSize);
    expect(msg).toContain('Your facing: down');
  });

  it('shows idle state when not jumping', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, mapSize);
    expect(msg).toContain('Your current state: idle');
  });

  it('shows jumping state when jumping', () => {
    const jumping = { ...npcState, isJumping: true };
    const msg = buildPerceptionMessage(jumping, playerState, null, mapSize);
    expect(msg).toContain('Your current state: jumping');
  });

  it('includes player info with distance and direction', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, mapSize);
    expect(msg).toContain('Player "Chris"');
    expect(msg).toContain('tiles away');
    // Player at (8, 14), NPC at (10, 12) → south-west
    expect(msg).toContain('south');
    expect(msg).toContain('west');
  });

  it('includes player facing direction', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, mapSize);
    expect(msg).toContain('Player is facing: up');
  });

  it('shows no previous action on first turn', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, mapSize);
    expect(msg).toContain('None — this is your first turn.');
  });

  it('shows completed action result', () => {
    const lastAction = { action: 'speak', args: { text: 'Hello!' }, status: 'completed' };
    const msg = buildPerceptionMessage(npcState, playerState, lastAction, mapSize);
    expect(msg).toContain('You chose: speak');
    expect(msg).toContain('Result: completed');
  });

  it('shows failed action result', () => {
    const lastAction = { action: 'move_to', args: { x: 5, y: 5 }, status: 'failed' };
    const msg = buildPerceptionMessage(npcState, playerState, lastAction, mapSize);
    expect(msg).toContain('Result: failed');
    expect(msg).toContain('move_to');
  });

  it('includes map size', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, mapSize);
    expect(msg).toContain('20x15 tiles');
  });

  it('works without player state', () => {
    const msg = buildPerceptionMessage(npcState, null, null, mapSize);
    expect(msg).toContain('[Perception]');
    expect(msg).not.toContain('[Player]');
  });

  it('works without map size', () => {
    const msg = buildPerceptionMessage(npcState, playerState, null, null);
    expect(msg).not.toContain('[World]');
  });
});
