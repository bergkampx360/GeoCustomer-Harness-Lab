import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { sortByDistance } from '../domain/sort';
import { BUDAPEST } from '../geo/settlement-coordinates';

export async function customerRoutes(app: FastifyInstance) {
  app.get('/customers/count', async () => {
    const count = await prisma.customer.count();
    return { count };
  });

  app.get('/customers/by-distance', async () => {
    const customers = await prisma.customer.findMany();
    const sorted = sortByDistance(customers, BUDAPEST);

    return sorted.map(({ rawDistanceKm, countryCode, ...rest }) => ({
      ...rest,
      distanceKm: rawDistanceKm === null ? null : Math.round(rawDistanceKm * 10) / 10,
    }));
  });
}
