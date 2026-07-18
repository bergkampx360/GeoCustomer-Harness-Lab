import { describe, expect, it } from 'vitest';
import { BUDAPEST } from '../geo/settlement-coordinates';
import { haversineKm } from './distance';

const VIENNA = { lat: 48.2082, lon: 16.3738 };

describe('haversineKm', () => {
  it('returns approximately 214 km for Budapest to Vienna', () => {
    const result = haversineKm(BUDAPEST, VIENNA);

    expect(result).toBeGreaterThan(210);
    expect(result).toBeLessThan(218);
  });

  it('returns exactly 0 for Budapest to itself', () => {
    expect(haversineKm(BUDAPEST, BUDAPEST)).toBe(0);
  });

  it('returns null and does not throw when either coordinate is null', () => {
    expect(haversineKm(null, BUDAPEST)).toBeNull();
    expect(haversineKm(BUDAPEST, null)).toBeNull();
    expect(haversineKm(null, null)).toBeNull();
  });
});
