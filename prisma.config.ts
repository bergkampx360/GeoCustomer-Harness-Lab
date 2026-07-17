import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` only parses the schema to emit a client — it never opens a
// connection — so a placeholder keeps it reproducible on a fresh install with no
// .env file. Commands that do connect (`migrate dev`, `migrate deploy`) fail with
// Postgres's own connection error if DATABASE_URL was never really set.
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
  },
  datasource: {
    url: DATABASE_URL,
  },
});
