import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('../db/client', () => ({
  prisma: {
    customer: {
      count: vi.fn().mockResolvedValue(15),
      findMany: vi.fn(),
    },
  },
}));

import { buildApp } from '../app';
import { prisma } from '../db/client';
import { BUDAPEST } from '../geo/settlement-coordinates';

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

describe('GET /customers/by-distance', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  const fixtureRows = [
    {
      id: 2,
      name: 'Vienna Customer',
      telepules: 'Vienna',
      lat: 48.2082,
      lon: 16.3738,
      countryCode: 'AT',
      budget: 2000,
      note: null,
    },
    {
      id: 1,
      name: 'Budapest Customer',
      telepules: 'Budapest',
      lat: BUDAPEST.lat,
      lon: BUDAPEST.lon,
      countryCode: 'HU',
      budget: 1000,
      note: 'vip',
    },
    {
      id: 3,
      name: 'Unresolved Customer',
      telepules: 'Nowhereville',
      lat: null,
      lon: null,
      countryCode: 'XX',
      budget: null,
      note: null,
    },
  ];

  it('returns customers ordered by ascending distance, Budapest first at 0, unresolved last at null, no countryCode', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue(fixtureRows);
    app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/customers/by-distance' });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.map((c: { name: string }) => c.name)).toEqual([
      'Budapest Customer',
      'Vienna Customer',
      'Unresolved Customer',
    ]);
    expect(body[0].distanceKm).toBe(0);
    expect(body[2].distanceKm).toBeNull();

    for (const item of body) {
      expect(item).not.toHaveProperty('countryCode');
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('telepules');
      expect(item).toHaveProperty('lat');
      expect(item).toHaveProperty('lon');
      expect(item).toHaveProperty('budget');
      expect(item).toHaveProperty('note');
      expect(item).toHaveProperty('distanceKm');
    }
  });

  it('rounds distanceKm to one decimal', async () => {
    vi.mocked(prisma.customer.findMany).mockResolvedValue(fixtureRows);
    app = buildApp();

    const response = await app.inject({ method: 'GET', url: '/customers/by-distance' });
    const body = response.json();
    const vienna = body.find((c: { name: string }) => c.name === 'Vienna Customer');

    expect(Number.isInteger(vienna.distanceKm * 10)).toBe(true);
  });

  it('does not register POST on /customers/by-distance', async () => {
    app = buildApp();

    const response = await app.inject({ method: 'POST', url: '/customers/by-distance' });

    expect(response.statusCode).toBe(404);
  });
});
