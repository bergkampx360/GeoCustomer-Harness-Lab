import { describe, expect, it } from 'vitest';
import { normalizeSettlementName } from './normalize';

describe('normalizeSettlementName', () => {
  it('strips accents, lowercases, and collapses surrounding/repeated whitespace', () => {
    expect(normalizeSettlementName('  Kraków  ')).toBe('krakow');
    expect(normalizeSettlementName('BUDAPEST')).toBe('budapest');
    expect(normalizeSettlementName('  Buda  pest  ')).toBe('buda pest');
  });

  it('leaves an already-normalized plain-ASCII input unchanged', () => {
    expect(normalizeSettlementName('vienna')).toBe('vienna');
  });
});
