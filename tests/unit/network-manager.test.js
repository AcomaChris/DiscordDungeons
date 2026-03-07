import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import eventBus from '../../client/src/core/EventBus.js';
import {
  NETWORK_CONNECTED,
  NETWORK_PLAYER_JOINED,
  NETWORK_PLAYER_LEFT,
  NETWORK_STATE_UPDATE,
  NETWORK_ROOM_JOINED,
  NETWORK_PLAYER_IDENTITY,
  NETWORK_PLAYER_MAP_CHANGED,
  NETWORK_ROSTER,
} from '../../client/src/core/Events.js';
import { NetworkManager } from '../../client/src/network/NetworkManager.js';

// --- Mock WebSocket ---

class MockWebSocket {
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;

    // Auto-trigger open on next tick
    setTimeout(() => this.onopen && this.onopen(), 0);
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    if (this.onclose) this.onclose();
  }

  // Test helper: simulate a server message
  _receive(msg) {
    if (this.onmessage) this.onmessage({ data: JSON.stringify(msg) });
  }
}

describe('NetworkManager', () => {
  let originalWebSocket;

  beforeEach(() => {
    eventBus.reset();
    originalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
  });

  it('emits NETWORK_CONNECTED on WebSocket open', async () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_CONNECTED, () => calls.push('connected'));

    nm.connect('test-room');
    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toEqual(['connected']);
    nm.disconnect();
  });

  it('parses welcome message and sets playerId', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_ROOM_JOINED, (data) => calls.push(data));

    nm.connect('test-room');
    nm.ws._receive({ type: 'welcome', playerId: '42', roomId: 'test-room', colorIndex: 3 });

    expect(nm.playerId).toBe('42');
    expect(calls[0]).toEqual({ playerId: '42', roomId: 'test-room', colorIndex: 3 });
    nm.disconnect();
  });

  it('emits NETWORK_PLAYER_JOINED with playerName on playerJoined message', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_PLAYER_JOINED, (data) => calls.push(data));

    nm.connect('test-room');
    nm.ws._receive({ type: 'playerJoined', playerId: '99', colorIndex: 2, playerName: 'Hero' });

    expect(calls[0]).toEqual({ playerId: '99', colorIndex: 2, playerName: 'Hero', mapId: null });
    nm.disconnect();
  });

  it('emits NETWORK_PLAYER_LEFT on playerLeft message', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_PLAYER_LEFT, (data) => calls.push(data));

    nm.connect('test-room');
    nm.ws._receive({ type: 'playerLeft', playerId: '99' });

    expect(calls[0]).toEqual({ playerId: '99' });
    nm.disconnect();
  });

  it('does not throw when WebSocket constructor fails', () => {
    // Simulate mixed-content SecurityError
    globalThis.WebSocket = class {
      constructor() {
        throw new DOMException('Insecure WebSocket', 'SecurityError');
      }
    };

    const nm = new NetworkManager('ws://localhost:3001');
    expect(() => nm.connect('test-room')).not.toThrow();
    expect(nm.ws).toBeNull();
  });

  it('emits NETWORK_STATE_UPDATE excluding own player', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_STATE_UPDATE, (data) => calls.push(data));

    nm.connect('test-room');
    nm.ws._receive({ type: 'welcome', playerId: '1', roomId: 'test-room', colorIndex: 0 });
    nm.ws._receive({
      type: 'stateUpdate',
      states: {
        1: { x: 100, y: 200, facing: 'left' },
        2: { x: 300, y: 400, facing: 'right' },
      },
    });

    // Should exclude player '1' (self)
    expect(calls[0]).toEqual({ 2: { x: 300, y: 400, facing: 'right' } });
    nm.disconnect();
  });

  it('sends identify message on connect when identity is provided', async () => {
    const nm = new NetworkManager('ws://localhost:3001');
    nm.connect('test-room', { playerName: 'TestUser', avatarUrl: null });
    await new Promise((r) => setTimeout(r, 10));

    expect(nm.ws.sent[0]).toEqual({
      type: 'identify',
      playerName: 'TestUser',
      avatarUrl: null,
      sessionToken: null,
    });
    nm.disconnect();
  });

  it('emits NETWORK_PLAYER_IDENTITY on playerIdentity message', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_PLAYER_IDENTITY, (data) => calls.push(data));

    nm.connect('test-room');
    nm.ws._receive({
      type: 'playerIdentity',
      playerId: '5',
      playerName: 'Hero',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });

    expect(calls[0]).toEqual({
      playerId: '5',
      playerName: 'Hero',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    });
    nm.disconnect();
  });

  // --- Map tracking ---

  it('sends mapChange message via sendMapChange', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    nm.connect('test-room');
    nm.sendMapChange('tavern');

    expect(nm.ws.sent).toContainEqual({ type: 'mapChange', mapId: 'tavern', instanced: false });
    expect(nm.currentMapId).toBe('tavern');
    nm.disconnect();
  });

  it('emits NETWORK_PLAYER_MAP_CHANGED on playerMapChanged message', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_PLAYER_MAP_CHANGED, (data) => calls.push(data));

    nm.connect('test-room');
    nm.ws._receive({
      type: 'playerMapChanged',
      playerId: '5',
      fromMap: 'tavern',
      toMap: 'dungeon',
    });

    expect(calls[0]).toEqual({
      playerId: '5',
      fromMap: 'tavern',
      toMap: 'dungeon',
    });
    nm.disconnect();
  });

  it('emits NETWORK_ROSTER on roster message', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    const calls = [];
    eventBus.on(NETWORK_ROSTER, (data) => calls.push(data));

    nm.connect('test-room');
    nm.ws._receive({
      type: 'roster',
      players: [
        { playerId: '2', colorIndex: 1, playerName: 'Alice', mapId: 'tavern' },
        { playerId: '3', colorIndex: 2, playerName: 'Bob', mapId: null },
      ],
    });

    expect(calls[0].players).toHaveLength(2);
    expect(calls[0].players[0].mapId).toBe('tavern');
    nm.disconnect();
  });

  it('re-sends mapChange on reconnect (welcome after mapId set)', () => {
    const nm = new NetworkManager('ws://localhost:3001');
    nm.connect('test-room');
    nm.sendMapChange('tavern');
    nm.ws.sent.length = 0; // clear previous sends

    // Simulate reconnect: new welcome message
    nm.ws._receive({ type: 'welcome', playerId: '42', roomId: 'test-room', colorIndex: 0 });

    expect(nm.ws.sent).toContainEqual({ type: 'mapChange', mapId: 'tavern', instanced: false });
    nm.disconnect();
  });
});
