import { BUDAPEST_COORDINATES } from './town-reference.js';
import { haversineKm } from './haversine.js';

/**
 * Raw, unrounded distance in km from Budapest for a given coordinate pair.
 * Returns null when either coordinate is unknown — never throws.
 * Rounding is a display concern and must happen at the HTTP response layer,
 * not here.
 */
export function distanceFromBudapestKm(
  lat: number | null,
  lon: number | null,
): number | null {
  if (lat === null || lon === null) {
    return null;
  }

  return haversineKm(BUDAPEST_COORDINATES.lat, BUDAPEST_COORDINATES.lon, lat, lon);
}
