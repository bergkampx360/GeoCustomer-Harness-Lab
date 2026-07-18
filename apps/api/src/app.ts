import Fastify from 'fastify';
import { customerRoutes } from './routes/customers';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.register(customerRoutes);
  return app;
}
