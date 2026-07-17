import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from './db/client';
import { normalizeSettlementName } from './geo/normalize';
import { SETTLEMENT_COORDINATES } from './geo/settlement-coordinates';

interface SeedCustomer {
  name: string;
  budget?: number;
  location: { city: string; countryCode: string };
  note?: string;
}

// apps/api/src -> apps/api -> apps -> repo root -> data/seed-customers.json
const SEED_FILE_PATH = resolve(__dirname, '../../../data/seed-customers.json');

async function seed(): Promise<void> {
  const raw = readFileSync(SEED_FILE_PATH, 'utf-8');
  const customers: SeedCustomer[] = JSON.parse(raw);

  for (const customer of customers) {
    const normalizedCity = normalizeSettlementName(customer.location.city);
    const coordinates = SETTLEMENT_COORDINATES.get(normalizedCity);

    if (!coordinates) {
      console.warn(
        `[seed] settlement not found, skipping geocode: "${customer.location.city}"`
      );
    }

    await prisma.customer.upsert({
      where: {
        name_telepules_countryCode: {
          name: customer.name,
          telepules: customer.location.city,
          countryCode: customer.location.countryCode,
        },
      },
      create: {
        name: customer.name,
        telepules: customer.location.city,
        countryCode: customer.location.countryCode,
        lat: coordinates?.lat ?? null,
        lon: coordinates?.lon ?? null,
        budget: customer.budget ?? null,
        note: customer.note ?? null,
      },
      update: {
        lat: coordinates?.lat ?? null,
        lon: coordinates?.lon ?? null,
        budget: customer.budget ?? null,
        note: customer.note ?? null,
      },
    });
  }

  console.log(`[seed] processed ${customers.length} customers`);
}

seed()
  .catch((err) => {
    console.error('[seed] fatal error', err);
    process.exitCode = 1;
  })
  .finally(() =>
    prisma.$disconnect().catch((err) => {
      console.error('[seed] error disconnecting Prisma client', err);
      process.exitCode = 1;
    })
  );
