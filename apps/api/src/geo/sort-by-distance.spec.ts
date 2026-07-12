import { describe, expect, it } from 'vitest';
import { sortByDistanceFromBudapest } from './sort-by-distance.js';

describe('sortByDistanceFromBudapest', () => {
  it('sorts unknown-coordinate items last, after all known distances', () => {
    const result = sortByDistanceFromBudapest([
      { name: 'Unknown Customer', lat: null, lon: null },
      { name: 'Far Customer', lat: 55.6761, lon: 12.5683 },
      { name: 'Budapest Customer', lat: 47.4979, lon: 19.0402 },
    ]);

    expect(result.map((r) => r.name)).toEqual([
      'Budapest Customer',
      'Far Customer',
      'Unknown Customer',
    ]);
    expect(result[2].distanceKm).toBeNull();
  });

  it('breaks ties between equal distances deterministically by name', () => {
    const result = sortByDistanceFromBudapest([
      { name: 'Zsofia', lat: 47.4979, lon: 19.0402 },
      { name: 'Ábel', lat: 47.4979, lon: 19.0402 },
      { name: 'Bela', lat: 47.4979, lon: 19.0402 },
    ]);

    // All three are at the exact same point (distanceKm 0), so the order
    // must come entirely from the shared, explicit Intl.Collator.
    expect(result.every((r) => r.distanceKm === 0)).toBe(true);
    expect(result.map((r) => r.name)).toEqual(['Ábel', 'Bela', 'Zsofia']);
  });

  it('sorts by raw distance, not the value it would round to', () => {
    // Both raw distances round to the same displayed value (10.0 km), but
    // their true order is reversed from what alphabetical tie-breaking
    // would produce — proving sorting happens before any rounding.
    const result = sortByDistanceFromBudapest([
      { name: 'Alice', lat: 47.58819188923424, lon: 19.0402 }, // raw ~10.04 km
      { name: 'Zoe', lat: 47.58747243194951, lon: 19.0402 }, // raw ~9.96 km
    ]);

    const [first, second] = result;

    expect(first.name).toBe('Zoe');
    expect(second.name).toBe('Alice');
    expect(first.distanceKm).not.toBeNull();
    expect(second.distanceKm).not.toBeNull();
    expect(first.distanceKm as number).toBeLessThan(second.distanceKm as number);

    // Confirm this was a genuine tie at the rounded level.
    const round1 = (value: number) => Math.round(value * 10) / 10;
    expect(round1(first.distanceKm as number)).toBe(round1(second.distanceKm as number));
  });
});
