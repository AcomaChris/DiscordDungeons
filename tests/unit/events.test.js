import { describe, it, expect } from 'vitest';
import * as Events from '../../client/src/core/Events.js';

describe('Event constants', () => {
  it('all exported values are non-empty strings', () => {
    for (const [key, value] of Object.entries(Events)) {
      expect(typeof value, `${key} should be a string`).toBe('string');
      expect(value.length, `${key} should not be empty`).toBeGreaterThan(0);
    }
  });

  it('all event names are unique', () => {
    const values = Object.values(Events);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
