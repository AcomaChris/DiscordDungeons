import { DiscordSDK, patchUrlMappings } from '@discord/embedded-app-sdk';

// --- Activity SDK ---
// Initializes the Discord Embedded App SDK when running as a Discord Activity.
// Handles auth (authorize → token exchange → authenticate) and exposes the
// channel ID for per-room multiplayer.

const CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

// AGENT: Discord adds frame_id, instance_id, and platform params to the Activity iframe URL.
// Their presence is the most reliable way to detect Activity mode.
export const isDiscordActivity = (() => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('frame_id') && params.has('instance_id') && params.has('platform');
})();

let discordSdk = null;

export async function setupDiscordActivity() {
  if (!isDiscordActivity) return null;

  // Patch fetch/WebSocket/XHR to route through Discord's CSP proxy
  patchUrlMappings([{ prefix: '/api', target: 'ws.discorddungeons.com' }]);

  discordSdk = new DiscordSDK(CLIENT_ID);
  await discordSdk.ready();

  // Authorize — Discord shows a permission popup to the user
  const { code } = await discordSdk.commands.authorize({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: ['identify'],
  });

  // Exchange code for access token via our server
  const tokenRes = await fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const { access_token } = await tokenRes.json();

  // Authenticate with Discord using the token
  const auth = await discordSdk.commands.authenticate({ access_token });

  // Create/update MongoDB account and get a session token
  let sessionToken = null;
  try {
    const accountRes = await fetch('/api/auth/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: access_token }),
    });
    if (accountRes.ok) {
      const accountData = await accountRes.json();
      sessionToken = accountData.sessionToken;
    }
  } catch (err) {
    console.warn('[ActivitySDK] Account creation failed, continuing without session:', err);
  }

  return {
    user: auth.user,
    channelId: discordSdk.channelId,
    sessionToken,
  };
}

export function getDiscordSdk() {
  return discordSdk;
}
