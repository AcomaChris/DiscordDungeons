// @doc-player 01:Controls > Login
// You can sign in with **Discord** for a persistent identity that carries
// across sessions, or choose **Guest mode** and pick a custom name with no
// account required. When playing inside Discord as an Activity, login is
// automatic. Your session is saved locally so you stay logged in between visits.

// --- AuthManager ---
// Handles Discord OAuth2 and guest identity.
// Stores player identity in localStorage so it persists across sessions.

const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';
// Always use current origin so OAuth redirects back to the same domain the player entered from
const REDIRECT_URI = typeof window !== 'undefined' ? window.location.origin + '/' : (import.meta.env.VITE_REDIRECT_URI || '/');

const STORAGE_KEY = 'dd_player_identity';

export class AuthManager {
  constructor() {
    this._identity = null;
  }

  // Detects ?code= URL param from Discord OAuth redirect, exchanges for profile
  async checkOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return false;

    // Clear any stale session (e.g. guest) so OAuth result takes over
    this.clear();

    // Clean the code from the URL so it doesn't persist
    window.history.replaceState({}, '', window.location.pathname);

    try {
      const res = await fetch(`${AUTH_API_URL}/auth/discord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri: REDIRECT_URI }),
      });

      if (!res.ok) throw new Error('Auth failed');
      const data = await res.json();

      this._identity = {
        type: 'discord',
        playerName: data.username,
        avatarUrl: data.avatarUrl,
        discordId: data.discordId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._identity));
      return true;
    } catch (err) {
      console.error('[AuthManager] OAuth exchange failed:', err);
      return false;
    }
  }

  // Loads identity from localStorage (persists across sessions)
  restore() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this._identity = JSON.parse(stored);
        return true;
      }
    } catch { /* ignore corrupt data */ }
    return false;
  }

  // Redirects to Discord OAuth2 authorize page
  startDiscordLogin() {
    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'identify',
    });
    window.location.href = `https://discord.com/oauth2/authorize?${params}`;
  }

  // Sets identity from Discord Activity SDK auth (no localStorage — Activity re-auths each launch)
  setDiscordActivityIdentity(user) {
    this._identity = {
      type: 'discord',
      playerName: user.global_name || user.username,
      avatarUrl: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
      discordId: user.id,
    };
  }

  setGuestIdentity(name) {
    this._identity = {
      type: 'guest',
      playerName: name || 'Guest',
      avatarUrl: null,
      discordId: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._identity));
  }

  get identity() {
    return this._identity;
  }

  get isAuthenticated() {
    return this._identity !== null;
  }

  clear() {
    this._identity = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Singleton
const authManager = new AuthManager();
export default authManager;
