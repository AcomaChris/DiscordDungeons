import { describe, it, expect, beforeAll } from 'vitest';

// --- Object Definition Schema Unit Tests ---
// Tests enums, defaults, validateObjectDef, and lookup helpers.

let schema;

beforeAll(async () => {
  schema = await import('../../client/src/map/object-def-schema.js');
});

// --- Minimal valid object for reuse in tests ---
function makeValidObject(overrides = {}) {
  return {
    id: 'test_object',
    name: 'Test Object',
    category: 'decoration',
    surface: 'wood',
    grid: { cols: 2, rows: 1, tiles: [[0, 1]] },
    ...overrides,
  };
}

describe('object-def-schema', () => {
  // --- Enums ---
  describe('enums', () => {
    it('OBJECT_CATEGORIES has expected values', () => {
      expect(schema.OBJECT_CATEGORIES).toContain('furniture');
      expect(schema.OBJECT_CATEGORIES).toContain('structure');
      expect(schema.OBJECT_CATEGORIES).toContain('container');
      expect(schema.OBJECT_CATEGORIES).toContain('decoration');
      expect(schema.OBJECT_CATEGORIES).toContain('lighting');
      expect(schema.OBJECT_CATEGORIES).toContain('nature');
      expect(schema.OBJECT_CATEGORIES).toContain('effect');
      expect(schema.OBJECT_CATEGORIES).toHaveLength(7);
    });

    it('COLLISION_SHAPES has expected values', () => {
      expect(schema.COLLISION_SHAPES).toEqual(['rect', 'ellipse']);
    });

    it('COLLISION_TYPES has expected values', () => {
      expect(schema.COLLISION_TYPES).toEqual(['solid', 'platform']);
    });

    it('NODE_TYPES has expected values', () => {
      expect(schema.NODE_TYPES).toContain('sit');
      expect(schema.NODE_TYPES).toContain('item_placement');
      expect(schema.NODE_TYPES).toContain('interact');
      expect(schema.NODE_TYPES).toContain('spawn');
      expect(schema.NODE_TYPES).toContain('attach');
      expect(schema.NODE_TYPES).toHaveLength(5);
    });

    it('DEPTH_MODES has expected values', () => {
      expect(schema.DEPTH_MODES).toEqual(['ysort', 'fixed']);
    });
  });

  // --- Defaults ---
  describe('OBJECT_DEFAULTS', () => {
    it('has all expected keys', () => {
      const keys = Object.keys(schema.OBJECT_DEFAULTS);
      expect(keys).toContain('category');
      expect(keys).toContain('tags');
      expect(keys).toContain('surface');
      expect(keys).toContain('colliders');
      expect(keys).toContain('nodes');
      expect(keys).toContain('parts');
      expect(keys).toContain('rendering');
      expect(keys).toContain('wfc');
      expect(keys).toContain('animation');
      expect(keys).toHaveLength(9);
    });

    it('has correct default values', () => {
      expect(schema.OBJECT_DEFAULTS.category).toBe('decoration');
      expect(schema.OBJECT_DEFAULTS.tags).toEqual([]);
      expect(schema.OBJECT_DEFAULTS.surface).toBe('stone');
      expect(schema.OBJECT_DEFAULTS.colliders).toEqual([]);
      expect(schema.OBJECT_DEFAULTS.nodes).toEqual([]);
      expect(schema.OBJECT_DEFAULTS.parts).toBeNull();
      expect(schema.OBJECT_DEFAULTS.rendering).toEqual({ layer: 'Walls', depthMode: 'ysort' });
      expect(schema.OBJECT_DEFAULTS.wfc).toBeNull();
      expect(schema.OBJECT_DEFAULTS.animation).toBeNull();
    });
  });

  // --- Validation: valid objects ---
  describe('validateObjectDef — valid', () => {
    it('accepts a minimal valid object', () => {
      const result = schema.validateObjectDef(makeValidObject());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts an object with colliders', () => {
      const result = schema.validateObjectDef(makeValidObject({
        colliders: [{
          id: 'body', shape: 'rect', type: 'solid',
          x: 0, y: 0, width: 32, height: 16, elevation: 0,
        }],
      }));
      expect(result.valid).toBe(true);
    });

    it('accepts an object with ellipse collider', () => {
      const result = schema.validateObjectDef(makeValidObject({
        colliders: [{
          id: 'body', shape: 'ellipse', type: 'platform',
          x: 2, y: 4, width: 28, height: 12, elevation: 1,
        }],
      }));
      expect(result.valid).toBe(true);
    });

    it('accepts an object with nodes', () => {
      const result = schema.validateObjectDef(makeValidObject({
        nodes: [{
          id: 'seat_1', type: 'sit', x: 8, y: 20, elevation: 0,
        }],
      }));
      expect(result.valid).toBe(true);
    });

    it('accepts an object with parts', () => {
      const result = schema.validateObjectDef(makeValidObject({
        grid: { cols: 3, rows: 1, tiles: [[0, 1, 2]] },
        parts: {
          layout: [['left', 'middle', 'right']],
          roles: {
            left: { required: true },
            middle: { required: false, repeatable: true, minRepeat: 0, maxRepeat: 4 },
            right: { required: true },
          },
        },
      }));
      expect(result.valid).toBe(true);
    });

    it('accepts all valid categories', () => {
      for (const cat of schema.OBJECT_CATEGORIES) {
        const result = schema.validateObjectDef(makeValidObject({ category: cat }));
        expect(result.valid).toBe(true);
      }
    });
  });

  // --- Validation: invalid objects ---
  describe('validateObjectDef — invalid', () => {
    it('rejects missing id', () => {
      const result = schema.validateObjectDef(makeValidObject({ id: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });

    it('rejects missing name', () => {
      const result = schema.validateObjectDef(makeValidObject({ name: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('rejects missing grid', () => {
      const result = schema.validateObjectDef(makeValidObject({ grid: undefined }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('grid'))).toBe(true);
    });

    it('rejects grid with wrong row count', () => {
      const result = schema.validateObjectDef(makeValidObject({
        grid: { cols: 2, rows: 2, tiles: [[0, 1]] },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('rows'))).toBe(true);
    });

    it('rejects grid with wrong col count', () => {
      const result = schema.validateObjectDef(makeValidObject({
        grid: { cols: 3, rows: 1, tiles: [[0, 1]] },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cols'))).toBe(true);
    });

    it('rejects invalid category', () => {
      const result = schema.validateObjectDef(makeValidObject({ category: 'bogus' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('category'))).toBe(true);
    });

    it('rejects collider with invalid shape', () => {
      const result = schema.validateObjectDef(makeValidObject({
        colliders: [{
          id: 'c1', shape: 'polygon', type: 'solid',
          x: 0, y: 0, width: 16, height: 16, elevation: 0,
        }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('shape'))).toBe(true);
    });

    it('rejects collider with invalid type', () => {
      const result = schema.validateObjectDef(makeValidObject({
        colliders: [{
          id: 'c1', shape: 'rect', type: 'none',
          x: 0, y: 0, width: 16, height: 16, elevation: 0,
        }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('rejects collider with zero width', () => {
      const result = schema.validateObjectDef(makeValidObject({
        colliders: [{
          id: 'c1', shape: 'rect', type: 'solid',
          x: 0, y: 0, width: 0, height: 16, elevation: 0,
        }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('width'))).toBe(true);
    });

    it('rejects collider with negative elevation', () => {
      const result = schema.validateObjectDef(makeValidObject({
        colliders: [{
          id: 'c1', shape: 'rect', type: 'solid',
          x: 0, y: 0, width: 16, height: 16, elevation: -1,
        }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('elevation'))).toBe(true);
    });

    it('rejects node with invalid type', () => {
      const result = schema.validateObjectDef(makeValidObject({
        nodes: [{ id: 'n1', type: 'fly', x: 0, y: 0 }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('rejects node referencing undefined partRole', () => {
      const result = schema.validateObjectDef(makeValidObject({
        parts: {
          layout: [['a', 'b']],
          roles: {
            a: { required: true },
            b: { required: true },
          },
        },
        nodes: [{ id: 'n1', type: 'sit', x: 0, y: 0, partRole: 'nonexistent' }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('partRole'))).toBe(true);
    });

    it('rejects parts.layout referencing undefined role', () => {
      const result = schema.validateObjectDef(makeValidObject({
        parts: {
          layout: [['a', 'missing_role']],
          roles: { a: { required: true } },
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('missing_role'))).toBe(true);
    });

    it('rejects parts.layout with wrong dimensions', () => {
      const result = schema.validateObjectDef(makeValidObject({
        grid: { cols: 2, rows: 1, tiles: [[0, 1]] },
        parts: {
          layout: [['a', 'b'], ['a', 'b']],
          roles: { a: { required: true }, b: { required: true } },
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('row count'))).toBe(true);
    });

    it('rejects repeatable role with minRepeat > maxRepeat', () => {
      const result = schema.validateObjectDef(makeValidObject({
        grid: { cols: 3, rows: 1, tiles: [[0, 1, 2]] },
        parts: {
          layout: [['a', 'b', 'c']],
          roles: {
            a: { required: true },
            b: { required: false, repeatable: true, minRepeat: 5, maxRepeat: 2 },
            c: { required: true },
          },
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('minRepeat'))).toBe(true);
    });

    it('rejects invalid rendering.depthMode', () => {
      const result = schema.validateObjectDef(makeValidObject({
        rendering: { layer: 'Walls', depthMode: 'zorder' },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('depthMode'))).toBe(true);
    });
  });

  // --- Lookup helpers ---
  describe('getObjectDef', () => {
    it('returns the object by id', () => {
      const file = { objects: { barrel: { id: 'barrel', name: 'Barrel' } } };
      expect(schema.getObjectDef(file, 'barrel')).toEqual({ id: 'barrel', name: 'Barrel' });
    });

    it('returns null for missing object', () => {
      const file = { objects: {} };
      expect(schema.getObjectDef(file, 'missing')).toBeNull();
    });

    it('returns null for null/undefined file', () => {
      expect(schema.getObjectDef(null, 'x')).toBeNull();
      expect(schema.getObjectDef(undefined, 'x')).toBeNull();
    });
  });

  describe('getObjectIds', () => {
    it('returns all object ids', () => {
      const file = { objects: { a: {}, b: {}, c: {} } };
      expect(schema.getObjectIds(file)).toEqual(['a', 'b', 'c']);
    });

    it('returns empty array for empty file', () => {
      expect(schema.getObjectIds({})).toEqual([]);
      expect(schema.getObjectIds(null)).toEqual([]);
    });
  });

  // --- Validation: components field ---
  describe('validateObjectDef — components', () => {
    it('accepts object with no components field', () => {
      const result = schema.validateObjectDef(makeValidObject());
      expect(result.valid).toBe(true);
    });

    it('accepts valid components array', () => {
      const result = schema.validateObjectDef(makeValidObject({
        components: [
          { id: 'door', isOpen: false },
          { id: 'interactable', promptText: 'Open' },
        ],
      }));
      expect(result.valid).toBe(true);
    });

    it('rejects non-array components', () => {
      const result = schema.validateObjectDef(makeValidObject({
        components: 'not-an-array',
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('components') && e.includes('array'))).toBe(true);
    });

    it('rejects component without id', () => {
      const result = schema.validateObjectDef(makeValidObject({
        components: [{ promptText: 'Open' }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('id') && e.includes('required'))).toBe(true);
    });

    it('rejects unknown component id', () => {
      const result = schema.validateObjectDef(makeValidObject({
        components: [{ id: 'nonexistent_comp' }],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('nonexistent_comp') && e.includes('not a known'))).toBe(true);
    });

    it('rejects duplicate component ids', () => {
      const result = schema.validateObjectDef(makeValidObject({
        components: [
          { id: 'door' },
          { id: 'door' },
        ],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('door') && e.includes('duplicated'))).toBe(true);
    });

    it('rejects non-object component entry', () => {
      const result = schema.validateObjectDef(makeValidObject({
        components: [null],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('components[0]') && e.includes('object'))).toBe(true);
    });
  });

  // --- Validation: animation field ---
  describe('validateObjectDef — animation', () => {
    it('accepts valid animation field', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: {
          startFrame: 0,
          frames: [
            { tiles: { '40': 40, '41': 41 }, duration: 150 },
            { tiles: { '40': 50, '41': 51 }, duration: 150 },
            { tiles: { '40': 60, '41': 61 }, duration: 150 },
          ],
        },
      }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects animation with empty frames array', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: { startFrame: 0, frames: [] },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('frames') && e.includes('non-empty'))).toBe(true);
    });

    it('rejects animation with negative startFrame', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: {
          startFrame: -1,
          frames: [
            { tiles: { '10': 10 }, duration: 100 },
          ],
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('startFrame'))).toBe(true);
    });

    it('rejects animation with startFrame >= frames.length', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: {
          startFrame: 2,
          frames: [
            { tiles: { '10': 10 }, duration: 100 },
            { tiles: { '10': 20 }, duration: 100 },
          ],
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('startFrame'))).toBe(true);
    });

    it('rejects frame with missing tiles object', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: {
          startFrame: 0,
          frames: [
            { tiles: null, duration: 100 },
          ],
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tiles') && e.includes('object'))).toBe(true);
    });

    it('rejects frame with non-number tile values', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: {
          startFrame: 0,
          frames: [
            { tiles: { '10': 'not_a_number' }, duration: 100 },
          ],
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('tiles') && e.includes('number'))).toBe(true);
    });

    it('rejects frame with non-positive duration', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: {
          startFrame: 0,
          frames: [
            { tiles: { '10': 10 }, duration: 0 },
          ],
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('duration'))).toBe(true);
    });

    it('rejects frames with inconsistent tile keys', () => {
      const result = schema.validateObjectDef(makeValidObject({
        animation: {
          startFrame: 0,
          frames: [
            { tiles: { '10': 10, '11': 11 }, duration: 100 },
            { tiles: { '10': 20, '12': 22 }, duration: 100 },
          ],
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('keys') && e.includes('match'))).toBe(true);
    });
  });
});
