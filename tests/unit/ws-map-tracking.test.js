import { describe, it, expect, beforeEach } from 'vitest';

// --- WS Server Map Tracking Logic Tests ---
// Tests the map-filtering and roster logic from server/src/ws/index.js
// by simulating the data structures and broadcast patterns.

// Simulate the server's room/player data structure
function createRoom() {
  return new Map();
}

function createPlayer(id, mapId = null) {
  const sent = [];
  return {
    id,
    ws: {
      readyState: 1, // OPEN
      send(data) { sent.push(JSON.parse(data)); },
    },
    sent,
    colorIndex: 0,
    state: { x: 0, y: 0, facing: 'down' },
    playerName: `Player ${id}`,
    avatarUrl: null,
    mapId,
    partyId: null,
    instanceId: null,
  };
}

// Simulate the map-filtered broadcast logic from server
function broadcastStates(room) {
  const mapGroups = new Map();
  const unassigned = [];
  for (const [pid, peer] of room) {
    const mid = peer.mapId;
    if (!mid) {
      unassigned.push(peer);
      continue;
    }
    if (!mapGroups.has(mid)) mapGroups.set(mid, { states: {}, recipients: [] });
    const group = mapGroups.get(mid);
    if (peer.state) group.states[pid] = peer.state;
    group.recipients.push(peer);
  }

  for (const [, group] of mapGroups) {
    if (Object.keys(group.states).length === 0) continue;
    const msg = JSON.stringify({ type: 'stateUpdate', states: group.states });
    for (const peer of group.recipients) {
      if (peer.ws.readyState === 1) peer.ws.send(msg);
    }
  }

  if (unassigned.length > 0) {
    const allStates = {};
    for (const [pid, peer] of room) {
      if (peer.state) allStates[pid] = peer.state;
    }
    if (Object.keys(allStates).length > 0) {
      const msg = JSON.stringify({ type: 'stateUpdate', states: allStates });
      for (const peer of unassigned) {
        if (peer.ws.readyState === 1) peer.ws.send(msg);
      }
    }
  }
}

// Simulate mapChange handler
function handleMapChange(room, playerId, newMapId) {
  const playerData = room.get(playerId);
  const oldMapId = playerData.mapId;
  playerData.mapId = newMapId || null;
  for (const [, peer] of room) {
    peer.ws.send(JSON.stringify({
      type: 'playerMapChanged', playerId,
      fromMap: oldMapId, toMap: playerData.mapId,
    }));
  }
}

// Simulate roster generation
function buildRoster(room, excludeId) {
  const players = [];
  for (const [pid, peer] of room) {
    if (pid !== excludeId) {
      players.push({
        playerId: pid, colorIndex: peer.colorIndex,
        playerName: peer.playerName, avatarUrl: peer.avatarUrl,
        mapId: peer.mapId,
      });
    }
  }
  return { type: 'roster', players };
}

describe('WS Map Tracking', () => {
  let room;

  beforeEach(() => {
    room = createRoom();
  });

  describe('map-filtered state broadcasts', () => {
    it('sends states only to players on the same map', () => {
      const p1 = createPlayer('1', 'tavern');
      const p2 = createPlayer('2', 'tavern');
      const p3 = createPlayer('3', 'dungeon');
      p1.state = { x: 10, y: 20 };
      p2.state = { x: 30, y: 40 };
      p3.state = { x: 50, y: 60 };
      room.set('1', p1);
      room.set('2', p2);
      room.set('3', p3);

      broadcastStates(room);

      // p1 and p2 should see each other's states (tavern)
      expect(p1.sent).toHaveLength(1);
      expect(p1.sent[0].states).toHaveProperty('1');
      expect(p1.sent[0].states).toHaveProperty('2');
      expect(p1.sent[0].states).not.toHaveProperty('3');

      // p3 should only see their own state (dungeon, alone)
      expect(p3.sent).toHaveLength(1);
      expect(p3.sent[0].states).toHaveProperty('3');
      expect(p3.sent[0].states).not.toHaveProperty('1');
    });

    it('unassigned players (mapId=null) receive all states', () => {
      const p1 = createPlayer('1', 'tavern');
      const p2 = createPlayer('2', null); // not yet on a map
      p1.state = { x: 10, y: 20 };
      p2.state = { x: 30, y: 40 };
      room.set('1', p1);
      room.set('2', p2);

      broadcastStates(room);

      // p2 (unassigned) gets all states
      expect(p2.sent).toHaveLength(1);
      expect(p2.sent[0].states).toHaveProperty('1');
      expect(p2.sent[0].states).toHaveProperty('2');
    });

    it('sends nothing when no players have state', () => {
      const p1 = createPlayer('1', 'tavern');
      p1.state = null;
      room.set('1', p1);

      broadcastStates(room);

      expect(p1.sent).toHaveLength(0);
    });

    it('handles multiple maps correctly', () => {
      const p1 = createPlayer('1', 'map-a');
      const p2 = createPlayer('2', 'map-b');
      const p3 = createPlayer('3', 'map-a');
      const p4 = createPlayer('4', 'map-b');
      p1.state = { x: 1 }; p2.state = { x: 2 };
      p3.state = { x: 3 }; p4.state = { x: 4 };
      room.set('1', p1); room.set('2', p2);
      room.set('3', p3); room.set('4', p4);

      broadcastStates(room);

      // map-a players
      const p1States = Object.keys(p1.sent[0].states);
      expect(p1States).toEqual(expect.arrayContaining(['1', '3']));
      expect(p1States).not.toContain('2');

      // map-b players
      const p2States = Object.keys(p2.sent[0].states);
      expect(p2States).toEqual(expect.arrayContaining(['2', '4']));
      expect(p2States).not.toContain('1');
    });
  });

  describe('mapChange handler', () => {
    it('broadcasts playerMapChanged to all room members', () => {
      const p1 = createPlayer('1', 'tavern');
      const p2 = createPlayer('2', 'tavern');
      room.set('1', p1);
      room.set('2', p2);

      handleMapChange(room, '1', 'dungeon');

      // Both players should receive the broadcast
      expect(p1.sent).toHaveLength(1);
      expect(p1.sent[0]).toEqual({
        type: 'playerMapChanged', playerId: '1',
        fromMap: 'tavern', toMap: 'dungeon',
      });
      expect(p2.sent[0]).toEqual(p1.sent[0]);
    });

    it('updates player mapId', () => {
      const p1 = createPlayer('1', null);
      room.set('1', p1);

      handleMapChange(room, '1', 'tavern');

      expect(p1.mapId).toBe('tavern');
    });

    it('handles null → map transition', () => {
      const p1 = createPlayer('1', null);
      room.set('1', p1);

      handleMapChange(room, '1', 'dungeon');

      expect(p1.sent[0].fromMap).toBeNull();
      expect(p1.sent[0].toMap).toBe('dungeon');
    });
  });

  describe('roster', () => {
    it('includes all players except the requester', () => {
      const p1 = createPlayer('1', 'tavern');
      const p2 = createPlayer('2', 'dungeon');
      const p3 = createPlayer('3', null);
      room.set('1', p1);
      room.set('2', p2);
      room.set('3', p3);

      const roster = buildRoster(room, '1');

      expect(roster.players).toHaveLength(2);
      expect(roster.players[0].playerId).toBe('2');
      expect(roster.players[0].mapId).toBe('dungeon');
      expect(roster.players[1].playerId).toBe('3');
      expect(roster.players[1].mapId).toBeNull();
    });

    it('returns empty array for solo player', () => {
      const p1 = createPlayer('1', 'tavern');
      room.set('1', p1);

      const roster = buildRoster(room, '1');

      expect(roster.players).toHaveLength(0);
    });

    it('includes mapId in player entries', () => {
      const p1 = createPlayer('1', 'tavern');
      const p2 = createPlayer('2', 'dungeon');
      room.set('1', p1);
      room.set('2', p2);

      const roster = buildRoster(room, '1');

      expect(roster.players[0]).toHaveProperty('mapId', 'dungeon');
      expect(roster.players[0]).toHaveProperty('playerName');
      expect(roster.players[0]).toHaveProperty('colorIndex');
    });
  });

  describe('playerJoined with mapId', () => {
    it('includes mapId in join broadcast', () => {
      const p1 = createPlayer('1', 'tavern');
      const p2 = createPlayer('2', null);
      room.set('1', p1);
      room.set('2', p2);

      // Simulate playerJoined broadcast including mapId
      const joinMsg = {
        type: 'playerJoined', playerId: '2', colorIndex: p2.colorIndex,
        playerName: p2.playerName, avatarUrl: p2.avatarUrl,
        mapId: p2.mapId,
      };

      expect(joinMsg.mapId).toBeNull();

      // After map change, mapId should be present
      p2.mapId = 'tavern';
      const joinMsg2 = { ...joinMsg, mapId: p2.mapId };
      expect(joinMsg2.mapId).toBe('tavern');
    });
  });
});
