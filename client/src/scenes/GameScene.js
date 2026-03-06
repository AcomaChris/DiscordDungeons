import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import {
  INPUT_ACTION,
  NETWORK_ROOM_JOINED,
  NETWORK_PLAYER_JOINED,
  NETWORK_PLAYER_LEFT,
  NETWORK_STATE_UPDATE,
  NETWORK_PLAYER_IDENTITY,
  NETWORK_PLAYER_MAP_CHANGED,
  NETWORK_ROSTER,
  OBJECT_STATE_CHANGED,
} from '../core/Events.js';
import { CAMERA_ZOOM } from '../core/Constants.js';
import { InputManager } from '../input/InputManager.js';
import { TouchManager } from '../input/TouchManager.js';
import { mergeInputSnapshots } from '../input/mergeInputSnapshots.js';
import { Player } from '../entities/Player.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { TileMapManager } from '../map/TileMapManager.js';
import { NPC } from '../entities/NPC.js';
import { buildCollisionGrid } from '../ai/Pathfinder.js';
import { NPCBrain } from '../ai/NPCBrain.js';
import { getMapConfig } from '../map/MapRegistry.js';
import authManager from '../auth/AuthManager.js';
import { ObjectManager } from '../objects/ObjectManager.js';
import { InteractionManager } from '../objects/InteractionManager.js';
import { ObjectEventRouter } from '../objects/ObjectEventRouter.js';
import objectStateStore from '../objects/ObjectStateStore.js';
import { MapTransitionManager } from '../map/MapTransitionManager.js';
import { playDepartureEffect, playArrivalEffect } from '../entities/TransitionEffect.js';
import luaEngine from '../scripting/LuaEngine.js';
import { injectStandardBindings } from '../scripting/LuaBindings.js';
import { RosterHUD } from '../hud/RosterHUD.js';
import { PartyUI } from '../hud/PartyUI.js';

// --- GameScene ---
// Orchestrator: loads tilemap, creates player, wires input + network.
// Uses TileMapManager for map loading and collision.

// AGENT: WS_URL is set at build time for production, falls back to localhost for dev.
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

// Map selection: ?map=X overrides default. Used by E2E tests.
const DEFAULT_MAP = 'test';

function getActiveMapId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('map') || DEFAULT_MAP;
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Scene restart with init data takes priority over URL param
    const initData = this.scene.settings.data;
    this._mapId = initData?.mapId || getActiveMapId();
    this._spawnTarget = initData?.spawnTarget || null;

    const mapConfig = getMapConfig(this._mapId);
    this.tileMapManager = new TileMapManager(this);
    this.tileMapManager.preload(this._mapId, mapConfig.jsonPath, mapConfig.tilesets);
  }

  create() {
    // Detect whether this is a map transition restart or initial load
    const isRestart = !!this.scene.settings.data?.mapId;

    if (!isRestart) {
      this.remotePlayers = new Map();
    }

    // --- Tilemap ---
    this.tileMapManager.create(this._mapId);
    const { width, height } = this.tileMapManager.getWorldBounds();
    this.physics.world.setBounds(0, 0, width, height);

    // --- Interactive Objects ---
    this.objectManager = new ObjectManager();
    this.objectManager.createFromMapData(this.tileMapManager.objectData);
    objectStateStore.restoreAll(this.objectManager);
    this.objectManager.createVisuals(this);
    console.log(`[GameScene] Loaded ${this.objectManager.size} interactive objects from map`);

    // --- Lua Scripting ---
    // Init is async — scripts compile in background, ready before player can interact
    this._initLuaScripting();

    // --- Player ---
    const spawn = this.tileMapManager.getSpawnTarget(this._spawnTarget);
    this.player = new Player(this, spawn.x, spawn.y, authManager.identity?.playerName);
    this.player.sprite.setCollideWorldBounds(true);

    // Collide player with the invisible collision layer
    if (this.tileMapManager.collisionLayer) {
      this.physics.add.collider(this.player.sprite, this.tileMapManager.collisionLayer);
    }

    // --- NPC (only on maps that define one — test map for now) ---
    this._initNPC();

    // --- Input ---
    // Re-enable keyboard after map transition (MapTransitionManager disables it during fade)
    this.input.keyboard.enabled = true;
    this.inputManager = new InputManager(this);
    this.touchManager = new TouchManager();
    this.touchManager.setAbilityManager(this.player.abilities);
    this.touchManager.show();

    // --- Event Routing ---
    this.eventRouter = new ObjectEventRouter(this.objectManager);

    // --- Interaction System ---
    this.interactionManager = new InteractionManager(this.objectManager, this);

    // --- Camera ---
    this._updateCamera();
    this.cameras.main.startFollow(this.player.sprite);
    this.scale.on('resize', () => this._updateCamera(), this);

    // --- Map Transitions ---
    this.mapTransitionManager = new MapTransitionManager(this);

    // --- Network ---
    this._subscribeEvents();
    if (!isRestart) {
      this._connectNetwork();
    } else {
      // Restore networkManager from game-level reference (survives scene restart)
      this.networkManager = this.game.__networkManager;
    }

    // Tell server which map we're on (include instanced flag for instance isolation)
    if (this.networkManager) {
      const mapConfig = getMapConfig(this._mapId);
      this.networkManager.sendMapChange(this._mapId, { instanced: !!mapConfig.instanced });
    }

    // --- HUD ---
    // RosterHUD and PartyUI are DOM-based, persist across map transitions.
    if (!isRestart) {
      this.rosterHUD = new RosterHUD();
      this.partyUI = new PartyUI(this.networkManager);
      this.partyUI.init();
      // RosterHUD.init() deferred to _onRoomJoined (needs playerId from welcome)
      this.game.__rosterHUD = this.rosterHUD;
      this.game.__partyUI = this.partyUI;
    } else {
      this.rosterHUD = this.game.__rosterHUD;
      this.partyUI = this.game.__partyUI;
      if (this.rosterHUD) this.rosterHUD.setLocalMapId(this._mapId);
    }

    // Fade in from black (smooth entry after map transition or initial load)
    this.cameras.main.fadeIn(500);
  }

  // --- NPC ---
  // AGENT: NPC is only created on maps that have one. Currently hardcoded
  // to the test map. Will be data-driven from object layer later.

  _initNPC() {
    if (this._mapId !== 'test') {
      this.npc = null;
      this.npcBrain = null;
      return;
    }

    this.npc = new NPC(this, 280, 216, {
      npcId: 'greta',
      name: 'Greta',
      color: 0x8B4513,
    });
    if (this.tileMapManager.collisionLayer) {
      this.physics.add.collider(this.npc.sprite, this.tileMapManager.collisionLayer);
    }
    this.physics.add.collider(this.player.sprite, this.npc.sprite);

    if (this.tileMapManager.collisionLayer) {
      this.npc._collisionGrid = buildCollisionGrid(
        this.tileMapManager.collisionLayer,
        this.tileMapManager.tilemap.width,
        this.tileMapManager.tilemap.height,
      );
    }

    const beProjectId = (typeof __BE_PROJECT_ID__ !== 'undefined' && __BE_PROJECT_ID__)
      || 'proj_3AQEfXcDaTOVWwsD5vyOvA7rACg';
    this.npcBrain = new NPCBrain(this.npc, this.player, {
      projectId: beProjectId,
      proxyUrl: WS_URL.replace('ws://', 'http://').replace('wss://', 'https://'),
    });
    this.npcBrain.setMapSize(
      this.tileMapManager.tilemap.width,
      this.tileMapManager.tilemap.height,
    );
    // AGENT: The hasPlayersCheck hook exists on NPCBrain for future use when
    // Greta runs server-side. Currently she's client-side, so the local player
    // is always present — no need to set a check here.
    this.npcBrain.init();

    globalThis.__NPC__ = this.npc;
  }

  // --- Lua Scripting ---

  async _initLuaScripting() {
    await luaEngine.init();
    if (!luaEngine.isReady) return;

    this._luaBindings = injectStandardBindings(luaEngine, this.objectManager);

    // Wire bindings into ScriptComponents and run their async init
    for (const obj of this.objectManager.all) {
      const scriptComp = obj.components.get('script');
      if (scriptComp) {
        scriptComp._bindings = this._luaBindings;
        await scriptComp.init();
      }
    }

    console.log('[GameScene] Lua scripting initialized');
  }

  // --- Camera ---
  // Zoom = CAMERA_ZOOM × devicePixelRatio so the character always appears
  // CHAR_HEIGHT × CAMERA_ZOOM CSS pixels tall regardless of screen DPR.

  _updateCamera() {
    this.cameras.main.setZoom(CAMERA_ZOOM);
  }

  // --- Event Subscriptions ---

  _subscribeEvents() {
    this._onInput = (data) => this.player.handleInput(data);
    this._onRoomJoined = ({ colorIndex, playerId }) => {
      this.player.setColorIndex(colorIndex);
      // Deferred HUD init: playerId is only known after welcome
      if (this.rosterHUD && !this.rosterHUD._badge) {
        this.rosterHUD.init(playerId, this._mapId, this.networkManager);
      }
    };
    this._onPlayerJoined = (data) => this._addRemotePlayer(data);
    this._onPlayerLeft = (data) => this._removeRemotePlayer(data);
    this._onStateUpdate = (data) => this._updateRemotePlayers(data);
    this._onPlayerIdentity = (data) => this._updatePlayerIdentity(data);
    this._onPlayerMapChanged = (data) => this._handlePlayerMapChanged(data);
    this._onRoster = (data) => this._handleRoster(data);
    this._onObjectStateChanged = ({ objectId, state }) => {
      const obj = this.objectManager.getObjectById(objectId);
      if (obj) {
        const persistence = objectStateStore._getObjectPersistence(obj);
        objectStateStore.save(objectId, state, persistence);
      }
    };

    eventBus.on(INPUT_ACTION, this._onInput);
    eventBus.on(NETWORK_ROOM_JOINED, this._onRoomJoined);
    eventBus.on(NETWORK_PLAYER_JOINED, this._onPlayerJoined);
    eventBus.on(NETWORK_PLAYER_LEFT, this._onPlayerLeft);
    eventBus.on(NETWORK_STATE_UPDATE, this._onStateUpdate);
    eventBus.on(NETWORK_PLAYER_IDENTITY, this._onPlayerIdentity);
    eventBus.on(NETWORK_PLAYER_MAP_CHANGED, this._onPlayerMapChanged);
    eventBus.on(NETWORK_ROSTER, this._onRoster);
    eventBus.on(OBJECT_STATE_CHANGED, this._onObjectStateChanged);
  }

  // --- Remote Players ---
  // AGENT: _remotePlayerMaps tracks mapId per remote player. Only players on
  // our map get sprites. Players on other maps are tracked but not rendered.

  _addRemotePlayer({ playerId, colorIndex, playerName, mapId }) {
    // Track their map even if they're not on ours
    if (!this._remotePlayerMaps) this._remotePlayerMaps = new Map();
    this._remotePlayerMaps.set(playerId, mapId || null);

    // Only create sprite if they're on our map (or map unknown)
    if (mapId && mapId !== this._mapId) return;
    if (this.remotePlayers.has(playerId)) return;
    const spawn = this.tileMapManager.spawnPoint;
    const rp = new RemotePlayer(this, colorIndex, spawn.x, spawn.y, playerName);
    this.remotePlayers.set(playerId, rp);
  }

  _updatePlayerIdentity({ playerId, playerName }) {
    const rp = this.remotePlayers.get(playerId);
    if (rp) rp.setPlayerName(playerName);
  }

  _removeRemotePlayer({ playerId }) {
    if (this._remotePlayerMaps) this._remotePlayerMaps.delete(playerId);
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

  _handlePlayerMapChanged({ playerId, fromMap, toMap }) {
    if (!this._remotePlayerMaps) this._remotePlayerMaps = new Map();
    this._remotePlayerMaps.set(playerId, toMap);

    // Ignore our own map changes
    if (this.networkManager && playerId === this.networkManager.playerId) return;

    if (toMap === this._mapId) {
      // Player arrived on our map — arrival effect at spawn
      const spawn = this.tileMapManager.spawnPoint;
      playArrivalEffect(this, spawn.x, spawn.y);
    } else if (fromMap === this._mapId) {
      // Player left our map — departure effect at their last position, then destroy
      const rp = this.remotePlayers.get(playerId);
      if (rp) {
        playDepartureEffect(this, rp.sprite.x, rp.sprite.y);
        rp.destroy();
        this.remotePlayers.delete(playerId);
      }
    }
  }

  _handleRoster({ players }) {
    if (!this._remotePlayerMaps) this._remotePlayerMaps = new Map();
    for (const p of players) {
      this._remotePlayerMaps.set(p.playerId, p.mapId || null);
    }
  }

  // --- Update Loop ---

  update(_time, delta) {
    const kbSnap = this.inputManager.getSnapshot();
    const touchSnap = this.touchManager.getSnapshot();
    const merged = mergeInputSnapshots(kbSnap, touchSnap);
    this._lastInput = merged;
    eventBus.emit(INPUT_ACTION, merged);

    // Tile animations — advance frame timers and swap indices
    this.tileMapManager.update(delta);

    // Interactive objects — update components and check interactions
    this.objectManager.update(delta);
    const playerBody = this.player.sprite.body;
    this.interactionManager.update(delta, playerBody.x, playerBody.y, merged);

    // Z-axis physics — velocity/height update only. syncGroundPosition and
    // updateDepth run in the entity's postupdate handler, after Phaser's
    // body.postUpdate() has synced sprite.y from the physics body.
    this.player.updateJump(delta);
    if (this.npc) this.npc.update(delta);
    if (this.npcBrain) this.npcBrain.update(delta);
    for (const rp of this.remotePlayers.values()) {
      rp.update(delta);
      rp.updateDepth();
    }
  }

  // --- Network ---

  _connectNetwork() {
    this.networkManager = new NetworkManager(WS_URL);
    // Persist at game level so it survives scene restarts during map transitions
    this.game.__networkManager = this.networkManager;
    const roomId = authManager.activityChannelId || 'default';
    this.networkManager.connect(roomId, authManager.identity);
  }

  // --- Cleanup ---
  // AGENT: Must unsubscribe all EventBus listeners to prevent duplicates on scene restart

  shutdown() {
    this.mapTransitionManager.destroy();
    this.scale.off('resize', this._updateCamera, this);
    eventBus.off(INPUT_ACTION, this._onInput);
    eventBus.off(NETWORK_ROOM_JOINED, this._onRoomJoined);
    eventBus.off(NETWORK_PLAYER_JOINED, this._onPlayerJoined);
    eventBus.off(NETWORK_PLAYER_LEFT, this._onPlayerLeft);
    eventBus.off(NETWORK_STATE_UPDATE, this._onStateUpdate);
    eventBus.off(NETWORK_PLAYER_IDENTITY, this._onPlayerIdentity);
    eventBus.off(NETWORK_PLAYER_MAP_CHANGED, this._onPlayerMapChanged);
    eventBus.off(NETWORK_ROSTER, this._onRoster);
    eventBus.off(OBJECT_STATE_CHANGED, this._onObjectStateChanged);

    if (this._luaBindings?.timer) this._luaBindings.timer.clearAll();
    luaEngine.destroy();
    objectStateStore.saveAll(this.objectManager);
    this.eventRouter.destroy();
    this.interactionManager.destroy();
    this.objectManager.destroy();
    this.inputManager.destroy();
    this.touchManager.destroy();
    this.player.destroy();
    if (this.npcBrain) this.npcBrain.destroy();
    if (this.npc) this.npc.destroy();
    this.tileMapManager.destroy();
    for (const rp of this.remotePlayers.values()) {
      rp.destroy();
    }
    this.remotePlayers.clear();

    // Disconnect network and destroy HUD only on full scene stop, not on map transition
    if (!this._isMapTransition) {
      if (this.networkManager) this.networkManager.disconnect();
      if (this.rosterHUD) this.rosterHUD.destroy();
      if (this.partyUI) this.partyUI.destroy();
    }
  }
}
