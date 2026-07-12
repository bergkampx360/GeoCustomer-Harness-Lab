import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeTown } from './geocode.js';

describe('geocodeTown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a known city regardless of casing/whitespace/diacritics', () => {
    const coordinates = geocodeTown('  KRAKÓW ');

    expect(coordinates).toEqual({ lat: 50.0647, lon: 19.945 });
  });

  it('returns null, logs a warning, and does not throw for an unknown city', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => geocodeTown('Nowhereville')).not.toThrow();

    const result = geocodeTown('Nowhereville');

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });
});
