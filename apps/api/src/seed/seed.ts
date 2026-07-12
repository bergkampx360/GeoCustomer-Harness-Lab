import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geocodeTown } from '../geo/geocode.js';
import { prisma } from '../prisma-client.js';

interface SeedCustomer {
  name: string;
  budget?: number;
  location: { city: string; countryCode: string };
  note?: string;
}

/** Minimal, explicit runtime shape check — the seed file is external input. */
function isSeedCustomer(value: unknown): value is SeedCustomer {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  if (typeof record['name'] !== 'string') {
    return false;
  }
  if (record['budget'] !== undefined && typeof record['budget'] !== 'number') {
    return false;
  }
  if (record['note'] !== undefined && typeof record['note'] !== 'string') {
    return false;
  }

  const location = record['location'];
  if (typeof location !== 'object' || location === null) {
    return false;
  }
  const locationRecord = location as Record<string, unknown>;

  return (
    typeof locationRecord['city'] === 'string' &&
    typeof locationRecord['countryCode'] === 'string'
  );
}

function loadSeedCustomers(seedFilePath: string): SeedCustomer[] {
  const raw = readFileSync(seedFilePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`seed file did not contain a JSON array: ${seedFilePath}`);
  }

  return parsed.map((entry, index) => {
    if (!isSeedCustomer(entry)) {
      throw new Error(`seed entry at index ${index} does not match the expected shape`);
    }
    return entry;
  });
}

async function upsertCustomer(customer: SeedCustomer): Promise<void> {
  // An unknown town is not an error: geocodeTown logs a warning and
  // returns null, and we continue with null coordinates for this row.
  const coordinates = geocodeTown(customer.location.city);

  await prisma.customer.upsert({
    where: {
      naturalKey: {
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

async function main(): Promise<void> {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const seedFilePath = path.resolve(moduleDir, '../../../../data/seed-customers.json');

  const seedCustomers = loadSeedCustomers(seedFilePath);

  for (const customer of seedCustomers) {
    await upsertCustomer(customer);
  }

  console.log(`seed: upserted ${seedCustomers.length} customers from ${seedFilePath}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error('seed: fatal error while seeding customers', error);
    await prisma.$disconnect();
    process.exit(1);
  });
