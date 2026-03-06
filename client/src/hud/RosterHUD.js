// --- RosterHUD ---
// Minimal badge showing player count, click to expand into grouped player list.
// DOM-based overlay, subscribes to network events via EventBus.

import '../styles/hud.css';
import eventBus from '../core/EventBus.js';
import {
  NETWORK_PLAYER_JOINED,
  NETWORK_PLAYER_LEFT,
  NETWORK_PLAYER_MAP_CHANGED,
  NETWORK_ROSTER,
  NETWORK_PLAYER_IDENTITY,
} from '../core/Events.js';

export class RosterHUD {
  constructor() {
    this._players = new Map(); // playerId → { playerName, mapId, colorIndex }
    this._localPlayerId = null;
    this._localMapId = null;
    this._badge = null;
    this._panel = null;
    this._expanded = false;
  }

  init(localPlayerId, localMapId) {
    this._localPlayerId = localPlayerId;
    this._localMapId = localMapId;
    this._createBadge();
    this._subscribe();
  }

  _createBadge() {
    this._badge = document.createElement('div');
    this._badge.className = 'dd-roster-badge';
    this._badge.textContent = 'Players: 1';
    this._badge.addEventListener('click', () => this._toggle());
    document.body.appendChild(this._badge);
  }

  _toggle() {
    this._expanded = !this._expanded;
    if (this._expanded) {
      this._showPanel();
    } else {
      this._hidePanel();
    }
  }

  _showPanel() {
    if (this._panel) this._panel.remove();
    this._panel = document.createElement('div');
    this._panel.className = 'dd-roster-panel';
    this._renderPanel();
    document.body.appendChild(this._panel);
  }

  _hidePanel() {
    if (this._panel) {
      this._panel.remove();
      this._panel = null;
    }
  }

  _renderPanel() {
    if (!this._panel) return;

    // Group by map
    const groups = new Map();
    // Add self
    const selfMap = this._localMapId || 'unknown';
    if (!groups.has(selfMap)) groups.set(selfMap, []);
    groups.get(selfMap).push({ playerId: this._localPlayerId, playerName: 'You', isSelf: true });

    for (const [pid, data] of this._players) {
      const map = data.mapId || 'unknown';
      if (!groups.has(map)) groups.set(map, []);
      groups.get(map).push({ playerId: pid, playerName: data.playerName, isSelf: false });
    }

    let html = '<h4>Players</h4>';
    for (const [mapId, players] of groups) {
      html += `<div class="dd-roster-group">`;
      html += `<div class="dd-roster-map">${mapId}</div>`;
      for (const p of players) {
        const cls = p.isSelf ? 'dd-roster-player self' : 'dd-roster-player';
        html += `<div class="${cls}">${p.playerName}</div>`;
      }
      html += `</div>`;
    }
    this._panel.innerHTML = html;
  }

  _updateBadge() {
    if (!this._badge) return;
    const count = this._players.size + 1; // +1 for self
    this._badge.textContent = `Players: ${count}`;
    if (this._expanded) this._renderPanel();
  }

  setLocalMapId(mapId) {
    this._localMapId = mapId;
    this._updateBadge();
  }

  // --- Event Subscriptions ---

  _subscribe() {
    this._onRoster = ({ players }) => {
      for (const p of players) {
        this._players.set(p.playerId, {
          playerName: p.playerName || `Player ${p.playerId}`,
          mapId: p.mapId,
          colorIndex: p.colorIndex,
        });
      }
      this._updateBadge();
    };

    this._onJoined = ({ playerId, playerName, mapId, colorIndex }) => {
      this._players.set(playerId, {
        playerName: playerName || `Player ${playerId}`,
        mapId: mapId || null,
        colorIndex: colorIndex || 0,
      });
      this._updateBadge();
    };

    this._onLeft = ({ playerId }) => {
      this._players.delete(playerId);
      this._updateBadge();
    };

    this._onMapChanged = ({ playerId, toMap }) => {
      const p = this._players.get(playerId);
      if (p) {
        p.mapId = toMap;
        this._updateBadge();
      }
    };

    this._onIdentity = ({ playerId, playerName }) => {
      const p = this._players.get(playerId);
      if (p) {
        p.playerName = playerName;
        this._updateBadge();
      }
    };

    eventBus.on(NETWORK_ROSTER, this._onRoster);
    eventBus.on(NETWORK_PLAYER_JOINED, this._onJoined);
    eventBus.on(NETWORK_PLAYER_LEFT, this._onLeft);
    eventBus.on(NETWORK_PLAYER_MAP_CHANGED, this._onMapChanged);
    eventBus.on(NETWORK_PLAYER_IDENTITY, this._onIdentity);
  }

  destroy() {
    if (this._badge) { this._badge.remove(); this._badge = null; }
    if (this._panel) { this._panel.remove(); this._panel = null; }
    eventBus.off(NETWORK_ROSTER, this._onRoster);
    eventBus.off(NETWORK_PLAYER_JOINED, this._onJoined);
    eventBus.off(NETWORK_PLAYER_LEFT, this._onLeft);
    eventBus.off(NETWORK_PLAYER_MAP_CHANGED, this._onMapChanged);
    eventBus.off(NETWORK_PLAYER_IDENTITY, this._onIdentity);
  }
}
