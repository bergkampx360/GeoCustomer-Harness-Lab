import type { FastifyInstance } from 'fastify';
import { sortByDistanceFromBudapest, type DistanceSortable } from '../geo/sort-by-distance.js';
import { prisma } from '../prisma-client.js';

/** Rounding is a response-formatting concern; the geo module always sorts by raw distance. */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Pure, database-independent response shaping for GET /customers/by-distance:
 * sorts by raw distance (via the geo module) and rounds distanceKm to one
 * decimal only here, at response-build time.
 */
export function buildByDistanceResponse<T extends DistanceSortable>(customers: readonly T[]) {
  const sorted = sortByDistanceFromBudapest(customers);

  return sorted.map(({ distanceKm, ...customer }) => ({
    ...customer,
    distanceKm: distanceKm === null ? null : roundToOneDecimal(distanceKm),
  }));
}

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.get('/customers/count', async () => {
    const count = await prisma.customer.count();
    return { count };
  });

  app.get('/customers/by-distance', async () => {
    const customers = await prisma.customer.findMany();
    return buildByDistanceResponse(customers);
  });
}
