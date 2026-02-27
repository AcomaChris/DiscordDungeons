const http = require('http');
const { WebSocketServer } = require('ws');

// --- WebSocket + HTTP Game Server ---
// Minimal relay: room management + state broadcast at 10Hz.
// HTTP endpoints for Discord OAuth2 token exchange.
// AGENT: This is a relay server, not an authoritative game server.
// It trusts client state. Anti-cheat is out of scope for the prototype.

const PORT = process.env.WS_PORT || 3001;
const BROADCAST_RATE = 100; // ms (10Hz)
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const rooms = new Map();
let nextPlayerId = 1;

// --- Helpers ---

function sanitizeName(name) {
  return String(name).replace(/[^\x20-\x7E]/g, '').trim().slice(0, 20) || 'Player';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// --- HTTP Request Handler ---

async function handleHttpRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/auth/discord' && req.method === 'POST') {
    return handleDiscordAuth(req, res);
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

// --- Discord OAuth2 Token Exchange ---

async function handleDiscordAuth(req, res) {
  try {
    const body = await readBody(req);
    const { code, redirectUri } = JSON.parse(body);

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[auth] Token exchange failed:', tokenRes.status);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token exchange failed' }));
      return;
    }

    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      console.error('[auth] User fetch failed:', userRes.status);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch user profile' }));
      return;
    }

    const user = await userRes.json();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      username: user.global_name || user.username,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
        : null,
      discordId: user.id,
    }));
  } catch (err) {
    console.error('[auth] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- HTTP + WebSocket Server ---

const httpServer = http.createServer(handleHttpRequest);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const roomId = url.searchParams.get('room') || 'default';
  const playerId = String(nextPlayerId++);

  // --- Room join ---
  if (!rooms.has(roomId)) rooms.set(roomId, new Map());
  const room = rooms.get(roomId);

  const colorIndex = room.size;
  const playerData = { ws, colorIndex, state: null, playerName: `Player ${playerId}`, avatarUrl: null };
  room.set(playerId, playerData);

  console.log(`[connect] player=${playerId} room=${roomId} roomSize=${room.size}`);

  // Tell the new player their ID
  ws.send(JSON.stringify({ type: 'welcome', playerId, roomId, colorIndex }));

  // Tell existing players about the new player, and vice versa
  for (const [pid, peer] of room) {
    if (pid !== playerId) {
      peer.ws.send(JSON.stringify({
        type: 'playerJoined', playerId, colorIndex,
        playerName: playerData.playerName, avatarUrl: playerData.avatarUrl,
      }));
      ws.send(JSON.stringify({
        type: 'playerJoined', playerId: pid, colorIndex: peer.colorIndex,
        playerName: peer.playerName, avatarUrl: peer.avatarUrl,
      }));
    }
  }

  // --- Message handling ---
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'identify') {
        playerData.playerName = sanitizeName(msg.playerName);
        playerData.avatarUrl = msg.avatarUrl || null;
        // Broadcast identity update to all room members
        for (const [, peer] of room) {
          peer.ws.send(JSON.stringify({
            type: 'playerIdentity', playerId,
            playerName: playerData.playerName, avatarUrl: playerData.avatarUrl,
          }));
        }
      } else if (msg.type === 'state') {
        const peer = room.get(playerId);
        if (peer) peer.state = msg.payload;
      }
    } catch {
      // Ignore malformed messages
    }
  });

  // --- Disconnect ---
  ws.on('close', () => {
    console.log(`[disconnect] player=${playerId} room=${roomId}`);
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

httpServer.listen(PORT, () => {
  console.log(`WebSocket + HTTP server running on port ${PORT}`);
});
