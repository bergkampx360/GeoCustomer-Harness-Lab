import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';

export async function customerRoutes(app: FastifyInstance) {
  app.get('/customers/count', async () => {
    const count = await prisma.customer.count();
    return { count };
  });
}
