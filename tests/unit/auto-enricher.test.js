import { describe, it, expect } from 'vitest';
import {
  hasTags,
  enrichEdges,
  enrichParts,
  enrichNodes,
  enrichAll,
} from '../../client/src/tile-editor/AutoEnricher.js';

// --- Test Helpers ---

function makeObj(overrides = {}) {
  return {
    id: overrides.id || 'test_obj',
    name: overrides.name || 'Test Object',
    description: overrides.description || '',
    category: overrides.category || 'furniture',
    tags: overrides.tags || [],
    grid: overrides.grid || { cols: 2, rows: 2, tiles: [[0, 1], [2, 3]] },
    colliders: overrides.colliders || [],
    nodes: overrides.nodes || [],
    parts: overrides.parts || null,
    rendering: { layer: 'Walls', depthMode: 'ysort' },
    wfc: overrides.wfc || {
      edges: { north: 'open_floor', south: 'open_floor', east: 'open_floor', west: 'open_floor' },
      clearance: { north: 1, south: 1, east: 1, west: 1 },
      allowedFloors: ['stone', 'wood'],
      weight: 1,
    },
  };
}

describe('AutoEnricher', () => {
  describe('hasTags', () => {
    it('matches tags array', () => {
      const obj = makeObj({ tags: ['wood', 'table'] });
      expect(hasTags(obj, 'table')).toBe(true);
    });

    it('matches id', () => {
      const obj = makeObj({ id: 'bar_counter_end' });
      expect(hasTags(obj, 'counter')).toBe(true);
    });

    it('matches name', () => {
      const obj = makeObj({ name: 'Wooden Shelf' });
      expect(hasTags(obj, 'shelf')).toBe(true);
    });

    it('matches description', () => {
      const obj = makeObj({ description: 'A large bookshelf against the wall' });
      expect(hasTags(obj, 'bookshelf')).toBe(true);
    });

    it('returns false when no match', () => {
      const obj = makeObj({ tags: ['wood'] });
      expect(hasTags(obj, 'metal', 'stone')).toBe(false);
    });
  });

  describe('enrichEdges', () => {
    it('enriches wall-mounted shelf as wall_face', () => {
      const obj = makeObj({ category: 'structure', tags: ['shelf'] });
      expect(enrichEdges(obj)).toBe(true);
      expect(obj.wfc.edges.north).toBe('wall_face');
      expect(obj.wfc.edges.south).toBe('open_floor');
    });

    it('enriches counter with counter_mid/counter_end', () => {
      const obj = makeObj({ tags: ['counter'] });
      expect(enrichEdges(obj)).toBe(true);
      expect(obj.wfc.edges.north).toBe('counter_mid');
      expect(obj.wfc.edges.east).toBe('counter_end');
    });

    it('enriches nature with nature_edge', () => {
      const obj = makeObj({ tags: ['plant'] });
      expect(enrichEdges(obj)).toBe(true);
      expect(obj.wfc.edges.north).toBe('nature_edge');
    });

    it('enriches freestanding furniture with furniture_edge', () => {
      const obj = makeObj({ category: 'furniture', tags: ['table'] });
      expect(enrichEdges(obj)).toBe(true);
      expect(obj.wfc.edges.north).toBe('furniture_edge');
      // Tables get wider south clearance
      expect(obj.wfc.clearance.south).toBe(2);
    });

    it('skips objects with non-default edges', () => {
      const obj = makeObj();
      obj.wfc.edges.north = 'wall_face'; // manually set
      expect(enrichEdges(obj)).toBe(false);
    });

    it('skips objects without WFC', () => {
      const obj = makeObj();
      obj.wfc = null;
      expect(enrichEdges(obj)).toBe(false);
    });

    it('skips 1x1 decorations', () => {
      const obj = makeObj({
        category: 'decoration',
        grid: { cols: 1, rows: 1, tiles: [[5]] },
      });
      expect(enrichEdges(obj)).toBe(false);
    });
  });

  describe('enrichParts', () => {
    it('adds parts to wide table', () => {
      const obj = makeObj({
        tags: ['table'],
        grid: { cols: 4, rows: 1, tiles: [[0, 1, 2, 3]] },
      });
      expect(enrichParts(obj)).toBe(true);
      expect(obj.parts.roles.left_end).toBeDefined();
      expect(obj.parts.roles.middle.repeatable).toBe(true);
      expect(obj.parts.roles.right_end).toBeDefined();
      expect(obj.parts.layout[0]).toEqual(['left_end', 'middle', 'middle', 'right_end']);
    });

    it('skips narrow objects (< 3 cols)', () => {
      const obj = makeObj({
        tags: ['table'],
        grid: { cols: 2, rows: 1, tiles: [[0, 1]] },
      });
      expect(enrichParts(obj)).toBe(false);
    });

    it('skips non-stretchable types', () => {
      const obj = makeObj({
        tags: ['barrel'],
        grid: { cols: 3, rows: 1, tiles: [[0, 1, 2]] },
      });
      expect(enrichParts(obj)).toBe(false);
    });

    it('skips if parts already set', () => {
      const obj = makeObj({ tags: ['table'], grid: { cols: 3, rows: 1, tiles: [[0, 1, 2]] } });
      obj.parts = { roles: {}, layout: [] };
      expect(enrichParts(obj)).toBe(false);
    });

    it('skips grids with null tiles', () => {
      const obj = makeObj({
        tags: ['table'],
        grid: { cols: 3, rows: 1, tiles: [[0, null, 2]] },
      });
      expect(enrichParts(obj)).toBe(false);
    });
  });

  describe('enrichNodes', () => {
    it('adds sit+item nodes to table', () => {
      const obj = makeObj({ category: 'furniture', tags: ['table'] });
      expect(enrichNodes(obj)).toBe(true);
      expect(obj.nodes.length).toBeGreaterThan(0);
      expect(obj.nodes.some(n => n.type === 'item_placement')).toBe(true);
      expect(obj.nodes.some(n => n.type === 'sit')).toBe(true);
    });

    it('adds sit node to chair', () => {
      const obj = makeObj({
        category: 'furniture',
        tags: ['chair'],
        grid: { cols: 1, rows: 1, tiles: [[5]] },
      });
      expect(enrichNodes(obj)).toBe(true);
      expect(obj.nodes).toHaveLength(1);
      expect(obj.nodes[0].type).toBe('sit');
    });

    it('adds interact node to container', () => {
      const obj = makeObj({ category: 'container' });
      expect(enrichNodes(obj)).toBe(true);
      expect(obj.nodes[0].type).toBe('interact');
    });

    it('adds interact node to door', () => {
      const obj = makeObj({ tags: ['door'] });
      expect(enrichNodes(obj)).toBe(true);
      expect(obj.nodes[0].type).toBe('interact');
    });

    it('adds item_placement nodes to counter', () => {
      const obj = makeObj({
        tags: ['counter'],
        grid: { cols: 3, rows: 1, tiles: [[0, 1, 2]] },
      });
      expect(enrichNodes(obj)).toBe(true);
      expect(obj.nodes.every(n => n.type === 'item_placement')).toBe(true);
      expect(obj.nodes).toHaveLength(3);
    });

    it('adds sit nodes to bench', () => {
      const obj = makeObj({
        tags: ['bench'],
        grid: { cols: 3, rows: 1, tiles: [[0, 1, 2]] },
      });
      expect(enrichNodes(obj)).toBe(true);
      expect(obj.nodes.every(n => n.type === 'sit')).toBe(true);
    });

    it('skips if nodes already exist', () => {
      const obj = makeObj({ category: 'furniture', tags: ['table'] });
      obj.nodes = [{ id: 'existing', type: 'interact', x: 0, y: 0 }];
      expect(enrichNodes(obj)).toBe(false);
    });

    it('returns false for unrecognized types', () => {
      const obj = makeObj({ category: 'decoration', tags: ['flower'] });
      expect(enrichNodes(obj)).toBe(false);
    });
  });

  describe('enrichAll', () => {
    it('enriches multiple objects and returns summary', () => {
      const defs = {
        table1: makeObj({ id: 'table1', category: 'furniture', tags: ['table'] }),
        shelf1: makeObj({ id: 'shelf1', category: 'structure', tags: ['shelf'] }),
        deco1: makeObj({
          id: 'deco1',
          category: 'decoration',
          grid: { cols: 1, rows: 1, tiles: [[5]] },
        }),
      };

      const summary = enrichAll(defs);
      expect(summary.edgeChanges).toBeGreaterThan(0);
      expect(summary.nodeChanges).toBeGreaterThan(0);
    });
  });
});
