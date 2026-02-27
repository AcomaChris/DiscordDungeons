// --- AuthManager ---
// Handles Discord OAuth2 and guest identity.
// Stores player identity in sessionStorage so it survives the OAuth redirect page reload.

const AUTH_API_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001';
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin + '/' : '/');

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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._identity));
      return true;
    } catch (err) {
      console.error('[AuthManager] OAuth exchange failed:', err);
      return false;
    }
  }

  // Loads identity from sessionStorage (survives page reloads)
  restore() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
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

  setGuestIdentity(name) {
    this._identity = {
      type: 'guest',
      playerName: name || 'Guest',
      avatarUrl: null,
      discordId: null,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this._identity));
  }

  get identity() {
    return this._identity;
  }

  get isAuthenticated() {
    return this._identity !== null;
  }

  clear() {
    this._identity = null;
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

// Singleton
const authManager = new AuthManager();
export default authManager;
