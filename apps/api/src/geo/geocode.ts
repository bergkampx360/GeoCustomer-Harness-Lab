import { normalizeTownName } from './normalize-town.js';
import { TOWN_REFERENCE, type Coordinates } from './town-reference.js';

/**
 * Resolves a town name to known coordinates using the bundled local
 * reference only (no external geocoding call). Matching is accent-,
 * case-, and whitespace-insensitive. An unresolved town is not an error:
 * it is logged and `null` is returned so callers can continue.
 */
export function geocodeTown(townName: string): Coordinates | null {
  const coordinates = TOWN_REFERENCE.get(normalizeTownName(townName));

  if (!coordinates) {
    console.warn(`geocode: no reference coordinates for town "${townName}"`);
    return null;
  }

  return coordinates;
}
