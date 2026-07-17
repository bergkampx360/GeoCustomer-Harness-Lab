import { describe, expect, it } from 'vitest';
import { normalizeSettlementName } from './normalize';
import { SETTLEMENT_COORDINATES } from './settlement-coordinates';

describe('SETTLEMENT_COORDINATES', () => {
  it('resolves Budapest to the capital coordinates', () => {
    expect(SETTLEMENT_COORDINATES.get(normalizeSettlementName('Budapest'))).toEqual({
      lat: 47.4979,
      lon: 19.0402,
    });
  });

  it('resolves a Budapest district ("kerület") alias to the same capital coordinates', () => {
    expect(SETTLEMENT_COORDINATES.get(normalizeSettlementName('XI. kerület'))).toEqual({
      lat: 47.4979,
      lon: 19.0402,
    });
    expect(SETTLEMENT_COORDINATES.get(normalizeSettlementName('Budapest V'))).toEqual({
      lat: 47.4979,
      lon: 19.0402,
    });
  });

  it('returns undefined for a settlement absent from the bundled reference (miss-and-continue branch)', () => {
    expect(SETTLEMENT_COORDINATES.get(normalizeSettlementName('Atlantis-on-Sea'))).toBeUndefined();
  });
});
