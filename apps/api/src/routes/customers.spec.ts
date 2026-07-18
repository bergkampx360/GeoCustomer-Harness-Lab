import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../db/client', () => ({
  prisma: {
    customer: {
      count: vi.fn().mockResolvedValue(15),
    },
  },
}));

import { buildApp } from '../app';
import { prisma } from '../db/client';

describe('GET /customers/count', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns the exact seeded count', async () => {
    app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/customers/count' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ count: 15 });
    expect(prisma.customer.count).toHaveBeenCalledTimes(1);
  });

  it('does not register POST on /customers/count', async () => {
    app = buildApp();

    const response = await app.inject({ method: 'POST', url: '/customers/count' });

    expect(response.statusCode).toBe(404);
  });
});
