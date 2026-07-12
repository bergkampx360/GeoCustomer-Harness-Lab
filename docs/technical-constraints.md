# GeoCustomer Harness Lab – Technical Constraints

This document defines the mandatory technical constraints for this implementation.

## Runtime and language

- Node.js LTS
- TypeScript
- TypeScript strict mode must be enabled
- pnpm must be used as the package manager

## Repository structure

- The project must use an Nx monorepo
- The monorepo structure must remain small and appropriate for the project
- Avoid unnecessary packages, layers, abstractions and infrastructure
- Do not create a frontend application

## API

- Use Fastify
- Expose only the following REST endpoints:
  - `GET /customers/count`
  - `GET /customers/by-distance`
- Do not add `POST`, `PUT`, `PATCH` or `DELETE` endpoints
- The seed process must run separately from the HTTP API
- Do not implement authentication or authorization
- Do not make runtime LLM calls
- Do not call external geocoding APIs

## Database

- Use PostgreSQL
- PostgreSQL must run locally through Docker Compose
- Use Prisma for:
  - schema definition
  - migrations
  - seed
  - typed database access
- The seed must be executed through a dedicated command
- The seed must not be exposed as an HTTP endpoint

## Testing

- Use Vitest
- The Haversine distance calculation must have unit tests
- The tests must cover:
  - a known distance, such as Budapest to Vienna
  - a zero-distance case
  - null-coordinate handling
- Additional focused tests may be added when they provide clear value

## Seed data

The seed file is located at:

`data/seed-customers.json`

The original seed data must not be modified.

## Development process

- Use small, focused commits
- Verify each meaningful milestone before committing
- Do not hide, ignore or bypass failures
- Do not weaken tests merely to make them pass
- Do not commit secrets
- Do not commit the real `.env` file
- Provide an `.env.example` file when environment variables are required

## PostgreSQL MCP

- PostgreSQL MCP must be configured
- It must be used during development
- It must be used to inspect:
  - the database schema
  - the `customers` table
  - the seeded row count
  - sample seeded customer data
- Creating only an MCP configuration file does not count as using the MCP
- Secrets and local credentials used by the MCP must not be committed

## Scope control

Do not add:

- frontend
- authentication
- authorization
- CRUD endpoints
- message queues
- event sourcing
- CQRS
- Kubernetes
- cloud deployment
- PostGIS
- external geocoding services
- runtime AI integration

The implementation should remain intentionally small and focused on the project specification.
