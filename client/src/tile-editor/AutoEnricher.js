// --- AutoEnricher ---
// Browser-side port of scripts/enrich-object-defs.js enrichment logic.
// Auto-enriches object definitions with WFC edges, parts, and interaction nodes.
// All functions are pure — no file I/O, no side effects beyond mutating the passed object.

const TILE_SIZE = 16;

// --- Tag Helpers ---

export function hasTags(obj, ...tags) {
  const allTags = (obj.tags || []).concat([obj.id, obj.name || ''].map(s => s.toLowerCase()));
  const text = allTags.join(' ') + ' ' + (obj.description || '').toLowerCase();
  return tags.some(t => text.includes(t));
}

// --- WFC Edge Refinement ---
// AGENT: Socket names must match _sockets.json.

const BOOTSTRAP_DEFAULTS = {
  furniture: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  structure: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  decoration: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  container: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  lighting: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  nature: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
  effect: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
};

function edgesAreBootstrapDefault(obj) {
  if (!obj.wfc || !obj.wfc.edges) return true;
  const defaults = BOOTSTRAP_DEFAULTS[obj.category] || BOOTSTRAP_DEFAULTS.decoration;
  return Object.entries(defaults).every(([dir, val]) => obj.wfc.edges[dir] === val);
}

export function enrichEdges(obj) {
  if (!obj.wfc) return false;
  if (!edgesAreBootstrapDefault(obj)) return false;

  const is1x1 = obj.grid.cols === 1 && obj.grid.rows === 1;

  // Wall-mounted structures (shelves, bookshelves)
  if (obj.category === 'structure' && hasTags(obj, 'shelf', 'bookshelf', 'wall_shelf')) {
    obj.wfc.edges = { north: 'wall_face', south: 'open_floor', east: 'wall_face', west: 'wall_face' };
    obj.wfc.clearance = { north: 0, south: 1, east: 0, west: 0 };
    return true;
  }

  // Other wall-mounted structures (pillars, arches, windows, doors)
  if (obj.category === 'structure' && hasTags(obj, 'wall', 'pillar', 'arch', 'window', 'door', 'beam')) {
    obj.wfc.edges = { north: 'wall_face', south: 'open_floor', east: 'wall_face', west: 'wall_face' };
    return true;
  }

  // Counter objects
  if (hasTags(obj, 'counter', 'bar_counter')) {
    obj.wfc.edges = { north: 'counter_mid', south: 'counter_mid', east: 'counter_end', west: 'counter_end' };
    obj.wfc.clearance = { north: 1, south: 2, east: 1, west: 1 };
    return true;
  }

  // Stairs
  if (hasTags(obj, 'stair', 'staircase')) {
    obj.wfc.edges = { north: 'wall_face', south: 'stair_entry', east: 'wall_face', west: 'wall_face' };
    return true;
  }

  // Nature (plants, mushrooms, rocks)
  if (hasTags(obj, 'plant', 'mushroom', 'rock', 'nature')) {
    obj.wfc.edges = { north: 'nature_edge', south: 'nature_edge', east: 'nature_edge', west: 'nature_edge' };
    return true;
  }

  // Wall decorations (shields, mounted items)
  if (obj.id.startsWith('wall_') || hasTags(obj, 'wall_shield', 'wall_mounted')) {
    obj.wfc.edges = { north: 'wall_face', south: 'open_floor', east: 'open_floor', west: 'open_floor' };
    return true;
  }

  // 1×1 decorations — keep open_floor
  if (is1x1 && obj.category === 'decoration') {
    return false;
  }

  // Freestanding furniture
  if (obj.category === 'furniture' || obj.category === 'container' ||
      hasTags(obj, 'table', 'bench', 'chair', 'stool', 'sofa', 'barrel')) {
    obj.wfc.edges = { north: 'furniture_edge', south: 'furniture_edge', east: 'furniture_edge', west: 'furniture_edge' };
    if (hasTags(obj, 'table', 'bench', 'sofa')) {
      obj.wfc.clearance = { north: 1, south: 2, east: 1, west: 1 };
    }
    return true;
  }

  return false;
}

// --- Parts Detection ---

function hasNullsInGrid(obj) {
  for (const row of obj.grid.tiles) {
    for (const tile of row) {
      if (tile === null) return true;
    }
  }
  return false;
}

export function enrichParts(obj) {
  if (obj.parts) return false;
  if (obj.grid.cols < 3) return false;
  if (hasNullsInGrid(obj)) return false;

  const isStretchable = hasTags(obj, 'table', 'bench', 'counter', 'shelf', 'bookshelf');
  if (!isStretchable) return false;

  if (hasTags(obj, 'round', 'sofa', 'stair', 'corner', 'water', 'pool')) return false;

  const { cols, rows } = obj.grid;

  const layout = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      if (c === 0) row.push('left_end');
      else if (c === cols - 1) row.push('right_end');
      else row.push('middle');
    }
    layout.push(row);
  }

  obj.parts = {
    layout,
    roles: {
      left_end: { required: true },
      middle: { required: false, repeatable: true, minRepeat: 0, maxRepeat: 4 },
      right_end: { required: true },
    },
  };

  return true;
}

// --- Node Generation ---

export function enrichNodes(obj) {
  if (obj.nodes && obj.nodes.length > 0) return false;

  const pixelW = obj.grid.cols * TILE_SIZE;
  const pixelH = obj.grid.rows * TILE_SIZE;
  const centerX = Math.floor(pixelW / 2);
  const centerY = Math.floor(pixelH / 2);
  const nodes = [];

  // Tables — item placement on surface + sit nodes below
  if (hasTags(obj, 'table') && obj.category === 'furniture') {
    nodes.push({ id: 'items_center', type: 'item_placement', x: centerX, y: Math.floor(pixelH / 3), elevation: 1 });
    if (obj.grid.cols >= 2) {
      nodes.push({ id: 'sit_south_left', type: 'sit', x: Math.floor(TILE_SIZE / 2), y: pixelH + 8, elevation: 0, facing: 'up' });
      nodes.push({ id: 'sit_south_right', type: 'sit', x: pixelW - Math.floor(TILE_SIZE / 2), y: pixelH + 8, elevation: 0, facing: 'up' });
    }
    obj.nodes = nodes;
    return true;
  }

  // Chairs/stools — sit node
  if (hasTags(obj, 'chair', 'stool') && !hasTags(obj, 'table')) {
    nodes.push({ id: 'sit_1', type: 'sit', x: centerX, y: centerY, elevation: 0 });
    obj.nodes = nodes;
    return true;
  }

  // Containers (barrels, chests) — interact node
  if (obj.category === 'container' || hasTags(obj, 'barrel', 'chest')) {
    nodes.push({ id: 'interact_1', type: 'interact', x: centerX, y: pixelH - 4, elevation: 0 });
    obj.nodes = nodes;
    return true;
  }

  // Bookshelves
  if (hasTags(obj, 'bookshelf')) {
    nodes.push({ id: 'interact_1', type: 'interact', x: centerX, y: pixelH, elevation: 0 });
    obj.nodes = nodes;
    return true;
  }

  // Counters — item placement along top
  if (hasTags(obj, 'counter')) {
    for (let i = 0; i < obj.grid.cols; i++) {
      nodes.push({
        id: `serve_${i + 1}`,
        type: 'item_placement',
        x: i * TILE_SIZE + Math.floor(TILE_SIZE / 2),
        y: 4,
        elevation: 1,
        partRole: i === 0 ? 'left_end' : i === obj.grid.cols - 1 ? 'right_end' : 'middle',
      });
    }
    obj.nodes = nodes;
    return true;
  }

  // Doors
  if (hasTags(obj, 'door')) {
    nodes.push({ id: 'interact_1', type: 'interact', x: centerX, y: pixelH - 4, elevation: 0 });
    obj.nodes = nodes;
    return true;
  }

  // Sofas/benches — sit nodes along length
  if (hasTags(obj, 'sofa', 'bench')) {
    for (let i = 0; i < obj.grid.cols; i++) {
      nodes.push({
        id: `sit_${i + 1}`,
        type: 'sit',
        x: i * TILE_SIZE + Math.floor(TILE_SIZE / 2),
        y: centerY,
        elevation: 0,
        facing: 'down',
      });
    }
    obj.nodes = nodes;
    return true;
  }

  return false;
}

// --- Enrich All ---

// Run all enrichment passes on a set of object definitions.
// Returns a summary of changes made.
export function enrichAll(objectDefs) {
  let edgeChanges = 0;
  let partsChanges = 0;
  let nodeChanges = 0;

  for (const obj of Object.values(objectDefs)) {
    if (enrichEdges(obj)) edgeChanges++;
    if (enrichParts(obj)) partsChanges++;
    if (enrichNodes(obj)) nodeChanges++;
  }

  return { edgeChanges, partsChanges, nodeChanges };
}
