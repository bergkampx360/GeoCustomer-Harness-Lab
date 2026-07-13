# Technical Stack Constraints

## Runtime and language

- Node.js LTS.
- TypeScript, with strict mode enabled.
- pnpm as the package manager.

## Repository structure

- Nx monorepo.
- Keep the monorepo structure small and appropriate for the project's size.
- Avoid unnecessary packages, layers, abstractions, and infrastructure.
- No frontend application.

## API

- Fastify.
- Only `GET /customers/count` and `GET /customers/by-distance` (full contract in `api-contract.md`).
- No authentication or authorization.
- No runtime LLM calls; no external geocoding API calls — fully offline (cross-referenced in `data-and-seed.md`).

## Database

- PostgreSQL, run locally through Docker Compose.
- Prisma for: schema definition, migrations, seed, and typed database access.
- The seed runs through a dedicated command, separate from the HTTP API, never exposed as an endpoint.

## Testing

- Vitest (full requirements in `testing-requirements.md`).
