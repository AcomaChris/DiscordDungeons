const { WebSocketServer } = require('ws');

// --- WebSocket Game Server ---
// Minimal relay: room management + state broadcast at 10Hz.
// AGENT: This is a relay server, not an authoritative game server.
// It trusts client state. Anti-cheat is out of scope for the prototype.

const PORT = process.env.WS_PORT || 3001;
const BROADCAST_RATE = 100; // ms (10Hz)

const rooms = new Map();
let nextPlayerId = 1;

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const roomId = url.searchParams.get('room') || 'default';
  const playerId = String(nextPlayerId++);

  // --- Room join ---
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  const room = rooms.get(roomId);

  const colorIndex = room.size;
  room.set(playerId, { ws, colorIndex, state: null });

  // Tell the new player their ID
  ws.send(JSON.stringify({ type: 'welcome', playerId, roomId }));

  // Tell existing players about the new player, and vice versa
  for (const [pid, peer] of room) {
    if (pid !== playerId) {
      peer.ws.send(JSON.stringify({ type: 'playerJoined', playerId, colorIndex }));
      ws.send(JSON.stringify({ type: 'playerJoined', playerId: pid, colorIndex: peer.colorIndex }));
    }
  }

  // --- Message handling ---
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'state') {
        const peer = room.get(playerId);
        if (peer) peer.state = msg.payload;
      }
    } catch {
      // Ignore malformed messages
    }
  });

  // --- Disconnect ---
  ws.on('close', () => {
    room.delete(playerId);
    for (const [, peer] of room) {
      peer.ws.send(JSON.stringify({ type: 'playerLeft', playerId }));
    }
    if (room.size === 0) rooms.delete(roomId);
  });
});

// --- State broadcast ---
// Sends all player states to all room members at a fixed rate.
// Decoupled from per-client message rate to prevent flooding.
setInterval(() => {
  for (const [, room] of rooms) {
    const states = {};
    for (const [pid, peer] of room) {
      if (peer.state) states[pid] = peer.state;
    }
    if (Object.keys(states).length === 0) continue;

    const msg = JSON.stringify({ type: 'stateUpdate', states });
    for (const [, peer] of room) {
      if (peer.ws.readyState === 1) peer.ws.send(msg);
    }
  }
}, BROADCAST_RATE);

console.log(`WebSocket game server running on port ${PORT}`);
