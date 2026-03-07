import eventBus from '../core/EventBus.js';
import {
  PLAYER_MOVED,
  NETWORK_CONNECTED,
  NETWORK_DISCONNECTED,
  NETWORK_PLAYER_JOINED,
  NETWORK_PLAYER_LEFT,
  NETWORK_STATE_UPDATE,
  NETWORK_ROOM_JOINED,
  NETWORK_PLAYER_IDENTITY,
  NETWORK_PLAYER_MAP_CHANGED,
  NETWORK_ROSTER,
  NETWORK_PARTY_INVITE,
  NETWORK_PARTY_UPDATE,
  NETWORK_PARTY_DISBANDED,
  NETWORK_PARTY_ERROR,
} from '../core/Events.js';
import { NETWORK_SEND_RATE } from '../core/Constants.js';

// @doc-player 03:Multiplayer > Connecting
// The game **automatically connects** to the multiplayer server when you join.
// All players in the same room can see each other move in real time.
// Each player is assigned a **unique color** so you can tell everyone apart.
// Player positions sync at **10 updates per second** for smooth movement.

// --- NetworkManager ---
// WebSocket client for multiplayer state sync.
// Sends local player state at a fixed rate, receives and distributes remote state via EventBus.

export class NetworkManager {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.ws = null;
    this.playerId = null;
    this._sendInterval = null;
    this._latestLocalState = null;
    this._currentMapId = null;
  }

  connect(roomId, identity) {
    const url = `${this.serverUrl}?room=${encodeURIComponent(roomId)}`;

    // AGENT: WebSocket constructor throws synchronously on mixed content (ws:// from HTTPS page).
    // Must catch so the game continues in offline/single-player mode.
    try {
      this.ws = new WebSocket(url);
    } catch {
      console.warn('[NetworkManager] WebSocket connection failed — running offline');
      return;
    }

    this.ws.onopen = () => {
      eventBus.emit(NETWORK_CONNECTED);

      // Send player identity so other players see our name
      if (identity && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'identify',
          playerName: identity.playerName,
          avatarUrl: identity.avatarUrl || null,
          sessionToken: identity.sessionToken || null,
        }));
      }

      this._startSending();
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this._handleMessage(msg);
    };

    this.ws.onclose = () => {
      this._stopSending();
      eventBus.emit(NETWORK_DISCONNECTED);
    };

    this.ws.onerror = () => {
      // Logged by the browser; onclose fires after this, which handles cleanup.
    };

    this._onPlayerMoved = (state) => {
      this._latestLocalState = state;
    };
    eventBus.on(PLAYER_MOVED, this._onPlayerMoved);
  }

  _startSending() {
    const intervalMs = 1000 / NETWORK_SEND_RATE;
    this._sendInterval = setInterval(() => {
      if (this._latestLocalState && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'state', payload: this._latestLocalState }));
      }
    }, intervalMs);
  }

  _stopSending() {
    if (this._sendInterval) {
      clearInterval(this._sendInterval);
      this._sendInterval = null;
    }
  }

  // --- Map tracking ---

  sendMapChange(mapId, { instanced = false } = {}) {
    this._currentMapId = mapId;
    this._currentMapInstanced = instanced;
    if (import.meta.env.DEV) console.log(`[NetworkManager] mapChange→${mapId} ws=${this.ws?.readyState}`);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'mapChange', mapId, instanced }));
    }
    // Persist for reconnect
    try { localStorage.setItem('dd_last_map', mapId); } catch { /* noop */ }
  }

  get currentMapId() {
    return this._currentMapId;
  }

  // --- Party ---

  sendPartyInvite(targetId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'partyInvite', targetId }));
    }
  }

  sendPartyAccept() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'partyAccept' }));
    }
  }

  sendPartyDecline() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'partyDecline' }));
    }
  }

  sendPartyLeave() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'partyLeave' }));
    }
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.roomId = msg.roomId;
        if (import.meta.env.DEV) console.log(`[NetworkManager] welcome id=${msg.playerId} room=${msg.roomId}`);
        eventBus.emit(NETWORK_ROOM_JOINED, {
          playerId: msg.playerId,
          roomId: msg.roomId,
          colorIndex: msg.colorIndex,
        });
        // Re-send map — initial sendMapChange in GameScene.create() fires before
        // WS is open, so the message is dropped. This re-send ensures the server
        // knows our map once the connection is established.
        if (this._currentMapId) {
          this.sendMapChange(this._currentMapId, { instanced: this._currentMapInstanced || false });
        }
        break;
      case 'playerJoined':
        eventBus.emit(NETWORK_PLAYER_JOINED, {
          playerId: msg.playerId,
          colorIndex: msg.colorIndex,
          playerName: msg.playerName || null,
          mapId: msg.mapId || null,
        });
        break;
      case 'playerLeft':
        eventBus.emit(NETWORK_PLAYER_LEFT, { playerId: msg.playerId });
        break;
      case 'playerIdentity':
        eventBus.emit(NETWORK_PLAYER_IDENTITY, {
          playerId: msg.playerId,
          playerName: msg.playerName,
          avatarUrl: msg.avatarUrl,
        });
        break;
      case 'playerMapChanged':
        eventBus.emit(NETWORK_PLAYER_MAP_CHANGED, {
          playerId: msg.playerId,
          fromMap: msg.fromMap,
          toMap: msg.toMap,
        });
        break;
      case 'roster':
        eventBus.emit(NETWORK_ROSTER, { players: msg.players });
        break;
      case 'partyInviteReceived':
        eventBus.emit(NETWORK_PARTY_INVITE, { fromId: msg.fromId, fromName: msg.fromName });
        break;
      case 'partyUpdate':
        eventBus.emit(NETWORK_PARTY_UPDATE, msg.party);
        break;
      case 'partyDisbanded':
        eventBus.emit(NETWORK_PARTY_DISBANDED);
        break;
      case 'partyError':
        eventBus.emit(NETWORK_PARTY_ERROR, { error: msg.error });
        break;
      case 'stateUpdate':
        // Exclude our own state from the update
        if (this.playerId && msg.states[this.playerId]) {
          delete msg.states[this.playerId];
        }
        eventBus.emit(NETWORK_STATE_UPDATE, msg.states);
        break;
    }
  }

  disconnect() {
    this._stopSending();
    if (this._onPlayerMoved) {
      eventBus.off(PLAYER_MOVED, this._onPlayerMoved);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
