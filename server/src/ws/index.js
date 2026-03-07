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

const { PartyManager } = require('./PartyManager.js');
const { connect: connectDb } = require('./db.js');
const {
  createGuestAccount, loginGuest,
  findOrCreateDiscordAccount, getPlayerBySession,
  linkGuestToDiscord, sanitizePlayer,
} = require('./AccountManager.js');

const rooms = new Map();
const partyManager = new PartyManager();
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

  // --- Account Endpoints ---

  if (url.pathname === '/auth/guest' && req.method === 'POST') {
    return handleGuestAuth(req, res);
  }

  if (url.pathname === '/auth/activity' && req.method === 'POST') {
    return handleActivityAuth(req, res);
  }

  if (url.pathname === '/auth/link' && req.method === 'POST') {
    return handleLinkAccount(req, res);
  }

  if (url.pathname === '/api/player' && req.method === 'GET') {
    return handleGetPlayer(req, res);
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

    const playerName = user.global_name || user.username;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : null;

    // Create or update MongoDB account
    const account = await findOrCreateDiscordAccount(user.id, playerName, avatarUrl);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      username: playerName,
      avatarUrl,
      discordId: user.id,
      sessionToken: account.sessionToken,
      playerId: account.playerId,
      isNew: account.isNew,
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

// --- Guest Account Auth ---

async function handleGuestAuth(req, res) {
  try {
    const body = await readBody(req);
    const { guestToken, playerName } = JSON.parse(body);

    // Returning guest — login with existing token
    if (guestToken) {
      const result = await loginGuest(guestToken);
      if (result) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      // Token not found — fall through to create new account
    }

    // New guest — create account
    const result = await createGuestAccount(playerName);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[auth/guest] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- Activity SDK Account Auth ---
// Called after Activity SDK authenticate() — exchanges access_token for a
// Discord user profile, then creates/updates the MongoDB account.

async function handleActivityAuth(req, res) {
  try {
    const body = await readBody(req);
    const { accessToken } = JSON.parse(body);

    if (!accessToken) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'accessToken is required' }));
      return;
    }

    // Fetch Discord user profile with the access token
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      console.error('[auth/activity] User fetch failed:', userRes.status);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch Discord user' }));
      return;
    }

    const user = await userRes.json();
    const playerName = user.global_name || user.username;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : null;

    const account = await findOrCreateDiscordAccount(user.id, playerName, avatarUrl);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      sessionToken: account.sessionToken,
      playerId: account.playerId,
      playerName,
      avatarUrl,
      discordId: user.id,
      isNew: account.isNew,
    }));
  } catch (err) {
    console.error('[auth/activity] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- Guest → Discord Linking ---

async function handleLinkAccount(req, res) {
  try {
    const body = await readBody(req);
    const { guestToken, code, redirectUri } = JSON.parse(body);

    if (!guestToken || !code) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'guestToken and code are required' }));
      return;
    }

    // Exchange OAuth code for Discord token
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
      console.error('[auth/link] Token exchange failed:', tokenRes.status);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token exchange failed' }));
      return;
    }

    const { access_token } = await tokenRes.json();

    // Fetch Discord profile
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userRes.ok) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch Discord user' }));
      return;
    }

    const user = await userRes.json();
    const playerName = user.global_name || user.username;
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
      : null;

    const result = await linkGuestToDiscord(guestToken, user.id, playerName, avatarUrl);

    if (result.error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[auth/link] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

// --- Player Data Endpoint ---
// Returns the authenticated player's account data (minus sensitive fields).

async function handleGetPlayer(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const player = await getPlayerBySession(token);
    if (!player) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or expired session' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sanitizePlayer(player)));
  } catch (err) {
    console.error('[api/player] Error:', err);
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
      title, description, priority, screenshot, consoleLogs,
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

    if (consoleLogs) {
      // Truncate to avoid hitting GitHub's body size limit (~65KB)
      const trimmed = consoleLogs.length > 50000 ? consoleLogs.slice(-50000) : consoleLogs;
      bodyParts.push(`\n### Console Log\n\n<details>\n<summary>Console output (click to expand)</summary>\n\n\`\`\`\n${trimmed}\n\`\`\`\n\n</details>`);
    }

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
  const playerData = {
    ws, colorIndex, state: null, playerName: `Player ${playerId}`, avatarUrl: null,
    mapId: null, partyId: null, instanceId: null,
  };
  room.set(playerId, playerData);

  console.log(`[connect] player=${playerId} room=${roomId} roomSize=${room.size}`);

  // Tell the new player their ID
  ws.send(JSON.stringify({ type: 'welcome', playerId, roomId, colorIndex }));

  // Send roster snapshot — full player list with names + maps
  const rosterPlayers = [];
  for (const [pid, peer] of room) {
    if (pid !== playerId) {
      rosterPlayers.push({
        playerId: pid, colorIndex: peer.colorIndex,
        playerName: peer.playerName, avatarUrl: peer.avatarUrl,
        mapId: peer.mapId,
      });
    }
  }
  ws.send(JSON.stringify({ type: 'roster', players: rosterPlayers }));

  // Tell existing players about the new player, and vice versa
  for (const [pid, peer] of room) {
    if (pid !== playerId) {
      peer.ws.send(JSON.stringify({
        type: 'playerJoined', playerId, colorIndex,
        playerName: playerData.playerName, avatarUrl: playerData.avatarUrl,
        mapId: playerData.mapId,
      }));
      ws.send(JSON.stringify({
        type: 'playerJoined', playerId: pid, colorIndex: peer.colorIndex,
        playerName: peer.playerName, avatarUrl: peer.avatarUrl,
        mapId: peer.mapId,
      }));
    }
  }

  // --- Message handling ---
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'identify') {
        // If client sends a sessionToken, look up the account
        if (msg.sessionToken) {
          const account = await getPlayerBySession(msg.sessionToken);
          if (account) {
            playerData.playerName = sanitizeName(account.playerName);
            playerData.avatarUrl = account.avatarUrl || null;
            playerData.accountId = account._id;
          } else {
            // Invalid/expired token — fall back to provided name
            playerData.playerName = sanitizeName(msg.playerName);
            playerData.avatarUrl = msg.avatarUrl || null;
          }
        } else {
          playerData.playerName = sanitizeName(msg.playerName);
          playerData.avatarUrl = msg.avatarUrl || null;
        }
        // Broadcast identity update to all room members
        for (const [, peer] of room) {
          peer.ws.send(JSON.stringify({
            type: 'playerIdentity', playerId,
            playerName: playerData.playerName, avatarUrl: playerData.avatarUrl,
          }));
        }
      } else if (msg.type === 'mapChange') {
        const oldMapId = playerData.mapId;
        playerData.mapId = msg.mapId || null;
        // Compute instanceId: instanced maps use partyId (or playerId for solo) + mapId
        if (msg.instanced && playerData.mapId) {
          const groupKey = playerData.partyId || playerId;
          playerData.instanceId = `${groupKey}:${playerData.mapId}`;
        } else {
          playerData.instanceId = null;
        }
        console.log(`[mapChange] player=${playerId} ${oldMapId} → ${playerData.mapId} instance=${playerData.instanceId || 'shared'}`);
        // Broadcast map change to all room members
        for (const [, peer] of room) {
          peer.ws.send(JSON.stringify({
            type: 'playerMapChanged', playerId,
            fromMap: oldMapId, toMap: playerData.mapId,
          }));
        }
      } else if (msg.type === 'partyInvite') {
        const targetId = msg.targetId;
        const target = room.get(targetId);
        if (!target) {
          ws.send(JSON.stringify({ type: 'partyError', error: 'Player not found' }));
        } else {
          const result = partyManager.invite(playerId, targetId);
          if (result.error) {
            ws.send(JSON.stringify({ type: 'partyError', error: result.error }));
          } else {
            target.ws.send(JSON.stringify({
              type: 'partyInviteReceived', fromId: playerId,
              fromName: playerData.playerName,
            }));
          }
        }
      } else if (msg.type === 'partyAccept') {
        const result = partyManager.accept(playerId);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'partyError', error: result.error }));
        } else {
          // Broadcast party update to all members
          for (const memberId of result.party.members) {
            const member = room.get(memberId);
            if (member) {
              member.ws.send(JSON.stringify({ type: 'partyUpdate', party: result.party }));
              // Update partyId on player data
              member.partyId = result.partyId;
            }
          }
        }
      } else if (msg.type === 'partyDecline') {
        const result = partyManager.decline(playerId);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'partyError', error: result.error }));
        } else {
          const from = room.get(result.fromId);
          if (from) {
            from.ws.send(JSON.stringify({
              type: 'partyError', error: `${playerData.playerName} declined the invite`,
            }));
          }
        }
      } else if (msg.type === 'partyLeave') {
        const result = partyManager.leave(playerId);
        if (result.error) {
          ws.send(JSON.stringify({ type: 'partyError', error: result.error }));
        } else if (result.disbanded) {
          for (const memberId of result.members) {
            const member = room.get(memberId);
            if (member) {
              member.ws.send(JSON.stringify({ type: 'partyDisbanded' }));
              member.partyId = null;
            }
          }
          playerData.partyId = null;
        } else {
          playerData.partyId = null;
          ws.send(JSON.stringify({ type: 'partyDisbanded' }));
          for (const memberId of result.party.members) {
            const member = room.get(memberId);
            if (member) member.ws.send(JSON.stringify({ type: 'partyUpdate', party: result.party }));
          }
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

    // Clean up party membership
    const partyResult = partyManager.removePlayer(playerId);
    if (partyResult && partyResult.disbanded) {
      for (const memberId of partyResult.members) {
        const member = room.get(memberId);
        if (member) {
          member.ws.send(JSON.stringify({ type: 'partyDisbanded' }));
          member.partyId = null;
        }
      }
    } else if (partyResult && partyResult.party) {
      for (const memberId of partyResult.party.members) {
        const member = room.get(memberId);
        if (member) member.ws.send(JSON.stringify({ type: 'partyUpdate', party: partyResult.party }));
      }
    }

    room.delete(playerId);
    for (const [, peer] of room) {
      peer.ws.send(JSON.stringify({ type: 'playerLeft', playerId }));
    }
    if (room.size === 0) rooms.delete(roomId);
  });
});

// --- State broadcast ---
// Sends player states grouped by broadcast key at a fixed rate.
// Broadcast key = instanceId (for instanced maps) or mapId (for shared maps).
// Players with mapId=null receive all states (backwards compat / pre-mapChange).
setInterval(() => {
  for (const [, room] of rooms) {
    // Group players by broadcast key (instanceId || mapId)
    const groups = new Map(); // key → { states, recipients[] }
    const unassigned = []; // players with no mapId yet
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

    // Send filtered updates per group
    for (const [, group] of groups) {
      if (Object.keys(group.states).length === 0) continue;
      const msg = JSON.stringify({ type: 'stateUpdate', states: group.states });
      for (const peer of group.recipients) {
        if (peer.ws.readyState === 1) peer.ws.send(msg);
      }
    }

    // Unassigned players get all states (backwards compat)
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
}, BROADCAST_RATE);

// --- Startup ---

async function start() {
  await connectDb();
  httpServer.listen(PORT, () => {
    console.log(`WebSocket + HTTP server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
