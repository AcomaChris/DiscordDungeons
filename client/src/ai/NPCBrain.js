// --- NPCBrain ---
// AI decision loop for NPC behavior. Connects perceptions → Behavior Engine API
// → action execution → outcome reporting.
//
// State machine: INITIALIZING → IDLE → THINKING → ACTING → IDLE → ...
// Event-driven: triggers on timer, proximity, or action completion.

import { BehaviorEngineClient } from '../behavior-engine/BehaviorEngineClient.js';
import { buildPerceptionMessage } from './Perceptions.js';
import { TILE_SIZE } from '../core/Constants.js';

// --- States ---
const STATE = {
  INITIALIZING: 'initializing',
  IDLE: 'idle',
  THINKING: 'thinking',
  ACTING: 'acting',
  ERROR: 'error',
};

// --- Timing ---
const IDLE_MIN_MS = 8000;   // min idle before thinking again
const IDLE_MAX_MS = 15000;  // max idle before thinking again
const IDLE_ACTION_MS = 2500; // idle action duration
const PROXIMITY_TILES = 5;  // trigger think when player enters/leaves this radius

// --- Agent Config ---
const ROLE_CONFIG = {
  core: `You are a bartender NPC in a 2D tile-based tavern RPG. You can move, speak, jump, and idle.
You receive perceptions about the world and must choose an action. Each action has a lifecycle:
you'll be told when your previous action started, completed, or failed.
Choose one function to call. Only call one action at a time.`,
  characterization: `You are Greta, a warm and witty tavern keeper. You move around the tavern
tidying up, and greet adventurers who enter. You occasionally jump when excited.
Keep speech short (under 20 words). You are curious and love hearing tales.`,
};

const AGENT_FUNCTIONS = [
  {
    name: 'move_to',
    docs: 'Walk to a tile position in the tavern. Takes a few seconds. Will fail if the path is blocked.',
    parameters: {
      x: { value_type: 'number', docs: 'Tile X coordinate (0-based from left)' },
      y: { value_type: 'number', docs: 'Tile Y coordinate (0-based from top)' },
    },
    required: ['x', 'y'],
  },
  {
    name: 'speak',
    docs: 'Say something out loud. Words appear above your head. Keep it under 20 words.',
    parameters: {
      text: { value_type: 'string', docs: 'What to say.' },
    },
    required: ['text'],
  },
  {
    name: 'jump',
    docs: 'Jump in place! Use when excited or happy.',
    parameters: {},
    required: [],
  },
  {
    name: 'idle',
    docs: 'Do nothing for a moment. Use when waiting or thinking.',
    parameters: {},
    required: [],
  },
];

export class NPCBrain {
  constructor(npc, player, { projectId, proxyUrl }) {
    this._npc = npc;
    this._player = player;
    this._state = STATE.INITIALIZING;
    this._lastAction = null;     // { action, args, status }
    this._idleTimer = 0;
    this._idleTarget = 0;
    this._actingTimer = 0;       // for idle/speak action timeout
    this._currentAction = null;  // { action, args }
    this._playerWasNear = false;
    this._mapSize = null;
    // Callback to check if real players are present on this map.
    // When set and returns false, the brain pauses to avoid burning API credits.
    this._hasPlayersCheck = null;

    // --- Behavior Engine client ---
    this._client = new BehaviorEngineClient({ projectId, proxyUrl });
    this._sessionId = null;
    this._agentId = null;
  }

  // --- Initialization ---

  async init() {
    try {
      const session = await this._client.createSession();
      this._sessionId = session.id;

      const agent = await this._client.createAgent(this._sessionId, {
        role_config: ROLE_CONFIG,
        component_configs: [
          { id: 'history', type: 'limited_list', max_entries: 20 },
          { id: 'facts', type: 'kv_store', delimiter: ':' },
        ],
        presentation_config: {
          presentation_order: [['history', 'items'], ['facts', 'data']],
        },
        service_configs: [
          { id: 'default_llm', service_name: 'openai/gpt_4o_mini', temperature: 0.8 },
        ],
        agent_llm: 'default_llm',
      });
      this._agentId = agent.id;

      this._state = STATE.IDLE;
      this._resetIdleTimer();
      console.log('[NPCBrain] Initialized — session:', this._sessionId, 'agent:', this._agentId);
    } catch (err) {
      this._state = STATE.ERROR;
      console.error('[NPCBrain] Init failed:', err.message);
    }
  }

  // Set map dimensions for perceptions
  setMapSize(width, height) {
    this._mapSize = { width, height };
  }

  // --- Update (called from GameScene.update each frame) ---

  // Set a callback that returns true if real players are present on this map.
  // When no players are present, the brain skips thinking to save API credits.
  setHasPlayersCheck(fn) {
    this._hasPlayersCheck = fn;
  }

  update(delta) {
    if (this._state === STATE.INITIALIZING || this._state === STATE.ERROR) return;

    // Pause AI when no real players are on this map
    if (this._hasPlayersCheck && !this._hasPlayersCheck()) {
      if (this._state === STATE.IDLE) this._idleTimer = 0;
      return;
    }

    if (this._state === STATE.IDLE) {
      this._idleTimer += delta;

      // Check proximity trigger
      const nearNow = this._isPlayerNear();
      if (nearNow !== this._playerWasNear) {
        this._playerWasNear = nearNow;
        this._triggerThink();
        return;
      }

      // Timer trigger
      if (this._idleTimer >= this._idleTarget) {
        this._triggerThink();
      }
    }

    if (this._state === STATE.ACTING) {
      this._updateActing(delta);
    }
  }

  // --- Thinking ---

  _triggerThink() {
    if (this._state !== STATE.IDLE) return;
    this._state = STATE.THINKING;
    this._think();
  }

  async _think() {
    try {
      const npcState = this._npc.getState();
      const playerState = this._getPlayerState();
      const perception = buildPerceptionMessage(npcState, playerState, this._lastAction, this._mapSize);

      const messages = [
        { message_type: 'ContentMessage', content: perception },
      ];

      const result = await this._client.generateAction(
        this._sessionId,
        this._agentId,
        messages,
        AGENT_FUNCTIONS,
      );

      if (this._state !== STATE.THINKING) return; // was destroyed while waiting

      if (result.function_call) {
        this._executeAction(result.function_call.name, result.function_call.args || {});
      } else {
        // No function call — go idle
        this._state = STATE.IDLE;
        this._resetIdleTimer();
      }
    } catch (err) {
      console.error('[NPCBrain] Think error:', err.message);
      this._state = STATE.IDLE;
      this._resetIdleTimer();
    }
  }

  // --- Action Execution ---

  _executeAction(actionName, args) {
    this._currentAction = { action: actionName, args };
    this._state = STATE.ACTING;
    this._actingTimer = 0;

    switch (actionName) {
    case 'move_to': {
      const tx = Math.round(args.x);
      const ty = Math.round(args.y);
      const ok = this._npc.moveTo(tx, ty);
      if (!ok) {
        this._completeAction('failed');
        return;
      }
      // Wait for pathFollower to call onActionComplete
      this._npc.onActionComplete = (result) => {
        if (result.action === 'move_to') {
          this._npc.onActionComplete = null;
          this._completeAction(result.status);
        }
      };
      break;
    }
    case 'speak': {
      const text = String(args.text || '');
      const duration = Math.max(2000, Math.min(text.length * 100, 6000));
      const npcState = this._npc.getState();
      this._npc.speechBubble.show(text, this._npc.sprite.x, npcState.y - 20, duration);
      // Complete after duration
      this._actingTimer = 0;
      this._actingDuration = duration;
      break;
    }
    case 'jump':
      this._npc.jump();
      // Wait for jump to land
      this._npc.onActionComplete = (result) => {
        if (result.action === 'jump') {
          this._npc.onActionComplete = null;
          this._completeAction(result.status);
        }
      };
      break;
    case 'idle':
      this._actingTimer = 0;
      this._actingDuration = IDLE_ACTION_MS;
      break;
    default:
      console.warn('[NPCBrain] Unknown action:', actionName);
      this._completeAction('failed');
    }
  }

  _updateActing(delta) {
    if (!this._currentAction) return;
    const action = this._currentAction.action;

    // Timer-based actions: speak and idle
    if (action === 'speak' || action === 'idle') {
      this._actingTimer += delta;
      if (this._actingTimer >= this._actingDuration) {
        this._completeAction('completed');
      }
    }
    // move_to and jump complete via onActionComplete callback
  }

  _completeAction(status) {
    if (this._currentAction) {
      this._lastAction = {
        action: this._currentAction.action,
        args: this._currentAction.args,
        status,
      };
    }
    this._currentAction = null;
    this._npc.onActionComplete = null;
    this._state = STATE.IDLE;
    this._resetIdleTimer();
  }

  // --- Helpers ---

  _isPlayerNear() {
    const npc = this._npc.getState();
    const px = this._player.sprite.x;
    const py = this._player._groundY;
    const dtx = Math.abs(npc.x - px) / TILE_SIZE;
    const dty = Math.abs(npc.y - py) / TILE_SIZE;
    return (dtx + dty) < PROXIMITY_TILES;
  }

  _getPlayerState() {
    return {
      x: this._player.sprite.x,
      y: this._player._groundY,
      facing: this._player.facing,
      name: this._player.playerName || 'Unknown Adventurer',
    };
  }

  _resetIdleTimer() {
    this._idleTimer = 0;
    this._idleTarget = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
  }

  get state() {
    return this._state;
  }

  // --- Cleanup ---

  destroy() {
    this._state = STATE.ERROR; // prevent further updates
    this._npc.onActionComplete = null;
    this._currentAction = null;
  }
}
