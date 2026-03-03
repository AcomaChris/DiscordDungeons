// --- Perceptions ---
// Builds a text description of the world for the AI agent. Plain English,
// structured for LLM consumption. Called before each generateAction() call.

import { TILE_SIZE } from '../core/Constants.js';

// Convert world position to tile coordinates
function toTile(x, y) {
  return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
}

// Manhattan distance in tiles
function tileDist(a, b) {
  return Math.abs(a.tx - b.tx) + Math.abs(a.ty - b.ty);
}

// Relative direction from A to B (cardinal)
function relativeDir(from, to) {
  const dx = to.tx - from.tx;
  const dy = to.ty - from.ty;
  if (dx === 0 && dy === 0) return 'at your position';

  const parts = [];
  if (dy < 0) parts.push('north');
  if (dy > 0) parts.push('south');
  if (dx > 0) parts.push('east');
  if (dx < 0) parts.push('west');
  return parts.join('-');
}

// Build the perception message string.
// npcState: { x, y, z, facing, isJumping } from NPC.getState()
// playerState: { x, y, facing, name } from Player
// lastAction: { action, args, status } or null
// mapSize: { width, height } in tiles (optional)
export function buildPerceptionMessage(npcState, playerState, lastAction, mapSize) {
  const npcTile = toTile(npcState.x, npcState.y);
  const lines = [];

  // --- NPC Self ---
  lines.push('[Perception]');
  lines.push(`Your position: tile (${npcTile.tx}, ${npcTile.ty})`);
  lines.push(`Your facing: ${npcState.facing}`);
  const state = npcState.isJumping ? 'jumping' : 'idle';
  lines.push(`Your current state: ${state}`);

  // --- Player ---
  if (playerState) {
    const pTile = toTile(playerState.x, playerState.y);
    const dist = tileDist(npcTile, pTile);
    const dir = relativeDir(npcTile, pTile);
    const name = playerState.name || 'Unknown Adventurer';
    lines.push('');
    lines.push('[Player]');
    lines.push(`Player "${name}" is at tile (${pTile.tx}, ${pTile.ty}), ${dist} tiles away, to your ${dir}.`);
    lines.push(`Player is facing: ${playerState.facing}`);
  }

  // --- Previous Action ---
  lines.push('');
  lines.push('[Previous Action]');
  if (lastAction) {
    const argsStr = lastAction.args ? `(${JSON.stringify(lastAction.args)})` : '';
    lines.push(`You chose: ${lastAction.action}${argsStr}`);
    lines.push(`Result: ${lastAction.status}`);
  } else {
    lines.push('None — this is your first turn.');
  }

  // --- World ---
  if (mapSize) {
    lines.push('');
    lines.push('[World]');
    lines.push(`The tavern is ${mapSize.width}x${mapSize.height} tiles.`);
  }

  return lines.join('\n');
}
