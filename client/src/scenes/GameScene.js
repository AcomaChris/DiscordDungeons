import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import {
  INPUT_ACTION,
  NETWORK_ROOM_JOINED,
  NETWORK_PLAYER_JOINED,
  NETWORK_PLAYER_LEFT,
  NETWORK_STATE_UPDATE,
} from '../core/Events.js';
import { FLOOR_HEIGHT } from '../core/Constants.js';
import { InputManager } from '../input/InputManager.js';
import { TouchManager } from '../input/TouchManager.js';
import { mergeInputSnapshots } from '../input/mergeInputSnapshots.js';
import { Player } from '../entities/Player.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { NetworkManager } from '../network/NetworkManager.js';

// --- GameScene ---
// Thin orchestrator: creates floor, player, input, network. Delegates everything via events.

// AGENT: WS_URL is set at build time for production, falls back to localhost for dev.
// When deploying the WS server, set VITE_WS_URL in the GitHub Actions env.
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.remotePlayers = new Map();

    this._createFloor();
    this.player = new Player(this, this.floor);
    this.inputManager = new InputManager(this);
    this.touchManager = new TouchManager();
    this.touchManager.show();

    this._subscribeEvents();
    this._connectNetwork();
  }

  _createFloor() {
    const { width, height } = this.scale;
    const floorY = height - FLOOR_HEIGHT / 2;
    // AGENT: 'floor' texture is created by BootScene — do not recreate here
    this.floor = this.physics.add.staticImage(width / 2, floorY, 'floor');
  }

  // --- Event Subscriptions ---

  _subscribeEvents() {
    this._onInput = (data) => this.player.handleInput(data);
    this._onRoomJoined = ({ colorIndex }) => this.player.setColorIndex(colorIndex);
    this._onPlayerJoined = (data) => this._addRemotePlayer(data);
    this._onPlayerLeft = (data) => this._removeRemotePlayer(data);
    this._onStateUpdate = (data) => this._updateRemotePlayers(data);

    eventBus.on(INPUT_ACTION, this._onInput);
    eventBus.on(NETWORK_ROOM_JOINED, this._onRoomJoined);
    eventBus.on(NETWORK_PLAYER_JOINED, this._onPlayerJoined);
    eventBus.on(NETWORK_PLAYER_LEFT, this._onPlayerLeft);
    eventBus.on(NETWORK_STATE_UPDATE, this._onStateUpdate);
  }

  // --- Remote Players ---

  _addRemotePlayer({ playerId, colorIndex }) {
    if (this.remotePlayers.has(playerId)) return;
    const rp = new RemotePlayer(this, colorIndex);
    this.remotePlayers.set(playerId, rp);
  }

  _removeRemotePlayer({ playerId }) {
    const rp = this.remotePlayers.get(playerId);
    if (rp) {
      rp.destroy();
      this.remotePlayers.delete(playerId);
    }
  }

  _updateRemotePlayers(states) {
    for (const [playerId, state] of Object.entries(states)) {
      const rp = this.remotePlayers.get(playerId);
      if (rp) rp.applyState(state);
    }
  }

  // --- Update Loop ---

  update(_time, _delta) {
    const kbSnap = this.inputManager.getSnapshot();
    const touchSnap = this.touchManager.getSnapshot();
    const merged = mergeInputSnapshots(kbSnap, touchSnap);
    eventBus.emit(INPUT_ACTION, merged);

    for (const rp of this.remotePlayers.values()) {
      rp.update();
    }
  }

  // --- Network ---

  _connectNetwork() {
    this.networkManager = new NetworkManager(WS_URL);
    this.networkManager.connect('default');
  }

  // --- Cleanup ---
  // AGENT: Must unsubscribe all EventBus listeners to prevent duplicates on scene restart

  shutdown() {
    eventBus.off(INPUT_ACTION, this._onInput);
    eventBus.off(NETWORK_ROOM_JOINED, this._onRoomJoined);
    eventBus.off(NETWORK_PLAYER_JOINED, this._onPlayerJoined);
    eventBus.off(NETWORK_PLAYER_LEFT, this._onPlayerLeft);
    eventBus.off(NETWORK_STATE_UPDATE, this._onStateUpdate);

    if (this.networkManager) this.networkManager.disconnect();
    this.inputManager.destroy();
    this.touchManager.destroy();
    for (const rp of this.remotePlayers.values()) {
      rp.destroy();
    }
    this.remotePlayers.clear();
  }
}
