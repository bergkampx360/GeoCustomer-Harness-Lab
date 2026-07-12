import { describe, expect, it } from 'vitest';
import { normalizeTownName } from './normalize-town.js';

describe('normalizeTownName', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeTownName('  Budapest  ')).toBe('budapest');
  });

  it('is case-insensitive', () => {
    expect(normalizeTownName('BUDAPEST')).toBe('budapest');
    expect(normalizeTownName('budapest')).toBe('budapest');
  });

  it('is diacritic-insensitive', () => {
    expect(normalizeTownName('Kraków')).toBe('krakow');
  });

  it('produces the same result regardless of trimming, case, or diacritics', () => {
    expect(normalizeTownName('  KRAKÓW ')).toBe(normalizeTownName('krakow'));
  });
});
