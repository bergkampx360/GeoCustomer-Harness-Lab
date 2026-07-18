import type { Coordinates } from '../geo/settlement-coordinates';
import { haversineKm } from './distance';

export function sortByDistance<T extends { name: string; lat: number | null; lon: number | null }>(
  customers: T[],
  reference: Coordinates,
): Array<T & { rawDistanceKm: number | null }> {
  const withDistance = customers.map((customer) => ({
    ...customer,
    rawDistanceKm: haversineKm(
      customer.lat !== null && customer.lon !== null ? { lat: customer.lat, lon: customer.lon } : null,
      reference,
    ),
  }));

  return withDistance.sort((a, b) => {
    if (a.rawDistanceKm === null && b.rawDistanceKm === null) {
      return a.name.localeCompare(b.name);
    }
    if (a.rawDistanceKm === null) {
      return 1;
    }
    if (b.rawDistanceKm === null) {
      return -1;
    }
    if (a.rawDistanceKm === b.rawDistanceKm) {
      return a.name.localeCompare(b.name);
    }
    return a.rawDistanceKm - b.rawDistanceKm;
  });
}
