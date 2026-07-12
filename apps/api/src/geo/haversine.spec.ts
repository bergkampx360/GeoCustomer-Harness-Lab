import { describe, expect, it } from 'vitest';
import { haversineKm } from './haversine.js';
import { BUDAPEST_COORDINATES, TOWN_REFERENCE } from './town-reference.js';

describe('haversineKm', () => {
  it('computes the known Budapest-Vienna distance (~214 km)', () => {
    const vienna = TOWN_REFERENCE.get('vienna');
    if (!vienna) throw new Error('expected vienna reference coordinates');

    const distance = haversineKm(
      BUDAPEST_COORDINATES.lat,
      BUDAPEST_COORDINATES.lon,
      vienna.lat,
      vienna.lon,
    );

    expect(distance).toBeGreaterThan(210);
    expect(distance).toBeLessThan(218);
  });

  it('returns 0 for the same point (Budapest to Budapest)', () => {
    const distance = haversineKm(
      BUDAPEST_COORDINATES.lat,
      BUDAPEST_COORDINATES.lon,
      BUDAPEST_COORDINATES.lat,
      BUDAPEST_COORDINATES.lon,
    );

    expect(distance).toBe(0);
  });
});
