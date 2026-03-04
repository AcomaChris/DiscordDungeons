import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// --- Auto-Setup Objects Output Tests ---
// Validates the generated .objects.json files produced by scripts/auto-setup-objects.js.
// Tests file existence, structure, preserved data, categories, and animation fields.

const OBJECT_DEFS_DIR = resolve(import.meta.dirname, '../../client/public/object-defs');

const EXPECTED_FILES = [
  'Animation_windows_doors.objects.json',
  'Exterior.objects.json',
  'Interior_1st_floor.objects.json',
  'Interior_2nd_floor.objects.json',
  'Walls_interior.objects.json',
  'Walls_street.objects.json',
];

let allData;
let validateObjectDef;

beforeAll(async () => {
  allData = {};
  for (const file of EXPECTED_FILES) {
    const path = resolve(OBJECT_DEFS_DIR, file);
    allData[file] = JSON.parse(readFileSync(path, 'utf-8'));
  }
  const schema = await import('../../client/src/map/object-def-schema.js');
  validateObjectDef = schema.validateObjectDef;
});

// --- File existence ---
describe('auto-setup-objects output — file existence', () => {
  it('all 6 object def files exist', () => {
    for (const file of EXPECTED_FILES) {
      const path = resolve(OBJECT_DEFS_DIR, file);
      expect(existsSync(path), `${file} should exist`).toBe(true);
    }
  });
});

// --- Top-level structure ---
describe('auto-setup-objects output — structure', () => {
  it('each file has version=1, tileset name, and objects map', () => {
    for (const [file, data] of Object.entries(allData)) {
      expect(data.version, `${file} version`).toBe(1);
      expect(typeof data.tileset, `${file} tileset`).toBe('string');
      expect(data.tileset.length, `${file} tileset non-empty`).toBeGreaterThan(0);
      expect(typeof data.objects, `${file} objects`).toBe('object');
      expect(data.objects, `${file} objects not null`).not.toBeNull();
    }
  });
});

// --- Interior_1st_floor: preserved objects ---
describe('auto-setup-objects output — Interior_1st_floor preservation', () => {
  it('large_table still exists with its original data', () => {
    const data = allData['Interior_1st_floor.objects.json'];
    const lt = data.objects.large_table;
    expect(lt).toBeDefined();
    expect(lt.id).toBe('large_table');
    expect(lt.name).toBe('Large Table');
    expect(lt.category).toBe('furniture');
    expect(lt.surface).toBe('wood');
    expect(lt.grid.cols).toBe(4);
    expect(lt.grid.rows).toBe(3);
    expect(lt.colliders.length).toBeGreaterThan(0);
    expect(lt.nodes.length).toBeGreaterThan(0);
  });
});

// --- Exterior: categories ---
describe('auto-setup-objects output — Exterior categories', () => {
  it('has objects with detected categories', () => {
    const data = allData['Exterior.objects.json'];
    const categories = new Set(Object.values(data.objects).map(o => o.category));
    // The auto-setup assigns categories; at minimum decoration and structure should appear
    expect(categories.has('decoration') || categories.has('furniture') || categories.has('structure')).toBe(true);
  });

  it('all objects have a valid category', () => {
    const validCategories = [
      'furniture', 'structure', 'container', 'decoration',
      'lighting', 'nature', 'effect',
    ];
    const data = allData['Exterior.objects.json'];
    for (const [id, obj] of Object.entries(data.objects)) {
      expect(validCategories, `${id} has valid category "${obj.category}"`).toContain(obj.category);
    }
  });
});

// --- Animation_windows_doors: animated objects ---
describe('auto-setup-objects output — Animation_windows_doors animations', () => {
  it('at least some objects have animation with startFrame and frames', () => {
    const data = allData['Animation_windows_doors.objects.json'];
    const animated = Object.values(data.objects).filter(o => o.animation);
    expect(animated.length).toBeGreaterThan(0);
    for (const obj of animated) {
      expect(obj.animation).toHaveProperty('startFrame');
      expect(obj.animation).toHaveProperty('frames');
      expect(typeof obj.animation.startFrame).toBe('number');
      expect(Array.isArray(obj.animation.frames)).toBe(true);
      expect(obj.animation.frames.length).toBeGreaterThan(0);
    }
  });

  it('animation frames have tiles mapping and duration', () => {
    const data = allData['Animation_windows_doors.objects.json'];
    const animated = Object.values(data.objects).filter(o => o.animation);
    for (const obj of animated) {
      for (const frame of obj.animation.frames) {
        expect(frame).toHaveProperty('tiles');
        expect(typeof frame.tiles).toBe('object');
        expect(frame.tiles).not.toBeNull();
        expect(frame).toHaveProperty('duration');
        expect(typeof frame.duration).toBe('number');
        expect(frame.duration).toBeGreaterThan(0);
      }
    }
  });

  it('frame tile values are valid numbers', () => {
    const data = allData['Animation_windows_doors.objects.json'];
    const animated = Object.values(data.objects).filter(o => o.animation);
    for (const obj of animated) {
      for (const frame of obj.animation.frames) {
        for (const [key, val] of Object.entries(frame.tiles)) {
          expect(typeof val, `tile value for key "${key}" in ${obj.id}`).toBe('number');
        }
      }
    }
  });
});

// --- Validation: all objects pass validateObjectDef ---
describe('auto-setup-objects output — schema validation', () => {
  for (const file of EXPECTED_FILES) {
    it(`all objects in ${file} pass validation`, () => {
      const data = allData[file];
      for (const [id, obj] of Object.entries(data.objects)) {
        const result = validateObjectDef(obj);
        expect(result.valid, `${file} → ${id}: ${result.errors.join(', ')}`).toBe(true);
      }
    });
  }
});
