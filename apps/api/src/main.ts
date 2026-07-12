import Fastify from 'fastify';

const host = process.env['HOST'] ?? '127.0.0.1';
const port = Number(process.env['PORT'] ?? 3000);

const app = Fastify({ logger: true });

app
  .listen({ host, port })
  .then((address) => {
    app.log.info(`geocustomer api listening at ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
