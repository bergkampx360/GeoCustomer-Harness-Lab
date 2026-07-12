import Fastify from 'fastify';
import { customerRoutes } from './routes/customers.js';
import { prisma } from './prisma-client.js';

const host = process.env['HOST'] ?? '127.0.0.1';
const port = Number(process.env['PORT'] ?? 3000);

const app = Fastify({ logger: true });

app.register(customerRoutes);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info(`received ${signal}, shutting down`);
  try {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

app
  .listen({ host, port })
  .then((address) => {
    app.log.info(`geocustomer api listening at ${address}`);
  })
  .catch(async (err) => {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
