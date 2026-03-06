import { describe, it, expect, beforeEach } from 'vitest';

// --- WS Instance Isolation Tests ---
// Tests that instanced maps isolate parties from each other.

function createPlayer(id, mapId = null, instanceId = null) {
  const sent = [];
  return {
    id,
    ws: {
      readyState: 1,
      send(data) { sent.push(JSON.parse(data)); },
    },
    sent,
    state: { x: 0, y: 0 },
    mapId,
    partyId: null,
    instanceId,
  };
}

// Same broadcast logic as server
function broadcastStates(room) {
  const groups = new Map();
  const unassigned = [];
  for (const [pid, peer] of room) {
    const key = peer.instanceId || peer.mapId;
    if (!key) {
      unassigned.push(peer);
      continue;
    }
    if (!groups.has(key)) groups.set(key, { states: {}, recipients: [] });
    const group = groups.get(key);
    if (peer.state) group.states[pid] = peer.state;
    group.recipients.push(peer);
  }
  for (const [, group] of groups) {
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

describe('WS Instance Isolation', () => {
  let room;

  beforeEach(() => {
    room = new Map();
  });

  it('isolates parties on the same instanced map', () => {
    // Party A on dungeon
    const p1 = createPlayer('1', 'dungeon', 'partyA:dungeon');
    const p2 = createPlayer('2', 'dungeon', 'partyA:dungeon');
    // Party B on same dungeon map but different instance
    const p3 = createPlayer('3', 'dungeon', 'partyB:dungeon');
    const p4 = createPlayer('4', 'dungeon', 'partyB:dungeon');
    p1.state = { x: 1 }; p2.state = { x: 2 };
    p3.state = { x: 3 }; p4.state = { x: 4 };
    room.set('1', p1); room.set('2', p2);
    room.set('3', p3); room.set('4', p4);

    broadcastStates(room);

    // Party A sees only party A
    expect(Object.keys(p1.sent[0].states)).toEqual(expect.arrayContaining(['1', '2']));
    expect(Object.keys(p1.sent[0].states)).not.toContain('3');

    // Party B sees only party B
    expect(Object.keys(p3.sent[0].states)).toEqual(expect.arrayContaining(['3', '4']));
    expect(Object.keys(p3.sent[0].states)).not.toContain('1');
  });

  it('solo instance isolates from party instance on same map', () => {
    const p1 = createPlayer('1', 'dungeon', 'solo1:dungeon');
    const p2 = createPlayer('2', 'dungeon', 'partyA:dungeon');
    p1.state = { x: 1 }; p2.state = { x: 2 };
    room.set('1', p1); room.set('2', p2);

    broadcastStates(room);

    expect(Object.keys(p1.sent[0].states)).toEqual(['1']);
    expect(Object.keys(p2.sent[0].states)).toEqual(['2']);
  });

  it('shared map (no instanceId) groups all players together', () => {
    const p1 = createPlayer('1', 'tavern', null);
    const p2 = createPlayer('2', 'tavern', null);
    p1.state = { x: 1 }; p2.state = { x: 2 };
    room.set('1', p1); room.set('2', p2);

    broadcastStates(room);

    expect(Object.keys(p1.sent[0].states)).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('mixes shared and instanced maps correctly', () => {
    // Shared tavern
    const p1 = createPlayer('1', 'tavern', null);
    const p2 = createPlayer('2', 'tavern', null);
    // Instanced dungeon
    const p3 = createPlayer('3', 'dungeon', 'partyA:dungeon');
    p1.state = { x: 1 }; p2.state = { x: 2 }; p3.state = { x: 3 };
    room.set('1', p1); room.set('2', p2); room.set('3', p3);

    broadcastStates(room);

    // Tavern players see each other
    expect(Object.keys(p1.sent[0].states)).toEqual(expect.arrayContaining(['1', '2']));
    expect(Object.keys(p1.sent[0].states)).not.toContain('3');

    // Dungeon player sees only themselves
    expect(Object.keys(p3.sent[0].states)).toEqual(['3']);
  });
});
