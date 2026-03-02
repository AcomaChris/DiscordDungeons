// --- generateMetadata.js ---
// Step 5: Generate tile metadata JSON from AI identifications.
// Merges with existing metadata, preserving manually-tagged tiles.

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

// AGENT: These must match tile-metadata-schema.js. We duplicate them here
// to avoid import issues (schema uses ESM exports, scripts run as ESM but
// may reference different paths).
const TILE_DEFAULTS = {
  category: 'floor',
  collision: 'none',
  surface: 'stone',
  elevationHint: 0,
  lightEmission: 0,
  footstepSound: 'step_stone',
  walkable: true,
  transparency: 0,
  zLayerOverride: null,
};

const VALID_CATEGORIES = ['floor', 'wall', 'decor', 'obstacle', 'ceiling', 'door', 'stairs'];
const VALID_COLLISIONS = ['none', 'solid', 'platform'];
const VALID_SURFACES = ['stone', 'wood', 'water', 'grass', 'carpet', 'metal', 'dirt'];

export async function generateMetadata(ctx) {
  const step3Dir = join(ctx.outputBase, 'step3');
  const step4Dir = join(ctx.outputBase, 'step4');

  // Read inputs
  const groups = readJSON(join(step3Dir, 'groups.json'), 'step 3');
  const identifications = readJSON(join(step4Dir, 'identifications.json'), 'step 4');
  const info = readJSON(join(ctx.outputBase, 'step2', 'info.json'), 'step 2');

  // Build group lookup
  const idMap = new Map();
  for (const ident of identifications) {
    idMap.set(ident.groupId, ident);
  }

  // Read existing metadata (if any)
  const metadataPath = join(ctx.ROOT, 'client/public/tile-metadata', `${ctx.tilesetName}.json`);
  let metadata;
  if (existsSync(metadataPath)) {
    metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    console.log(`  Loaded existing metadata: ${Object.keys(metadata.tiles).length} tiles tagged`);
  } else {
    metadata = {
      tileset: ctx.tilesetName,
      image: `tilesets/${ctx.tilesetName}.png`,
      tileSize: info.tileSize,
      columns: info.columns,
      rows: info.rows,
      tileCount: info.tileCount || info.columns * info.rows,
      version: 1,
      tiles: {},
    };
    console.log('  Creating new metadata file');
  }

  // --- Map identifications to individual tiles ---
  let added = 0;
  let skipped = 0;

  for (const group of groups) {
    const ident = idMap.get(group.id);
    if (!ident) continue;

    // Build tile properties from identification
    const props = {};
    if (ident.category && VALID_CATEGORIES.includes(ident.category)) {
      props.category = ident.category;
    }
    if (ident.collision && VALID_COLLISIONS.includes(ident.collision)) {
      props.collision = ident.collision;
    }
    if (ident.surface && VALID_SURFACES.includes(ident.surface)) {
      props.surface = ident.surface;
    }

    // Map footstep sound from surface
    if (props.surface) {
      props.footstepSound = `step_${props.surface}`;
    }

    // Set walkable based on collision
    if (props.collision === 'solid') {
      props.walkable = false;
    }

    // Only store non-default properties (sparse format)
    const sparse = {};
    for (const [key, val] of Object.entries(props)) {
      if (val !== TILE_DEFAULTS[key]) {
        sparse[key] = val;
      }
    }

    // Apply to all tiles in the group
    for (const tileIdx of group.tiles) {
      const key = String(tileIdx);
      // Preserve existing manual tags
      if (metadata.tiles[key]) {
        skipped++;
        continue;
      }

      // Only add if there's at least one non-default property
      if (Object.keys(sparse).length > 0) {
        metadata.tiles[key] = { ...sparse };
        added++;
      }
    }
  }

  // Write output
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  console.log(`  Added ${added} tile entries, skipped ${skipped} (already tagged)`);
  console.log(`  Total tiles tagged: ${Object.keys(metadata.tiles).length}`);
  console.log(`  Saved: ${metadataPath}`);
}

function readJSON(path, stepName) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    console.error(`Cannot read ${path}. Run ${stepName} first.`);
    process.exit(1);
  }
}
