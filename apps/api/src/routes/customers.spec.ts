import { describe, expect, it } from 'vitest';
import { buildByDistanceResponse } from './customers.js';

describe('buildByDistanceResponse', () => {
  it('rounds distanceKm to one decimal in the response, without mutating sort order', () => {
    const result = buildByDistanceResponse([
      { id: 1, name: 'Vienna Customer', telepules: 'Vienna', lat: 48.2082, lon: 16.3738 },
      { id: 2, name: 'Anna Kovács', telepules: 'Budapest', lat: 47.4979, lon: 19.0402 },
    ]);

    expect(result[0]?.name).toBe('Anna Kovács');
    expect(result[0]?.distanceKm).toBe(0);
    expect(result[1]?.name).toBe('Vienna Customer');
    // Raw distance is ~214.05 km; response must show exactly one decimal.
    expect(result[1]?.distanceKm).toBe(Math.round((result[1]?.distanceKm ?? 0) * 10) / 10);
    expect(typeof result[1]?.distanceKm).toBe('number');
  });

  it('keeps unknown-coordinate customers as distanceKm: null, sorted last', () => {
    const result = buildByDistanceResponse([
      { id: 1, name: 'Unknown Customer', telepules: 'Nowhereville', lat: null, lon: null },
      { id: 2, name: 'Anna Kovács', telepules: 'Budapest', lat: 47.4979, lon: 19.0402 },
    ]);

    expect(result.map((r) => r.name)).toEqual(['Anna Kovács', 'Unknown Customer']);
    expect(result[1]?.distanceKm).toBeNull();
  });

  it('preserves all original customer fields alongside distanceKm', () => {
    const result = buildByDistanceResponse([
      {
        id: 7,
        name: 'Anna Kovács',
        telepules: 'Budapest',
        countryCode: 'HU',
        lat: 47.4979,
        lon: 19.0402,
        budget: 850,
        note: 'loves ficus',
      },
    ]);

    expect(result[0]).toEqual({
      id: 7,
      name: 'Anna Kovács',
      telepules: 'Budapest',
      countryCode: 'HU',
      lat: 47.4979,
      lon: 19.0402,
      budget: 850,
      note: 'loves ficus',
      distanceKm: 0,
    });
  });
});
