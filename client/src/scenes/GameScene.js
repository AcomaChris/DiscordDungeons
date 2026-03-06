import Phaser from 'phaser';
import eventBus from '../core/EventBus.js';
import {
  INPUT_ACTION,
  NETWORK_ROOM_JOINED,
  NETWORK_PLAYER_JOINED,
  NETWORK_PLAYER_LEFT,
  NETWORK_STATE_UPDATE,
  NETWORK_PLAYER_IDENTITY,
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
import luaEngine from '../scripting/LuaEngine.js';
import { injectStandardBindings } from '../scripting/LuaBindings.js';

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
    this.remotePlayers = new Map();

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

    // --- NPC ---
    this.npc = new NPC(this, 328, 264, {
      npcId: 'greta',
      name: 'Greta',
      color: 0x8B4513,
    });
    if (this.tileMapManager.collisionLayer) {
      this.physics.add.collider(this.npc.sprite, this.tileMapManager.collisionLayer);
    }
    this.physics.add.collider(this.player.sprite, this.npc.sprite);

    // Pass collision grid for A* pathfinding
    if (this.tileMapManager.collisionLayer) {
      this.npc._collisionGrid = buildCollisionGrid(
        this.tileMapManager.collisionLayer,
        this.tileMapManager.tilemap.width,
        this.tileMapManager.tilemap.height,
      );
    }

    // --- NPC Brain ---
    // AGENT: __BE_PROJECT_ID__ is injected at build time via Vite define.
    // Falls back to the default DiscordDungeons project.
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
    this.npcBrain.init();

    // Expose NPC for console testing (e.g. window.__NPC__.jump(), window.__NPC__.moveTo(5, 8))
    globalThis.__NPC__ = this.npc;

    // --- Input ---
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
    this._connectNetwork();

    // Fade in from black (smooth entry after map transition or initial load)
    this.cameras.main.fadeIn(500);
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
    this._onRoomJoined = ({ colorIndex }) => this.player.setColorIndex(colorIndex);
    this._onPlayerJoined = (data) => this._addRemotePlayer(data);
    this._onPlayerLeft = (data) => this._removeRemotePlayer(data);
    this._onStateUpdate = (data) => this._updateRemotePlayers(data);
    this._onPlayerIdentity = (data) => this._updatePlayerIdentity(data);
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
    eventBus.on(OBJECT_STATE_CHANGED, this._onObjectStateChanged);
  }

  // --- Remote Players ---

  _addRemotePlayer({ playerId, colorIndex, playerName }) {
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

  update(_time, delta) {
    const kbSnap = this.inputManager.getSnapshot();
    const touchSnap = this.touchManager.getSnapshot();
    const merged = mergeInputSnapshots(kbSnap, touchSnap);
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
    this.npc.update(delta);
    this.npcBrain.update(delta);
    for (const rp of this.remotePlayers.values()) {
      rp.update(delta);
      rp.updateDepth();
    }
  }

  // --- Network ---

  _connectNetwork() {
    this.networkManager = new NetworkManager(WS_URL);
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
    eventBus.off(OBJECT_STATE_CHANGED, this._onObjectStateChanged);

    if (this.networkManager) this.networkManager.disconnect();
    if (this._luaBindings?.timer) this._luaBindings.timer.clearAll();
    luaEngine.destroy();
    objectStateStore.saveAll(this.objectManager);
    this.eventRouter.destroy();
    this.interactionManager.destroy();
    this.objectManager.destroy();
    this.inputManager.destroy();
    this.touchManager.destroy();
    this.player.destroy();
    this.npcBrain.destroy();
    this.npc.destroy();
    this.tileMapManager.destroy();
    for (const rp of this.remotePlayers.values()) {
      rp.destroy();
    }
    this.remotePlayers.clear();
  }
}
