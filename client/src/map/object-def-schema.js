// --- Object Definition Schema ---
// Defines multi-tile objects (furniture, structures, props) with collision,
// connectivity, nodes, and WFC data. Shared between editor tools and runtime.
// AGENT: Keep enums in sync with bootstrap-object-defs.js and any future editor.

import { COMPONENT_DEFS } from '../objects/ComponentDefs.js';

export const OBJECT_CATEGORIES = [
  'furniture', 'structure', 'container', 'decoration',
  'lighting', 'nature', 'effect',
];

export const COLLISION_SHAPES = ['rect', 'ellipse'];
export const COLLISION_TYPES = ['solid', 'platform'];

export const NODE_TYPES = [
  'sit', 'item_placement', 'interact', 'spawn', 'attach',
];

export const DEPTH_MODES = ['ysort', 'fixed'];

export const OBJECT_DEFAULTS = {
  category: 'decoration',
  tags: [],
  surface: 'stone',
  colliders: [],
  nodes: [],
  parts: null,
  rendering: { layer: 'Walls', depthMode: 'ysort' },
  wfc: null,
  animation: null,
};

// --- Validation ---

export function validateObjectDef(def) {
  const errors = [];

  if (!def.id || typeof def.id !== 'string') {
    errors.push('id is required and must be a string');
  }
  if (!def.name || typeof def.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  // --- Grid ---
  if (!def.grid || !Array.isArray(def.grid.tiles)) {
    errors.push('grid.tiles is required and must be a 2D array');
  } else {
    if (typeof def.grid.cols !== 'number' || def.grid.cols < 1) {
      errors.push('grid.cols must be a positive number');
    }
    if (typeof def.grid.rows !== 'number' || def.grid.rows < 1) {
      errors.push('grid.rows must be a positive number');
    }
    if (def.grid.tiles.length !== def.grid.rows) {
      errors.push(`grid.tiles has ${def.grid.tiles.length} rows but grid.rows is ${def.grid.rows}`);
    }
    for (let r = 0; r < def.grid.tiles.length; r++) {
      const row = def.grid.tiles[r];
      if (!Array.isArray(row)) {
        errors.push(`grid.tiles[${r}] must be an array`);
      } else if (row.length !== def.grid.cols) {
        errors.push(`grid.tiles[${r}] has ${row.length} cols but grid.cols is ${def.grid.cols}`);
      }
    }
  }

  // --- Category ---
  if (def.category && !OBJECT_CATEGORIES.includes(def.category)) {
    errors.push(`invalid category: ${def.category}`);
  }

  // --- Parts (optional) ---
  if (def.parts) {
    const { layout, roles } = def.parts;
    if (!layout || !roles) {
      errors.push('parts must have both layout and roles');
    } else {
      if (!Array.isArray(layout)) {
        errors.push('parts.layout must be a 2D array');
      } else {
        if (def.grid && layout.length !== def.grid.rows) {
          errors.push('parts.layout row count must match grid.rows');
        }
        for (let r = 0; r < layout.length; r++) {
          const row = layout[r];
          if (!Array.isArray(row)) {
            errors.push(`parts.layout[${r}] must be an array`);
          } else {
            if (def.grid && row.length !== def.grid.cols) {
              errors.push(`parts.layout[${r}] col count must match grid.cols`);
            }
            for (const role of row) {
              if (!roles[role]) {
                errors.push(`parts.layout references undefined role "${role}"`);
              }
            }
          }
        }
      }
      // Validate role definitions
      for (const [name, role] of Object.entries(roles)) {
        if (typeof role !== 'object' || role === null) {
          errors.push(`parts.roles["${name}"] must be an object`);
          continue;
        }
        if (typeof role.required !== 'boolean') {
          errors.push(`parts.roles["${name}"].required must be a boolean`);
        }
        if (role.repeatable) {
          if (typeof role.minRepeat !== 'number' || role.minRepeat < 0) {
            errors.push(`parts.roles["${name}"].minRepeat must be a non-negative number`);
          }
          if (typeof role.maxRepeat !== 'number' || role.maxRepeat < 1) {
            errors.push(`parts.roles["${name}"].maxRepeat must be a positive number`);
          }
          if (role.minRepeat > role.maxRepeat) {
            errors.push(`parts.roles["${name}"].minRepeat exceeds maxRepeat`);
          }
        }
      }
    }
  }

  // --- Colliders ---
  for (let i = 0; i < (def.colliders || []).length; i++) {
    const c = def.colliders[i];
    if (!c.id || typeof c.id !== 'string') {
      errors.push(`colliders[${i}].id is required`);
    }
    if (!COLLISION_SHAPES.includes(c.shape)) {
      errors.push(`colliders[${i}].shape must be one of: ${COLLISION_SHAPES.join(', ')}`);
    }
    if (!COLLISION_TYPES.includes(c.type)) {
      errors.push(`colliders[${i}].type must be one of: ${COLLISION_TYPES.join(', ')}`);
    }
    if (typeof c.x !== 'number' || typeof c.y !== 'number') {
      errors.push(`colliders[${i}] must have numeric x and y`);
    }
    if (typeof c.width !== 'number' || c.width <= 0) {
      errors.push(`colliders[${i}].width must be a positive number`);
    }
    if (typeof c.height !== 'number' || c.height <= 0) {
      errors.push(`colliders[${i}].height must be a positive number`);
    }
    if (typeof c.elevation !== 'number' || c.elevation < 0) {
      errors.push(`colliders[${i}].elevation must be a non-negative number`);
    }
  }

  // --- Nodes ---
  for (let i = 0; i < (def.nodes || []).length; i++) {
    const n = def.nodes[i];
    if (!n.id || typeof n.id !== 'string') {
      errors.push(`nodes[${i}].id is required`);
    }
    if (!NODE_TYPES.includes(n.type)) {
      errors.push(`nodes[${i}].type must be one of: ${NODE_TYPES.join(', ')}`);
    }
    if (typeof n.x !== 'number' || typeof n.y !== 'number') {
      errors.push(`nodes[${i}] must have numeric x and y`);
    }
    // Validate partRole references parts.roles if parts exist
    if (n.partRole && def.parts?.roles && !def.parts.roles[n.partRole]) {
      errors.push(`nodes[${i}].partRole references undefined role "${n.partRole}"`);
    }
  }

  // --- Rendering ---
  if (def.rendering) {
    if (def.rendering.depthMode && !DEPTH_MODES.includes(def.rendering.depthMode)) {
      errors.push(`rendering.depthMode must be one of: ${DEPTH_MODES.join(', ')}`);
    }
  }

  // --- Components (optional) ---
  if (def.components != null) {
    if (!Array.isArray(def.components)) {
      errors.push('components must be an array');
    } else {
      const seen = new Set();
      for (let i = 0; i < def.components.length; i++) {
        const comp = def.components[i];
        if (!comp || typeof comp !== 'object') {
          errors.push(`components[${i}] must be an object`);
          continue;
        }
        if (!comp.id || typeof comp.id !== 'string') {
          errors.push(`components[${i}].id is required and must be a string`);
          continue;
        }
        if (!COMPONENT_DEFS[comp.id]) {
          errors.push(`components[${i}].id "${comp.id}" is not a known component type`);
        }
        if (seen.has(comp.id)) {
          errors.push(`components[${i}].id "${comp.id}" is duplicated`);
        }
        seen.add(comp.id);
      }
    }
  }

  // --- Animation (optional) ---
  if (def.animation != null) {
    const anim = def.animation;
    if (!Array.isArray(anim.frames) || anim.frames.length === 0) {
      errors.push('animation.frames must be a non-empty array');
    } else {
      if (typeof anim.startFrame !== 'number' || !Number.isInteger(anim.startFrame)
          || anim.startFrame < 0 || anim.startFrame >= anim.frames.length) {
        errors.push(`animation.startFrame must be a non-negative integer less than frames.length (${anim.frames.length})`);
      }

      // Collect tile keys from each frame to verify consistency across frames
      let referenceKeys = null;
      for (let i = 0; i < anim.frames.length; i++) {
        const frame = anim.frames[i];
        if (typeof frame.tiles !== 'object' || frame.tiles === null || Array.isArray(frame.tiles)) {
          errors.push(`animation.frames[${i}].tiles must be an object`);
          continue;
        }
        const keys = Object.keys(frame.tiles).sort();
        for (const key of keys) {
          if (typeof frame.tiles[key] !== 'number') {
            errors.push(`animation.frames[${i}].tiles["${key}"] must be a number`);
          }
        }
        if (typeof frame.duration !== 'number' || frame.duration <= 0) {
          errors.push(`animation.frames[${i}].duration must be a positive number`);
        }
        if (referenceKeys === null) {
          referenceKeys = keys;
        } else if (keys.join(',') !== referenceKeys.join(',')) {
          errors.push(`animation.frames[${i}].tiles keys [${keys}] must match frame 0 keys [${referenceKeys}]`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// --- Lookup Helpers ---

export function getObjectDef(defsFile, objectId) {
  return defsFile?.objects?.[objectId] || null;
}

export function getObjectIds(defsFile) {
  return Object.keys(defsFile?.objects || {});
}
