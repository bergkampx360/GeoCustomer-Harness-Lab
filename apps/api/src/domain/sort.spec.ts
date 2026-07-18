import { describe, expect, it } from 'vitest';
import { BUDAPEST } from '../geo/settlement-coordinates';
import { sortByDistance } from './sort';

interface Fixture {
  name: string;
  lat: number | null;
  lon: number | null;
}

describe('sortByDistance', () => {
  it('sorts several customers nearest-first by ascending distance', () => {
    const customers: Fixture[] = [
      { name: 'Far', lat: 55.6761, lon: 12.5683 }, // Copenhagen
      { name: 'Near', lat: 48.2082, lon: 16.3738 }, // Vienna
      { name: 'Mid', lat: 50.0755, lon: 14.4378 }, // Prague
    ];

    const sorted = sortByDistance(customers, BUDAPEST);

    expect(sorted.map((c) => c.name)).toEqual(['Near', 'Mid', 'Far']);
  });

  it('places a Budapest customer first with rawDistanceKm 0', () => {
    const customers: Fixture[] = [
      { name: 'Elsewhere', lat: 48.2082, lon: 16.3738 },
      { name: 'BudapestCustomer', lat: BUDAPEST.lat, lon: BUDAPEST.lon },
    ];

    const sorted = sortByDistance(customers, BUDAPEST);

    expect(sorted[0].name).toBe('BudapestCustomer');
    expect(sorted[0].rawDistanceKm).toBe(0);
  });

  it('places unresolved-coordinate customers last, after every calculable one', () => {
    const customers: Fixture[] = [
      { name: 'Unresolved', lat: null, lon: null },
      { name: 'Resolved', lat: 48.2082, lon: 16.3738 },
    ];

    const sorted = sortByDistance(customers, BUDAPEST);

    expect(sorted.map((c) => c.name)).toEqual(['Resolved', 'Unresolved']);
    expect(sorted[1].rawDistanceKm).toBeNull();
  });

  it('breaks an exact raw-distance tie by name ascending', () => {
    const customers: Fixture[] = [
      { name: 'Zed', lat: 48.2082, lon: 16.3738 },
      { name: 'Anna', lat: 48.2082, lon: 16.3738 },
    ];

    const sorted = sortByDistance(customers, BUDAPEST);

    expect(sorted.map((c) => c.name)).toEqual(['Anna', 'Zed']);
    expect(sorted[0].rawDistanceKm).toBe(sorted[1].rawDistanceKm);
  });

  it('orders two null-coordinate customers by name (stable tie-break)', () => {
    const customers: Fixture[] = [
      { name: 'Zed', lat: null, lon: null },
      { name: 'Anna', lat: null, lon: null },
    ];

    const sorted = sortByDistance(customers, BUDAPEST);

    expect(sorted.map((c) => c.name)).toEqual(['Anna', 'Zed']);
  });

  it('M-1 regression: preserves raw-distance order when two raw distances round to the same distanceKm', () => {
    // Both points' raw Haversine distance from Budapest rounds to 60.3 km via
    // Math.round(x * 10) / 10 (~60.250 and ~60.325), but the raw values differ.
    // Names are reversed alphabetically from the expected order, so a naive
    // rounded-then-name-sorted implementation would misorder these.
    const nearer = { name: 'ZNearer', lat: BUDAPEST.lat, lon: BUDAPEST.lon + 0.802 };
    const farther = { name: 'AFarther', lat: BUDAPEST.lat, lon: BUDAPEST.lon + 0.803 };

    const sorted = sortByDistance([farther, nearer], BUDAPEST);

    expect(sorted.map((c) => Math.round((c.rawDistanceKm as number) * 10) / 10)).toEqual([60.3, 60.3]);
    expect(sorted[0].rawDistanceKm).toBeLessThan(sorted[1].rawDistanceKm as number);
    expect(sorted.map((c) => c.name)).toEqual([nearer.name, farther.name]);
  });
});
