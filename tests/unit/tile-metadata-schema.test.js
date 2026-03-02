import { describe, it, expect, beforeAll } from 'vitest';

// --- Tile Metadata Schema Unit Tests ---
// Tests defaults, enums, getTileProperties, and isDefaultTile.

let schema;

beforeAll(async () => {
  schema = await import('../../client/src/map/tile-metadata-schema.js');
});

describe('tile-metadata-schema', () => {
  describe('enums', () => {
    it('TILE_CATEGORIES contains expected values', () => {
      expect(schema.TILE_CATEGORIES).toContain('floor');
      expect(schema.TILE_CATEGORIES).toContain('wall');
      expect(schema.TILE_CATEGORIES).toContain('decor');
      expect(schema.TILE_CATEGORIES).toContain('obstacle');
      expect(schema.TILE_CATEGORIES).toContain('ceiling');
      expect(schema.TILE_CATEGORIES).toContain('door');
      expect(schema.TILE_CATEGORIES).toContain('stairs');
      expect(schema.TILE_CATEGORIES).toHaveLength(7);
    });

    it('TILE_COLLISIONS contains expected values', () => {
      expect(schema.TILE_COLLISIONS).toEqual(['none', 'solid', 'platform']);
    });

    it('TILE_SURFACES contains expected values', () => {
      expect(schema.TILE_SURFACES).toContain('stone');
      expect(schema.TILE_SURFACES).toContain('wood');
      expect(schema.TILE_SURFACES).toContain('water');
      expect(schema.TILE_SURFACES).toHaveLength(7);
    });

    it('FOOTSTEP_SOUNDS contains expected values', () => {
      expect(schema.FOOTSTEP_SOUNDS).toContain('step_stone');
      expect(schema.FOOTSTEP_SOUNDS).toContain('step_wood');
      expect(schema.FOOTSTEP_SOUNDS).toHaveLength(7);
    });
  });

  describe('TILE_DEFAULTS', () => {
    it('has all expected keys', () => {
      const keys = Object.keys(schema.TILE_DEFAULTS);
      expect(keys).toContain('category');
      expect(keys).toContain('collision');
      expect(keys).toContain('surface');
      expect(keys).toContain('elevationHint');
      expect(keys).toContain('lightEmission');
      expect(keys).toContain('footstepSound');
      expect(keys).toContain('walkable');
      expect(keys).toContain('transparency');
      expect(keys).toContain('zLayerOverride');
      expect(keys).toHaveLength(9);
    });

    it('has correct default values', () => {
      expect(schema.TILE_DEFAULTS.category).toBe('floor');
      expect(schema.TILE_DEFAULTS.collision).toBe('none');
      expect(schema.TILE_DEFAULTS.surface).toBe('stone');
      expect(schema.TILE_DEFAULTS.elevationHint).toBe(0);
      expect(schema.TILE_DEFAULTS.lightEmission).toBe(0);
      expect(schema.TILE_DEFAULTS.footstepSound).toBe('step_stone');
      expect(schema.TILE_DEFAULTS.walkable).toBe(true);
      expect(schema.TILE_DEFAULTS.transparency).toBe(0);
      expect(schema.TILE_DEFAULTS.zLayerOverride).toBeNull();
    });
  });

  describe('getTileProperties', () => {
    it('returns defaults for missing tile', () => {
      const metadata = { tiles: {} };
      const props = schema.getTileProperties(metadata, 42);
      expect(props).toEqual(schema.TILE_DEFAULTS);
    });

    it('returns defaults when metadata has no tiles field', () => {
      const props = schema.getTileProperties({}, 0);
      expect(props).toEqual(schema.TILE_DEFAULTS);
    });

    it('merges overrides with defaults', () => {
      const metadata = {
        tiles: {
          '5': { category: 'wall', collision: 'solid' },
        },
      };
      const props = schema.getTileProperties(metadata, 5);
      expect(props.category).toBe('wall');
      expect(props.collision).toBe('solid');
      // Other fields should be defaults
      expect(props.surface).toBe('stone');
      expect(props.walkable).toBe(true);
      expect(props.zLayerOverride).toBeNull();
    });

    it('returns a new object each time (no reference sharing)', () => {
      const metadata = { tiles: { '0': { category: 'wall' } } };
      const a = schema.getTileProperties(metadata, 0);
      const b = schema.getTileProperties(metadata, 0);
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('isDefaultTile', () => {
    it('returns true for exact default values', () => {
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS })).toBe(true);
    });

    it('returns false when any property differs', () => {
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS, category: 'wall' })).toBe(false);
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS, collision: 'solid' })).toBe(false);
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS, walkable: false })).toBe(false);
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS, elevationHint: 1 })).toBe(false);
    });

    it('treats null and undefined as equivalent for zLayerOverride', () => {
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS, zLayerOverride: null })).toBe(true);
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS, zLayerOverride: undefined })).toBe(true);
    });

    it('returns false for non-null zLayerOverride', () => {
      expect(schema.isDefaultTile({ ...schema.TILE_DEFAULTS, zLayerOverride: 'above' })).toBe(false);
    });
  });
});
