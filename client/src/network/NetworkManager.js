import eventBus from '../core/EventBus.js';
import {
  PLAYER_MOVED,
  NETWORK_CONNECTED,
  NETWORK_DISCONNECTED,
  NETWORK_PLAYER_JOINED,
  NETWORK_PLAYER_LEFT,
  NETWORK_STATE_UPDATE,
  NETWORK_ROOM_JOINED,
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

  connect(roomId) {
    const url = `${this.serverUrl}?room=${encodeURIComponent(roomId)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      eventBus.emit(NETWORK_CONNECTED);
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
        eventBus.emit(NETWORK_ROOM_JOINED, { playerId: msg.playerId, roomId: msg.roomId });
        break;
      case 'playerJoined':
        eventBus.emit(NETWORK_PLAYER_JOINED, {
          playerId: msg.playerId,
          colorIndex: msg.colorIndex,
        });
        break;
      case 'playerLeft':
        eventBus.emit(NETWORK_PLAYER_LEFT, { playerId: msg.playerId });
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
