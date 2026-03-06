// --- PartyManager ---
// Manages party formation, invites, and membership.
// Parties are ephemeral (in-memory only, lost on server restart).

const INVITE_TIMEOUT_MS = 30000; // 30 seconds to accept

class PartyManager {
  constructor() {
    // partyId → { leaderId, members: Set<playerId> }
    this._parties = new Map();
    // playerId → partyId
    this._playerParty = new Map();
    // targetId → { fromId, partyId, timer }
    this._pendingInvites = new Map();
    this._nextPartyId = 1;
  }

  // --- Party Creation ---

  createParty(leaderId) {
    if (this._playerParty.has(leaderId)) {
      return { error: 'Already in a party' };
    }
    const partyId = `party-${this._nextPartyId++}`;
    this._parties.set(partyId, { leaderId, members: new Set([leaderId]) });
    this._playerParty.set(leaderId, partyId);
    return { partyId };
  }

  // --- Invites ---

  invite(fromId, targetId) {
    if (fromId === targetId) return { error: 'Cannot invite yourself' };
    if (this._playerParty.has(targetId)) return { error: 'Target is already in a party' };
    if (this._pendingInvites.has(targetId)) return { error: 'Target already has a pending invite' };

    // Create party for inviter if they don't have one
    let partyId = this._playerParty.get(fromId);
    if (!partyId) {
      const result = this.createParty(fromId);
      if (result.error) return result;
      partyId = result.partyId;
    }

    const party = this._parties.get(partyId);
    if (party.leaderId !== fromId) return { error: 'Only the party leader can invite' };

    const timer = setTimeout(() => {
      this._pendingInvites.delete(targetId);
    }, INVITE_TIMEOUT_MS);

    this._pendingInvites.set(targetId, { fromId, partyId, timer });
    return { partyId };
  }

  accept(targetId) {
    const invite = this._pendingInvites.get(targetId);
    if (!invite) return { error: 'No pending invite' };

    clearTimeout(invite.timer);
    this._pendingInvites.delete(targetId);

    const party = this._parties.get(invite.partyId);
    if (!party) return { error: 'Party no longer exists' };

    party.members.add(targetId);
    this._playerParty.set(targetId, invite.partyId);
    return { partyId: invite.partyId, party: this.getPartyState(invite.partyId) };
  }

  decline(targetId) {
    const invite = this._pendingInvites.get(targetId);
    if (!invite) return { error: 'No pending invite' };

    clearTimeout(invite.timer);
    this._pendingInvites.delete(targetId);
    return { fromId: invite.fromId };
  }

  // --- Leave / Disconnect ---

  leave(playerId) {
    const partyId = this._playerParty.get(playerId);
    if (!partyId) return { error: 'Not in a party' };

    const party = this._parties.get(partyId);
    if (!party) {
      this._playerParty.delete(playerId);
      return { error: 'Party not found' };
    }

    party.members.delete(playerId);
    this._playerParty.delete(playerId);

    // Disband if only 1 member left
    if (party.members.size <= 1) {
      return this._disbandParty(partyId);
    }

    // Promote new leader if the leader left
    if (party.leaderId === playerId) {
      party.leaderId = party.members.values().next().value;
    }

    return { partyId, party: this.getPartyState(partyId), disbanded: false };
  }

  // Called when a player disconnects — clean up invites and party membership
  removePlayer(playerId) {
    // Clear any pending invite for this player
    const invite = this._pendingInvites.get(playerId);
    if (invite) {
      clearTimeout(invite.timer);
      this._pendingInvites.delete(playerId);
    }

    // Clear invites sent by this player
    for (const [targetId, inv] of this._pendingInvites) {
      if (inv.fromId === playerId) {
        clearTimeout(inv.timer);
        this._pendingInvites.delete(targetId);
      }
    }

    // Leave party
    if (this._playerParty.has(playerId)) {
      return this.leave(playerId);
    }
    return null;
  }

  // --- Query ---

  getPartyId(playerId) {
    return this._playerParty.get(playerId) || null;
  }

  getPartyState(partyId) {
    const party = this._parties.get(partyId);
    if (!party) return null;
    return {
      partyId,
      leaderId: party.leaderId,
      members: [...party.members],
    };
  }

  getPartyMembers(partyId) {
    const party = this._parties.get(partyId);
    return party ? [...party.members] : [];
  }

  // --- Internal ---

  _disbandParty(partyId) {
    const party = this._parties.get(partyId);
    if (!party) return { disbanded: true, partyId, members: [] };

    const members = [...party.members];
    for (const pid of members) {
      this._playerParty.delete(pid);
    }
    this._parties.delete(partyId);
    return { disbanded: true, partyId, members };
  }
}

module.exports = { PartyManager };
