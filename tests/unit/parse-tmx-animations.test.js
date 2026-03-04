import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// --- TMX Animation Parser Output Tests ---
// Validates the generated .animations.json files produced by scripts/parse-tmx-animations.js.
// Tests the Animation_windows_doors tileset as the canonical complex animation sheet.

const METADATA_DIR = resolve(import.meta.dirname, '../../client/public/tile-metadata');
const ANIM_FILE = resolve(METADATA_DIR, 'Animation_windows_doors.animations.json');

let data;

beforeAll(() => {
  data = JSON.parse(readFileSync(ANIM_FILE, 'utf-8'));
});

describe('parse-tmx-animations output — Animation_windows_doors', () => {
  // --- File existence and top-level structure ---
  describe('file structure', () => {
    it('Animation_windows_doors.animations.json exists', () => {
      expect(existsSync(ANIM_FILE)).toBe(true);
    });

    it('has all required top-level fields', () => {
      expect(data).toHaveProperty('tileset');
      expect(data).toHaveProperty('columns');
      expect(data).toHaveProperty('banks');
      expect(data).toHaveProperty('animations');
      expect(data).toHaveProperty('families');
      expect(data).toHaveProperty('frameTiles');
    });

    it('columns = 40', () => {
      expect(data.columns).toBe(40);
    });

    it('banks has correct shape', () => {
      expect(data.banks).toEqual({ width: 10, count: 4 });
    });

    it('has 142 animation entries', () => {
      expect(Object.keys(data.animations)).toHaveLength(142);
    });

    it('each animation value is an array of {tileid, duration} objects', () => {
      for (const [, frames] of Object.entries(data.animations)) {
        expect(Array.isArray(frames)).toBe(true);
        expect(frames.length).toBeGreaterThan(0);
        for (const frame of frames) {
          expect(frame).toHaveProperty('tileid');
          expect(frame).toHaveProperty('duration');
          expect(typeof frame.tileid).toBe('number');
          expect(typeof frame.duration).toBe('number');
          expect(frame.duration).toBeGreaterThan(0);
        }
      }
    });
  });

  // --- Animation families ---
  describe('animation families', () => {
    it('each family is an array of tile indices', () => {
      for (const family of data.families) {
        expect(Array.isArray(family)).toBe(true);
        for (const tileId of family) {
          expect(typeof tileId).toBe('number');
        }
      }
    });

    it('family count matches animation count (142)', () => {
      expect(Object.keys(data.families)).toHaveLength(142);
    });
  });

  // --- Frame tiles ---
  describe('frame tiles', () => {
    it('frameTiles array is sorted', () => {
      const sorted = [...data.frameTiles].sort((a, b) => a - b);
      expect(data.frameTiles).toEqual(sorted);
    });

    it('no frame tile appears as a base tile ID (animation key)', () => {
      const baseTileIds = new Set(Object.keys(data.animations).map(Number));
      for (const ft of data.frameTiles) {
        expect(baseTileIds.has(ft)).toBe(false);
      }
    });
  });

  // --- Bank structure ---
  describe('bank structure', () => {
    it('all base tile IDs (animation keys) are in columns 0-9', () => {
      const baseTileIds = Object.keys(data.animations).map(Number);
      for (const id of baseTileIds) {
        const col = id % data.columns;
        expect(col).toBeLessThan(data.banks.width);
      }
    });

    it('all frame tiles are in columns 10-39', () => {
      for (const ft of data.frameTiles) {
        const col = ft % data.columns;
        expect(col).toBeGreaterThanOrEqual(data.banks.width);
      }
    });
  });
});
