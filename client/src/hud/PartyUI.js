// --- PartyUI ---
// Shows party members, handles invite toasts with accept/decline buttons.
// DOM-based overlay, subscribes to party events via EventBus.

import '../styles/hud.css';
import eventBus from '../core/EventBus.js';
import {
  NETWORK_PARTY_INVITE,
  NETWORK_PARTY_UPDATE,
  NETWORK_PARTY_DISBANDED,
  NETWORK_PARTY_ERROR,
} from '../core/Events.js';

export class PartyUI {
  constructor(networkManager) {
    this._networkManager = networkManager;
    this._party = null;      // { partyId, leaderId, members[] }
    this._membersEl = null;
    this._toastEl = null;
    this._toastTimer = null;
  }

  init() {
    this._subscribe();
  }

  // --- Party Members Panel ---

  _showMembers() {
    this._hideMembers();
    if (!this._party || this._party.members.length <= 1) return;

    this._membersEl = document.createElement('div');
    this._membersEl.className = 'dd-party-members';
    this._renderMembers();
    document.body.appendChild(this._membersEl);
  }

  _hideMembers() {
    if (this._membersEl) {
      this._membersEl.remove();
      this._membersEl = null;
    }
  }

  _renderMembers() {
    if (!this._membersEl || !this._party) return;
    let html = '<h4>Party</h4>';
    for (const memberId of this._party.members) {
      const isLeader = memberId === this._party.leaderId;
      const isSelf = memberId === this._networkManager?.playerId;
      const cls = isLeader ? 'dd-party-member leader' : 'dd-party-member';
      const name = isSelf ? 'You' : `Player ${memberId}`;
      html += `<div class="${cls}">${name}</div>`;
    }
    this._membersEl.innerHTML = html;
  }

  // --- Invite Toast ---

  _showInviteToast(fromName) {
    this._hideInviteToast();
    this._toastEl = document.createElement('div');
    this._toastEl.className = 'dd-party-toast';
    this._toastEl.innerHTML = `
      <span>${fromName} invites you to a party</span>
      <button class="accept">Accept</button>
      <button class="decline">Decline</button>
    `;

    this._toastEl.querySelector('.accept').addEventListener('click', () => {
      if (this._networkManager) this._networkManager.sendPartyAccept();
      this._hideInviteToast();
    });

    this._toastEl.querySelector('.decline').addEventListener('click', () => {
      if (this._networkManager) this._networkManager.sendPartyDecline();
      this._hideInviteToast();
    });

    document.body.appendChild(this._toastEl);

    // Auto-dismiss after 30s
    this._toastTimer = setTimeout(() => this._hideInviteToast(), 30000);
  }

  _hideInviteToast() {
    if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null; }
    if (this._toastEl) { this._toastEl.remove(); this._toastEl = null; }
  }

  // --- Event Subscriptions ---

  _subscribe() {
    this._onInvite = ({ fromName }) => {
      this._showInviteToast(fromName || 'Someone');
    };

    this._onUpdate = (party) => {
      this._party = party;
      this._showMembers();
    };

    this._onDisbanded = () => {
      this._party = null;
      this._hideMembers();
    };

    this._onError = ({ error }) => {
      console.warn('[PartyUI]', error);
    };

    eventBus.on(NETWORK_PARTY_INVITE, this._onInvite);
    eventBus.on(NETWORK_PARTY_UPDATE, this._onUpdate);
    eventBus.on(NETWORK_PARTY_DISBANDED, this._onDisbanded);
    eventBus.on(NETWORK_PARTY_ERROR, this._onError);
  }

  destroy() {
    this._hideMembers();
    this._hideInviteToast();
    eventBus.off(NETWORK_PARTY_INVITE, this._onInvite);
    eventBus.off(NETWORK_PARTY_UPDATE, this._onUpdate);
    eventBus.off(NETWORK_PARTY_DISBANDED, this._onDisbanded);
    eventBus.off(NETWORK_PARTY_ERROR, this._onError);
  }
}
