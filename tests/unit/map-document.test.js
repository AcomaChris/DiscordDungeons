import { describe, it, expect, vi } from 'vitest';
import { MapDocument, ALL_LAYER_NAMES, LAYER_GROUPS } from '../../client/src/map-editor/MapDocument.js';

describe('MapDocument', () => {
  describe('constructor', () => {
    it('creates all tile layers', () => {
      const doc = new MapDocument();
      for (const name of ALL_LAYER_NAMES) {
        expect(doc.getLayer(name)).not.toBeNull();
        expect(doc.getLayer(name).name).toBe(name);
      }
    });

    it('starts with empty objects and tilesets', () => {
      const doc = new MapDocument();
      expect(doc.tilesets).toHaveLength(0);
      expect(doc.objects).toHaveLength(0);
    });
  });

  describe('tilesets', () => {
    it('addTileset assigns firstgid 1 to first tileset', () => {
      const doc = new MapDocument();
      const ts = doc.addTileset({ name: 'walls', tileCount: 100, columns: 10, rows: 10 });
      expect(ts.firstgid).toBe(1);
    });

    it('addTileset chains firstgid for subsequent tilesets', () => {
      const doc = new MapDocument();
      doc.addTileset({ name: 'walls', tileCount: 100, columns: 10, rows: 10 });
      const ts2 = doc.addTileset({ name: 'floor', tileCount: 50, columns: 5, rows: 10 });
      expect(ts2.firstgid).toBe(101);
    });

    it('removeTileset recomputes firstgids', () => {
      const doc = new MapDocument();
      doc.addTileset({ name: 'a', tileCount: 10 });
      doc.addTileset({ name: 'b', tileCount: 20 });
      doc.addTileset({ name: 'c', tileCount: 30 });

      doc.removeTileset('b');
      expect(doc.tilesets).toHaveLength(2);
      expect(doc.tilesets[0].firstgid).toBe(1);  // a
      expect(doc.tilesets[1].firstgid).toBe(11);  // c (was 31, now 11 = 1+10)
    });

    it('getTilesetByName finds tileset', () => {
      const doc = new MapDocument();
      doc.addTileset({ name: 'walls', tileCount: 100 });
      expect(doc.getTilesetByName('walls')).not.toBeNull();
      expect(doc.getTilesetByName('nonexistent')).toBeNull();
    });

    it('resolveGid finds correct tileset and localId', () => {
      const doc = new MapDocument();
      doc.addTileset({ name: 'a', tileCount: 10 });  // gids 1-10
      doc.addTileset({ name: 'b', tileCount: 20 });  // gids 11-30

      const r1 = doc.resolveGid(5);
      expect(r1.tileset.name).toBe('a');
      expect(r1.localId).toBe(4); // 5 - 1

      const r2 = doc.resolveGid(15);
      expect(r2.tileset.name).toBe('b');
      expect(r2.localId).toBe(4); // 15 - 11

      expect(doc.resolveGid(0)).toBeNull();
      expect(doc.resolveGid(-1)).toBeNull();
    });
  });

  describe('objects', () => {
    it('addObject assigns auto-incrementing IDs', () => {
      const doc = new MapDocument();
      const o1 = doc.addObject({ name: 'spawn', type: 'spawn', x: 0, y: 0 });
      const o2 = doc.addObject({ name: 'door', type: 'door', x: 10, y: 20 });
      expect(o1.id).toBe(1);
      expect(o2.id).toBe(2);
    });

    it('addObject preserves explicit IDs and updates counter', () => {
      const doc = new MapDocument();
      doc.addObject({ id: 50, name: 'spawn', type: 'spawn', x: 0, y: 0 });
      const o2 = doc.addObject({ name: 'door', type: 'door', x: 10, y: 20 });
      expect(o2.id).toBe(51);
    });

    it('removeObject removes by ID', () => {
      const doc = new MapDocument();
      doc.addObject({ name: 'a', type: 'spawn', x: 0, y: 0 });
      doc.addObject({ name: 'b', type: 'spawn', x: 0, y: 0 });
      expect(doc.objects).toHaveLength(2);

      doc.removeObject(1);
      expect(doc.objects).toHaveLength(1);
      expect(doc.objects[0].name).toBe('b');
    });

    it('getObjectById finds object', () => {
      const doc = new MapDocument();
      doc.addObject({ name: 'spawn', type: 'spawn', x: 0, y: 0 });
      expect(doc.getObjectById(1)).not.toBeNull();
      expect(doc.getObjectById(999)).toBeNull();
    });
  });

  describe('getGlobalBounds', () => {
    it('returns default for empty document', () => {
      const doc = new MapDocument();
      expect(doc.getGlobalBounds()).toEqual({ minX: 0, minY: 0, width: 1, height: 1 });
    });

    it('computes bounds from tiles', () => {
      const doc = new MapDocument();
      doc.getLayer('Ground').set(2, 3, 1);
      doc.getLayer('Ground').set(5, 7, 1);
      const b = doc.getGlobalBounds();
      expect(b.minX).toBe(2);
      expect(b.minY).toBe(3);
      expect(b.width).toBe(4);  // 5-2+1
      expect(b.height).toBe(5); // 7-3+1
    });

    it('includes objects in bounds', () => {
      const doc = new MapDocument();
      doc.addObject({ name: 'spawn', type: 'spawn', x: 160, y: 160, width: 16, height: 16 });
      const b = doc.getGlobalBounds();
      expect(b.minX).toBe(10); // 160/16
      expect(b.minY).toBe(10);
    });
  });

  describe('reset', () => {
    it('clears everything', () => {
      const doc = new MapDocument();
      doc.addTileset({ name: 'walls', tileCount: 10 });
      doc.addObject({ name: 'spawn', type: 'spawn', x: 0, y: 0 });
      doc.getLayer('Ground').set(0, 0, 5);

      doc.reset();
      expect(doc.tilesets).toHaveLength(0);
      expect(doc.objects).toHaveLength(0);
      expect(doc.getLayer('Ground').size).toBe(0);
    });
  });

  describe('listeners', () => {
    it('notifies on changes', () => {
      const doc = new MapDocument();
      const cb = vi.fn();
      doc.addListener(cb);

      doc.addTileset({ name: 'a', tileCount: 10 });
      expect(cb).toHaveBeenCalledTimes(1);

      doc.addObject({ name: 'spawn', type: 'spawn', x: 0, y: 0 });
      expect(cb).toHaveBeenCalledTimes(2);
    });

    it('removeListener stops notifications', () => {
      const doc = new MapDocument();
      const cb = vi.fn();
      doc.addListener(cb);
      doc.removeListener(cb);
      doc.addTileset({ name: 'a', tileCount: 10 });
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('autoPopulateCollision', () => {
    it('marks tiles with collision:solid metadata', () => {
      const doc = new MapDocument();
      doc.addTileset({
        name: 'walls', tileCount: 16, columns: 4, rows: 4,
        metadata: {
          tiles: {
            '0': { collision: 'solid' },
            '1': { collision: 'none' },
            '2': { collision: 'solid' },
          },
        },
      });

      // Place tiles: GID 1 = localId 0 (solid), GID 2 = localId 1 (none), GID 3 = localId 2 (solid)
      doc.getLayer('Ground').set(0, 0, 1);
      doc.getLayer('Ground').set(1, 0, 2);
      doc.getLayer('Walls').set(2, 0, 3);

      const count = doc.autoPopulateCollision();
      const collision = doc.getLayer('Collision');

      expect(count).toBe(2);
      expect(collision.get(0, 0)).toBe(1);  // solid
      expect(collision.get(1, 0)).toBe(0);  // not solid
      expect(collision.get(2, 0)).toBe(1);  // solid
    });

    it('clears existing collision data first', () => {
      const doc = new MapDocument();
      doc.addTileset({
        name: 'test', tileCount: 16, columns: 4, rows: 4,
        metadata: { tiles: {} },
      });

      doc.getLayer('Collision').set(5, 5, 1);
      doc.autoPopulateCollision();

      expect(doc.getLayer('Collision').get(5, 5)).toBe(0);
    });

    it('returns 0 when no tiles have collision metadata', () => {
      const doc = new MapDocument();
      doc.addTileset({
        name: 'test', tileCount: 16, columns: 4, rows: 4,
        metadata: { tiles: { '0': { collision: 'none' } } },
      });
      doc.getLayer('Ground').set(0, 0, 1);

      expect(doc.autoPopulateCollision()).toBe(0);
    });

    it('returns 0 when tileset has no metadata', () => {
      const doc = new MapDocument();
      doc.addTileset({ name: 'test', tileCount: 16, columns: 4, rows: 4 });
      doc.getLayer('Ground').set(0, 0, 1);

      expect(doc.autoPopulateCollision()).toBe(0);
    });
  });

  describe('layer groups', () => {
    it('LAYER_GROUPS covers all tile layers except Objects', () => {
      const grouped = Object.values(LAYER_GROUPS).flat();
      for (const name of ALL_LAYER_NAMES) {
        expect(grouped).toContain(name);
      }
    });
  });
});
