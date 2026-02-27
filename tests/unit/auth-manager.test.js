// @vitest-environment jsdom
/* global sessionStorage */
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthManager } from '../../client/src/auth/AuthManager.js';

describe('AuthManager', () => {
  let auth;

  beforeEach(() => {
    auth = new AuthManager();
    sessionStorage.clear();
  });

  it('starts unauthenticated', () => {
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.identity).toBeNull();
  });

  it('sets guest identity', () => {
    auth.setGuestIdentity('TestGuest');
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.identity.playerName).toBe('TestGuest');
    expect(auth.identity.type).toBe('guest');
    expect(auth.identity.avatarUrl).toBeNull();
  });

  it('defaults guest name to Guest when empty', () => {
    auth.setGuestIdentity('');
    expect(auth.identity.playerName).toBe('Guest');
  });

  it('restores identity from sessionStorage', () => {
    auth.setGuestIdentity('Stored');
    const auth2 = new AuthManager();
    expect(auth2.restore()).toBe(true);
    expect(auth2.identity.playerName).toBe('Stored');
  });

  it('restore returns false when nothing stored', () => {
    expect(auth.restore()).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
  });

  it('clear removes identity', () => {
    auth.setGuestIdentity('Gone');
    auth.clear();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.identity).toBeNull();
    expect(sessionStorage.getItem('dd_player_identity')).toBeNull();
  });
});
