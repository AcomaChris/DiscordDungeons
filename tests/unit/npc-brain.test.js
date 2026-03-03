import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- NPCBrain Tests ---
// Tests the AI decision loop state machine with mocked BehaviorEngineClient.

// Mock the BehaviorEngineClient
const mockCreateSession = vi.fn();
const mockCreateAgent = vi.fn();
const mockGenerateAction = vi.fn();

vi.mock('../../client/src/behavior-engine/BehaviorEngineClient.js', () => ({
  BehaviorEngineClient: vi.fn(() => ({
    createSession: mockCreateSession,
    createAgent: mockCreateAgent,
    generateAction: mockGenerateAction,
  })),
}));

vi.mock('../../client/src/core/Constants.js', () => ({
  TILE_SIZE: 16,
}));

const { NPCBrain } = await import('../../client/src/ai/NPCBrain.js');

function createMockNPC() {
  return {
    getState: vi.fn(() => ({
      x: 160, y: 192, z: 0, facing: 'down', isJumping: false,
    })),
    sprite: { x: 160 },
    _groundY: 192,
    moveTo: vi.fn(() => true),
    jump: vi.fn(),
    speechBubble: { show: vi.fn() },
    onActionComplete: null,
  };
}

function createMockPlayer() {
  return {
    sprite: { x: 128 },
    _groundY: 224,
    facing: 'up',
    playerName: 'TestPlayer',
  };
}

describe('NPCBrain', () => {
  let brain;
  let npc;
  let player;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSession.mockResolvedValue({ id: 'sess-123' });
    mockCreateAgent.mockResolvedValue({ id: 'agent-456' });
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'idle', args: {} },
      moment_id: 'moment-1',
    });

    npc = createMockNPC();
    player = createMockPlayer();
    brain = new NPCBrain(npc, player, {
      projectId: 'proj-test',
      proxyUrl: 'http://localhost:3001',
    });
  });

  it('starts in initializing state', () => {
    expect(brain.state).toBe('initializing');
  });

  it('transitions to idle after successful init', async () => {
    await brain.init();
    expect(brain.state).toBe('idle');
    expect(mockCreateSession).toHaveBeenCalled();
    expect(mockCreateAgent).toHaveBeenCalled();
  });

  it('transitions to error on init failure', async () => {
    mockCreateSession.mockRejectedValue(new Error('API down'));
    await brain.init();
    expect(brain.state).toBe('error');
  });

  it('does not update while initializing', () => {
    brain.update(16);
    expect(brain.state).toBe('initializing');
  });

  it('does not update in error state', async () => {
    mockCreateSession.mockRejectedValue(new Error('fail'));
    await brain.init();
    brain.update(16);
    expect(brain.state).toBe('error');
  });

  it('triggers think after idle timer expires', async () => {
    await brain.init();
    expect(brain.state).toBe('idle');

    // Fast-forward past max idle time
    brain.update(20000);
    // Should have transitioned to thinking (then async think runs)
    expect(brain.state).toBe('thinking');
  });

  it('executes move_to action', async () => {
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'move_to', args: { x: 5, y: 8 } },
    });
    await brain.init();

    // Trigger thinking
    brain.update(20000);
    // Wait for async think to complete
    await vi.waitFor(() => expect(brain.state).toBe('acting'));

    expect(npc.moveTo).toHaveBeenCalledWith(5, 8);
  });

  it('handles failed move_to (no path)', async () => {
    npc.moveTo.mockReturnValue(false);
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'move_to', args: { x: 5, y: 8 } },
    });
    await brain.init();
    brain.update(20000);
    await vi.waitFor(() => expect(brain.state).toBe('idle'));
  });

  it('executes speak action', async () => {
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'speak', args: { text: 'Hello!' } },
    });
    await brain.init();
    brain.update(20000);
    await vi.waitFor(() => expect(brain.state).toBe('acting'));

    expect(npc.speechBubble.show).toHaveBeenCalledWith(
      'Hello!', 160, expect.any(Number), expect.any(Number),
    );
  });

  it('speak completes after duration', async () => {
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'speak', args: { text: 'Hi' } },
    });
    await brain.init();
    brain.update(20000);
    await vi.waitFor(() => expect(brain.state).toBe('acting'));

    // Advance time past speak duration
    brain.update(10000);
    expect(brain.state).toBe('idle');
  });

  it('executes jump action', async () => {
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'jump', args: {} },
    });
    await brain.init();
    brain.update(20000);
    await vi.waitFor(() => expect(brain.state).toBe('acting'));

    expect(npc.jump).toHaveBeenCalled();
    expect(npc.onActionComplete).toBeTypeOf('function');
  });

  it('jump completes via onActionComplete callback', async () => {
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'jump', args: {} },
    });
    await brain.init();
    brain.update(20000);
    await vi.waitFor(() => expect(brain.state).toBe('acting'));

    // Simulate jump landing
    npc.onActionComplete({ action: 'jump', status: 'completed' });
    expect(brain.state).toBe('idle');
  });

  it('idle action completes after timer', async () => {
    mockGenerateAction.mockResolvedValue({
      function_call: { name: 'idle', args: {} },
    });
    await brain.init();
    brain.update(20000);
    await vi.waitFor(() => expect(brain.state).toBe('acting'));

    brain.update(3000); // idle action = 2500ms
    expect(brain.state).toBe('idle');
  });

  it('setMapSize stores dimensions', () => {
    brain.setMapSize(20, 15);
    expect(brain._mapSize).toEqual({ width: 20, height: 15 });
  });

  it('destroy prevents further updates', async () => {
    await brain.init();
    brain.destroy();
    expect(brain.state).toBe('error');
    brain.update(20000); // should not throw
    expect(brain.state).toBe('error');
  });

  it('proximity change triggers think', async () => {
    await brain.init();

    // Player far away initially — set playerWasNear to match
    brain._playerWasNear = false;

    // Move player close to NPC
    player.sprite.x = 160;
    player._groundY = 192;

    brain.update(16); // proximity changed → triggers think
    expect(brain.state).toBe('thinking');
  });
});
