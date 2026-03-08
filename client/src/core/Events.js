// --- Event Names ---
// Single source of truth for all EventBus event strings.

// Input
export const INPUT_ACTION = 'input:action';
export const INPUT_FOCUS_CHANGED = 'input:focusChanged';

// Player
export const PLAYER_MOVED = 'player:moved';

// Scenes
export const SCENE_CHANGE = 'scene:change';
export const MAP_TRANSITION_REQUEST = 'map:transitionRequest';

// Objects
export const OBJECT_INTERACT = 'object:interact';
export const OBJECT_TOUCH = 'object:touch';
export const OBJECT_STEP = 'object:step';
export const OBJECT_STATE_CHANGED = 'object:stateChanged';
export const OBJECT_EVENT = 'object:event';
export const OBJECT_SPAWNED = 'object:spawned';
export const OBJECT_DESTROYED = 'object:destroyed';

// Network
export const NETWORK_CONNECTED = 'network:connected';
export const NETWORK_DISCONNECTED = 'network:disconnected';
export const NETWORK_PLAYER_JOINED = 'network:playerJoined';
export const NETWORK_PLAYER_LEFT = 'network:playerLeft';
export const NETWORK_STATE_UPDATE = 'network:stateUpdate';
export const NETWORK_ROOM_JOINED = 'network:roomJoined';
export const NETWORK_PLAYER_IDENTITY = 'network:playerIdentity';
export const NETWORK_PLAYER_MAP_CHANGED = 'network:playerMapChanged';
export const NETWORK_ROSTER = 'network:roster';
export const NETWORK_PARTY_INVITE = 'network:partyInvite';
export const NETWORK_PARTY_UPDATE = 'network:partyUpdate';
export const NETWORK_PARTY_DISBANDED = 'network:partyDisbanded';
export const NETWORK_PARTY_ERROR = 'network:partyError';

// Inventory
export const INVENTORY_CHANGED = 'inventory:changed';
export const INVENTORY_ITEM_ADDED = 'inventory:itemAdded';

// Stats
export const STATS_CHANGED = 'stats:changed';
