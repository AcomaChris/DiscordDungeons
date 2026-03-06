const http = require('http');
const { WebSocketServer } = require('ws');

// --- WebSocket + HTTP Game Server ---
// Minimal relay: room management + state broadcast at 10Hz.
// HTTP endpoints for Discord OAuth2 token exchange.
// AGENT: This is a relay server, not an authoritative game server.
// It trusts client state. Anti-cheat is out of scope for the prototype.

const PORT = process.env.WS_PORT || 3001;
const BROADCAST_RATE = 100; // ms (10Hz)
// Supports comma-separated origins (e.g. "https://discorddungeons.com,https://raveroyale.com")
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
const GITHUB_TOKEN = process.env.GITHUB_API_TOKEN || '';
const GITHUB_REPO = 'AcomaChris/DiscordDungeons';
const GITHUB_API = 'https://api.github.com';
const BE_API_URL = process.env.BEHAVIOR_ENGINE_API_URL || 'https://api.artificial.agency';
const BE_API_KEY = process.env.BEHAVIOR_ENGINE_API_KEY || '';
const BE_API_VERSION = '2025-05-15';

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
  // Reflect the request origin if it's in the allowlist (or allow all with '*')
  const reqOrigin = req.headers.origin || '';
  const allowOrigin = CORS_ORIGINS.includes('*') ? '*'
    : CORS_ORIGINS.includes(reqOrigin) ? reqOrigin : CORS_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
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

  // Activity SDK token exchange — simpler than /auth/discord (returns raw token)
  if (url.pathname === '/token' && req.method === 'POST') {
    return handleActivityToken(req, res);
  }

  if (url.pathname === '/api/issue' && req.method === 'POST') {
    return handleFileIssue(req, res);
  }

  if (url.pathname === '/api/tile-metadata' && req.method === 'POST') {
    return handleSaveTileMetadata(req, res);
  }

  if (url.pathname === '/api/object-defs' && req.method === 'POST') {
    return handleSaveObjectDefs(req, res);
  }

  // Behavior Engine proxy — forwards /api/be/* to api.artificial.agency/*
  if (url.pathname.startsWith('/api/be/') && (req.method === 'POST' || req.method === 'GET')) {
    return handleBehaviorEngineProxy(req, res, url);
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
      const errBody = await tokenRes.text();
      console.error('[auth] Token exchange failed:', tokenRes.status, 'redirectUri:', redirectUri, 'body:', errBody);
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

// --- Activity SDK Token Exchange ---
// AGENT: Activity SDK uses authorize() → code, then exchanges code for token.
// Unlike /auth/discord, this returns the raw access_token (client calls authenticate() with it).

async function handleActivityToken(req, res) {
  try {
    const body = await readBody(req);
    const { code } = JSON.parse(body);

    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[activity-auth] Token exchange failed:', tokenRes.status);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token exchange failed' }));
      return;
    }

    const { access_token } = await tokenRes.json();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ access_token }));
  } catch (err) {
    console.error('[activity-auth] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- GitHub Issue Filing ---
// AGENT: Requires GITHUB_API_TOKEN with repo Issues + Contents permissions.
// Screenshots are uploaded to the repo via the Contents API, then
// referenced by raw URL in the issue body.

const PRIORITY_LABELS = { low: 'priority: low', medium: 'priority: medium', high: 'priority: high' };

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

async function uploadScreenshot(base64Data, slug) {
  // Strip data URL prefix if present
  const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const filename = `${Date.now()}-${slug}.png`;
  const path = `bugimages/reports/${filename}`;

  const res = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      message: `bug-report: screenshot for ${slug}`,
      content: raw,
      branch: 'main',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[issue] Screenshot upload failed:', res.status, err);
    return null;
  }

  return `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${path}`;
}

async function handleFileIssue(req, res) {
  if (!GITHUB_TOKEN) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GitHub API token not configured' }));
    return;
  }

  try {
    const body = await readBody(req);
    const {
      title, description, priority, screenshot,
      commit, version, buildTime,
      reporter, discordId, platform, device, resolution,
    } = JSON.parse(body);

    if (!title || !title.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Title is required' }));
      return;
    }

    const slug = slugify(title);

    // Upload screenshot if provided
    let screenshotUrl = null;
    if (screenshot) {
      screenshotUrl = await uploadScreenshot(screenshot, slug);
    }

    // Build issue body
    const bodyParts = [];
    if (description) bodyParts.push(description);
    if (screenshotUrl) bodyParts.push(`\n### Screenshot\n\n![Screenshot](${screenshotUrl})`);

    bodyParts.push('\n### Metadata');
    if (reporter) bodyParts.push(`- **Reported by**: ${reporter}${discordId ? ` (${discordId})` : ''}`);
    bodyParts.push(`- **Priority**: ${priority || 'medium'}`);
    if (platform) bodyParts.push(`- **Platform**: ${platform}`);
    if (device) bodyParts.push(`- **Device**: ${device}`);
    if (resolution) bodyParts.push(`- **Resolution**: ${resolution}`);
    if (version) bodyParts.push(`- **Version**: ${version}`);
    if (commit) bodyParts.push(`- **Commit**: \`${commit}\``);
    if (buildTime) bodyParts.push(`- **Build time**: ${buildTime}`);
    bodyParts.push(`- **Filed via**: in-game bug reporter`);

    const labels = ['bug', 'in-game-report'];
    if (priority && PRIORITY_LABELS[priority]) labels.push(PRIORITY_LABELS[priority]);

    const issueRes = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        title: title.trim(),
        body: bodyParts.join('\n'),
        labels,
      }),
    });

    if (!issueRes.ok) {
      const err = await issueRes.text();
      console.error('[issue] GitHub issue creation failed:', issueRes.status, err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to create GitHub issue' }));
      return;
    }

    const issue = await issueRes.json();
    console.log(`[issue] Created #${issue.number}: ${title}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    }));
  } catch (err) {
    console.error('[issue] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- Tile Metadata Save ---
// AGENT: Allowlist prevents writing to arbitrary repo paths.

const ALLOWED_TILESETS = [
  'Interior_1st_floor', 'Exterior', 'Walls_interior',
  'Walls_street', 'Interior_2nd_floor',
];

async function handleSaveTileMetadata(req, res) {
  if (!GITHUB_TOKEN) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GitHub API token not configured' }));
    return;
  }

  try {
    const body = await readBody(req);
    const { tileset, content } = JSON.parse(body);

    if (!tileset || !ALLOWED_TILESETS.includes(tileset)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Invalid tileset: ${tileset}` }));
      return;
    }

    if (!content) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Content is required' }));
      return;
    }

    const path = `client/public/tile-metadata/${tileset}.json`;
    const apiUrl = `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`;

    // Get current file SHA (required for updates)
    let sha = null;
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    // Commit the file
    const putBody = {
      message: `tile-metadata: update ${tileset}`,
      content: Buffer.from(content).toString('base64'),
      branch: 'main',
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error('[tile-metadata] GitHub commit failed:', putRes.status, err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to commit to GitHub' }));
      return;
    }

    const result = await putRes.json();
    console.log(`[tile-metadata] Saved ${tileset}.json (${result.content.sha.slice(0, 7)})`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sha: result.content.sha }));
  } catch (err) {
    console.error('[tile-metadata] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- Object Definitions Save ---

async function handleSaveObjectDefs(req, res) {
  if (!GITHUB_TOKEN) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'GitHub API token not configured' }));
    return;
  }

  try {
    const body = await readBody(req);
    const { tileset, content } = JSON.parse(body);

    if (!tileset || !ALLOWED_TILESETS.includes(tileset)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Invalid tileset: ${tileset}` }));
      return;
    }

    if (!content) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Content is required' }));
      return;
    }

    const path = `client/public/object-defs/${tileset}.objects.json`;
    const apiUrl = `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`;

    // Get current file SHA (required for updates)
    let sha = null;
    const getRes = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    // Commit the file
    const putBody = {
      message: `object-defs: update ${tileset}`,
      content: Buffer.from(content).toString('base64'),
      branch: 'main',
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify(putBody),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error('[object-defs] GitHub commit failed:', putRes.status, err);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to commit to GitHub' }));
      return;
    }

    const result = await putRes.json();
    console.log(`[object-defs] Saved ${tileset}.objects.json (${result.content.sha.slice(0, 7)})`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, sha: result.content.sha }));
  } catch (err) {
    console.error('[object-defs] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- Behavior Engine Proxy ---
// Forwards requests to the Artificial Agency API, adding auth headers
// server-side so the API key stays off the client.

async function handleBehaviorEngineProxy(req, res, url) {
  if (!BE_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Behavior Engine API key not configured' }));
    return;
  }

  try {
    const body = req.method === 'POST' ? await readBody(req) : undefined;
    // Strip /api/be prefix → forward remainder to BE API
    const bePath = url.pathname.replace(/^\/api\/be/, '');

    const beRes = await fetch(`${BE_API_URL}${bePath}`, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${BE_API_KEY}`,
        'AA-API-Version': BE_API_VERSION,
        'Content-Type': 'application/json',
      },
      body,
    });

    const data = await beRes.text();
    res.writeHead(beRes.status, { 'Content-Type': 'application/json' });
    res.end(data);
  } catch (err) {
    console.error('[be-proxy] Error:', err);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Behavior Engine proxy error' }));
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
