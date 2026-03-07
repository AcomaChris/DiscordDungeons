// @doc-player 04:Objects > Object Types
// You will encounter several types of interactive objects in the world:
// - **Doors** -- open, close, or walk through to travel to another map.
//   Some doors are **locked** and require a key or switch to open.
// - **Chests and containers** -- open to find loot and items inside.
// - **Switches and levers** -- activate or deactivate linked mechanisms.
// - **Traps** -- hidden hazards that trigger when you step on them.
// - **Teleporters** -- step onto them to warp to another location or map.
// - **NPCs** -- characters you can talk to for quests, shops, or dialogue.

// @doc-creator-content 02:Components > Component Definition Format
// Each component in `ComponentDefs` is an object with these fields:
// - **id** -- unique string identifier (e.g. `"door"`, `"container"`)
// - **name** -- human-readable display name
// - **category** -- one of `CORE`, `MECHANICAL`, `ENVIRONMENTAL`, or `EFFECT`
// - **authority** -- `CLIENT` (resolved locally) or `SERVER` (server-authoritative)
// - **persistence** -- `VOLATILE` (resets on reload), `SESSION`, or `PERSISTENT`
// - **trigger** -- `INTERACT` (press E), `TOUCH` (overlap), `STEP` (stand on), or `NONE`
// - **params** -- default parameter values for this component type

// --- Component Definitions ---
// Data-only registry of all component types, their default parameters,
// authority model, persistence mode, and trigger type.
// AGENT: Keep entries self-contained. Add new components by adding a new key.

export const ComponentCategory = {
  CORE: 'core',
  MECHANICAL: 'mechanical',
  ENVIRONMENTAL: 'environmental',
  EFFECT: 'effect',
};

export const Authority = {
  CLIENT: 'client',
  SERVER: 'server',
};

export const Persistence = {
  VOLATILE: 'volatile',     // Resets on map reload
  SESSION: 'session',       // Persists within browser session
  PERSISTENT: 'persistent', // Stored on server
};

export const TriggerType = {
  INTERACT: 'interact', // E key press when in range
  TOUCH: 'touch',       // Automatic on physics overlap
  STEP: 'step',         // Automatic when standing on tile
  NONE: 'none',         // No player trigger (event-driven only)
};

export const COMPONENT_DEFS = {
  // --- Wave 1: Core ---

  interactable: {
    id: 'interactable',
    name: 'Interactable',
    category: ComponentCategory.CORE,
    authority: Authority.CLIENT,
    persistence: Persistence.VOLATILE,
    trigger: TriggerType.INTERACT,
    params: {
      promptText: 'Interact',
      radius: 24,
      cooldown: 0,
    },
  },

  door: {
    id: 'door',
    name: 'Door',
    category: ComponentCategory.CORE,
    authority: Authority.SERVER,
    persistence: Persistence.SESSION,
    trigger: TriggerType.INTERACT,
    params: {
      isOpen: false,
      lockId: null,
      promptOpen: 'Open',
      promptClose: 'Close',
      targetMap: null,
      targetSpawn: null,
      targetX: 0,
      targetY: 0,
    },
  },

  container: {
    id: 'container',
    name: 'Container',
    category: ComponentCategory.CORE,
    authority: Authority.SERVER,
    persistence: Persistence.SESSION,
    trigger: TriggerType.INTERACT,
    params: {
      items: [],
      maxSlots: 8,
      lootTable: null,
      promptText: 'Open',
    },
  },

  // --- Wave 2: Mechanical ---

  switch: {
    id: 'switch',
    name: 'Switch / Lever',
    category: ComponentCategory.MECHANICAL,
    authority: Authority.CLIENT,
    persistence: Persistence.SESSION,
    trigger: TriggerType.INTERACT,
    params: {
      isOn: false,
      linkedEvent: null,
      promptOn: 'Activate',
      promptOff: 'Deactivate',
    },
  },

  trap: {
    id: 'trap',
    name: 'Trap',
    category: ComponentCategory.MECHANICAL,
    authority: Authority.SERVER,
    persistence: Persistence.VOLATILE,
    trigger: TriggerType.STEP,
    params: {
      damage: 10,
      armed: true,
      rearmDelay: 5000,
    },
  },

  destructible: {
    id: 'destructible',
    name: 'Destructible',
    category: ComponentCategory.MECHANICAL,
    authority: Authority.SERVER,
    persistence: Persistence.SESSION,
    trigger: TriggerType.NONE,
    params: {
      health: 100,
      maxHealth: 100,
      drops: [],
    },
  },

  script: {
    id: 'script',
    name: 'Lua Script',
    category: ComponentCategory.CORE,
    authority: Authority.CLIENT,
    persistence: Persistence.VOLATILE,
    trigger: TriggerType.INTERACT,
    params: {
      code: '',
    },
  },

  // --- Wave 3: Effects ---

  light: {
    id: 'light',
    name: 'Light',
    category: ComponentCategory.EFFECT,
    authority: Authority.CLIENT,
    persistence: Persistence.VOLATILE,
    trigger: TriggerType.NONE,
    params: {
      radius: 64,
      color: '#ffcc44',
      intensity: 1.0,
      flicker: false,
    },
  },

  sound: {
    id: 'sound',
    name: 'Sound Emitter',
    category: ComponentCategory.EFFECT,
    authority: Authority.CLIENT,
    persistence: Persistence.VOLATILE,
    trigger: TriggerType.NONE,
    params: {
      soundKey: null,
      volume: 1.0,
      loop: false,
      range: 128,
    },
  },

  spawner: {
    id: 'spawner',
    name: 'Spawner',
    category: ComponentCategory.ENVIRONMENTAL,
    authority: Authority.SERVER,
    persistence: Persistence.PERSISTENT,
    trigger: TriggerType.NONE,
    params: {
      spawnType: null,
      interval: 10000,
      maxActive: 3,
    },
  },

  teleporter: {
    id: 'teleporter',
    name: 'Teleporter',
    category: ComponentCategory.ENVIRONMENTAL,
    authority: Authority.CLIENT,
    persistence: Persistence.VOLATILE,
    trigger: TriggerType.STEP,
    params: {
      targetMap: null,
      targetSpawn: null,
      targetX: 0,
      targetY: 0,
    },
  },

  timer: {
    id: 'timer',
    name: 'Timer / Sequencer',
    category: ComponentCategory.MECHANICAL,
    authority: Authority.CLIENT,
    persistence: Persistence.VOLATILE,
    trigger: TriggerType.NONE,
    params: {
      duration: 5000,
      repeat: false,
      autoStart: false,
      linkedEvent: null,
    },
  },
};

export function getComponentDef(id) {
  return COMPONENT_DEFS[id] || null;
}

export function getComponentIds() {
  return Object.keys(COMPONENT_DEFS);
}

export function getComponentsByCategory(category) {
  return Object.values(COMPONENT_DEFS).filter(d => d.category === category);
}
