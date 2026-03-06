import { describe, it, expect, beforeEach, vi } from 'vitest';

// PartyManager is CommonJS — use dynamic import
const { PartyManager } = await import('../../server/src/ws/PartyManager.js');

describe('PartyManager', () => {
  let pm;

  beforeEach(() => {
    vi.useFakeTimers();
    pm = new PartyManager();
  });

  // --- Party Creation ---

  it('creates a party with the creator as leader', () => {
    const result = pm.createParty('p1');
    expect(result.partyId).toBeTruthy();
    const state = pm.getPartyState(result.partyId);
    expect(state.leaderId).toBe('p1');
    expect(state.members).toEqual(['p1']);
  });

  it('rejects creating a party if already in one', () => {
    pm.createParty('p1');
    const result = pm.createParty('p1');
    expect(result.error).toBe('Already in a party');
  });

  // --- Invites ---

  it('invites a player and auto-creates party for inviter', () => {
    const result = pm.invite('p1', 'p2');
    expect(result.partyId).toBeTruthy();
    expect(pm.getPartyId('p1')).toBe(result.partyId);
  });

  it('rejects self-invite', () => {
    expect(pm.invite('p1', 'p1').error).toBe('Cannot invite yourself');
  });

  it('rejects invite if target already in a party', () => {
    pm.createParty('p2');
    expect(pm.invite('p1', 'p2').error).toBe('Target is already in a party');
  });

  it('rejects invite if target has pending invite', () => {
    pm.invite('p1', 'p2');
    expect(pm.invite('p1', 'p2').error).toBe('Target already has a pending invite');
  });

  it('rejects invite from non-leader', () => {
    pm.invite('p1', 'p2');
    pm.accept('p2');
    expect(pm.invite('p2', 'p3').error).toBe('Only the party leader can invite');
  });

  // --- Accept ---

  it('adds player to party on accept', () => {
    pm.invite('p1', 'p2');
    const result = pm.accept('p2');
    expect(result.party.members).toContain('p2');
    expect(pm.getPartyId('p2')).toBe(result.partyId);
  });

  it('rejects accept with no pending invite', () => {
    expect(pm.accept('p2').error).toBe('No pending invite');
  });

  // --- Decline ---

  it('clears invite on decline', () => {
    pm.invite('p1', 'p2');
    const result = pm.decline('p2');
    expect(result.fromId).toBe('p1');
    expect(pm.accept('p2').error).toBe('No pending invite');
  });

  // --- Leave ---

  it('removes player from party on leave', () => {
    pm.invite('p1', 'p2');
    pm.accept('p2');
    pm.invite('p1', 'p3');
    pm.accept('p3');

    const result = pm.leave('p2');
    expect(result.party.members).not.toContain('p2');
    expect(pm.getPartyId('p2')).toBeNull();
  });

  it('disbands party when only 1 member remains after leave', () => {
    pm.invite('p1', 'p2');
    pm.accept('p2');
    const result = pm.leave('p1');
    expect(result.disbanded).toBe(true);
    expect(pm.getPartyId('p2')).toBeNull();
  });

  it('promotes new leader when leader leaves', () => {
    pm.invite('p1', 'p2');
    pm.accept('p2');
    pm.invite('p1', 'p3');
    pm.accept('p3');

    pm.leave('p1');
    const partyId = pm.getPartyId('p2');
    const state = pm.getPartyState(partyId);
    expect(state.leaderId).not.toBe('p1');
    expect(state.members).toContain('p2');
  });

  // --- Disconnect (removePlayer) ---

  it('cleans up on disconnect', () => {
    pm.invite('p1', 'p2');
    pm.accept('p2');
    const result = pm.removePlayer('p1');
    expect(result.disbanded).toBe(true);
  });

  it('clears pending invites on disconnect', () => {
    pm.invite('p1', 'p2');
    pm.removePlayer('p2');
    // Invite for p2 should be gone
    expect(pm.accept('p2').error).toBe('No pending invite');
  });

  it('clears invites sent by disconnecting player', () => {
    pm.invite('p1', 'p2');
    pm.removePlayer('p1');
    // p2's invite should be gone
    expect(pm.accept('p2').error).toBe('No pending invite');
  });

  // --- Invite timeout ---

  it('expires invite after timeout', () => {
    pm.invite('p1', 'p2');
    vi.advanceTimersByTime(31000);
    expect(pm.accept('p2').error).toBe('No pending invite');
  });

  // --- Query ---

  it('returns null for non-existent party', () => {
    expect(pm.getPartyState('nonexistent')).toBeNull();
    expect(pm.getPartyId('nonexistent')).toBeNull();
  });

  it('returns empty members for non-existent party', () => {
    expect(pm.getPartyMembers('nonexistent')).toEqual([]);
  });
});
