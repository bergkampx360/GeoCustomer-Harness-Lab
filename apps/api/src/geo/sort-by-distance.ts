import { distanceFromBudapestKm } from './distance-from-budapest.js';
import { nameCollator } from './name-collator.js';

export interface DistanceSortable {
  name: string;
  lat: number | null;
  lon: number | null;
}

export type WithDistanceKm<T> = T & { distanceKm: number | null };

/**
 * Sorts items ascending by their raw, unrounded distance from Budapest.
 * Items with unknown coordinates (`distanceKm: null`) sort last. Ties are
 * broken deterministically via the shared name collator. Rounding is
 * intentionally not performed here — callers round only when building the
 * HTTP response, so sorting always operates on true distances.
 */
export function sortByDistanceFromBudapest<T extends DistanceSortable>(
  items: readonly T[],
): Array<WithDistanceKm<T>> {
  const withDistance: Array<WithDistanceKm<T>> = items.map((item) => ({
    ...item,
    distanceKm: distanceFromBudapestKm(item.lat, item.lon),
  }));

  return withDistance.sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) {
      return nameCollator.compare(a.name, b.name);
    }
    if (a.distanceKm === null) {
      return 1;
    }
    if (b.distanceKm === null) {
      return -1;
    }
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    return nameCollator.compare(a.name, b.name);
  });
}
