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
} from '../core/Events.js';
import { NETWORK_SEND_RATE } from '../core/Constants.js';

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

  _handleMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        eventBus.emit(NETWORK_ROOM_JOINED, {
          playerId: msg.playerId,
          roomId: msg.roomId,
          colorIndex: msg.colorIndex,
        });
        break;
      case 'playerJoined':
        eventBus.emit(NETWORK_PLAYER_JOINED, {
          playerId: msg.playerId,
          colorIndex: msg.colorIndex,
          playerName: msg.playerName || null,
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
