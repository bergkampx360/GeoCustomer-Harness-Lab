import 'dotenv/config';
import { buildApp } from './app';
import { prisma } from './db/client';

const app = buildApp();

// The server process owns the shared Prisma client's lifecycle, not buildApp() —
// that keeps buildApp() safe to call more than once per process (e.g. from tests).
app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

async function start() {
  try {
    // A real query, not $connect() — with driver adapters, $connect() alone never
    // opens the underlying pool connection. This doubles as a fail-fast boot check.
    await prisma.customer.count();
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    try {
      await app.close();
    } catch (closeErr) {
      app.log.error(closeErr);
    }
    process.exit(1);
  }
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info(`Received ${signal}, shutting down...`);
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

start();
