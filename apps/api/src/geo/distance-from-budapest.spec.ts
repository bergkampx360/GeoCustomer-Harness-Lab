import { describe, expect, it } from 'vitest';
import { distanceFromBudapestKm } from './distance-from-budapest.js';
import { TOWN_REFERENCE } from './town-reference.js';

describe('distanceFromBudapestKm', () => {
  it('returns null when lat is null', () => {
    expect(distanceFromBudapestKm(null, 16.3738)).toBeNull();
  });

  it('returns null when lon is null', () => {
    expect(distanceFromBudapestKm(48.2082, null)).toBeNull();
  });

  it('returns null when both coordinates are null', () => {
    expect(distanceFromBudapestKm(null, null)).toBeNull();
  });

  it('returns 0 for Budapest itself', () => {
    expect(distanceFromBudapestKm(47.4979, 19.0402)).toBe(0);
  });

  it('returns the raw, unrounded distance for a known city', () => {
    const vienna = TOWN_REFERENCE.get('vienna');
    if (!vienna) throw new Error('expected vienna reference coordinates');

    const distance = distanceFromBudapestKm(vienna.lat, vienna.lon);

    expect(distance).not.toBeNull();
    expect(distance).toBeGreaterThan(210);
    expect(distance).toBeLessThan(218);
    // Proves this is the raw value, not something already rounded to 1 decimal.
    expect(distance).not.toBe(Math.round((distance ?? 0) * 10) / 10);
  });
});
