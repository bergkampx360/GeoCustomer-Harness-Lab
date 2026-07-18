# GeoCustomer Harness Lab

A small, offline REST service over PostgreSQL that exposes the seeded customer
list's total count and its ranking by distance from Budapest. Built with
Fastify, Prisma, and PostgreSQL in a single-project Nx/pnpm monorepo
(`apps/api`). No frontend, no authentication, no external network calls at
runtime.

For the full design record (architecture spine, specification, epics), see
`_bmad-output/planning-artifacts/`.

## Prerequisites

- Node.js `>=24 <25` (see `package.json` → `engines`)
- pnpm
- Docker (with Docker Compose v2 — the `docker compose` subcommand)
- Optional, only if you want to use the PostgreSQL MCP tool locally: `uv`/`uvx`
  (Python), used to run `postgres-mcp` per the committed `.mcp.json`

## Setup and run sequence

Run these steps in order from the repository root.

### 1. Clone and enter the repository

```sh
git clone https://github.com/bergkampx360/GeoCustomer-Harness-Lab.git
cd GeoCustomer-Harness-Lab
```

### 2. Configure environment variables

Copy the placeholder template to `.env` and adjust values only if needed
(the defaults work out of the box):

```sh
cp .env.example .env
```

`.env` is git-ignored and must never be committed. Only `.env.example`
(placeholder values only) is tracked in git.

### 3. Install dependencies

```sh
pnpm install
```

This also runs `prisma generate` automatically via the `postinstall` script.

### 4. Start PostgreSQL

```sh
docker compose up -d
```

Starts a single `postgres:16-alpine` container (service `postgres` in
`docker-compose.yml`), using the credentials and port from `.env`. Data
persists in the named volume `postgres-data` across restarts. Confirm it's
healthy with:

```sh
docker compose ps
```

### 5. Apply the database migration

```sh
pnpm exec prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

This applies the already-committed migration
(`apps/api/prisma/migrations/20260716160812_init`) to create the `customers`
table. **Always use `prisma migrate deploy` here, never `prisma migrate
dev`** — `migrate deploy` only applies existing, committed migrations and
never creates or modifies one; `migrate dev` is a development-time authoring
command that can generate new migration files and is not part of this
run sequence.

### 6. Run the seed

```sh
npx nx run api:seed
```

Loads `data/seed-customers.json` (15 customers), offline-geocodes each
settlement against a bundled reference, and upserts the rows. The seed is
idempotent — running it again leaves exactly the same 15 rows, no
duplicates.

### 7. Start the API server

```sh
npx nx run api:serve
```

Starts the Fastify server on `http://localhost:3000`. Leave this running in
its own terminal; use `Ctrl+C` to stop it (the server disconnects Prisma
cleanly on `SIGINT`/`SIGTERM`).

### 8. Verify the endpoints

In another terminal:

```sh
curl http://localhost:3000/customers/count
```

Expected: `{"count":15}`

```sh
curl http://localhost:3000/customers/by-distance
```

Expected: a JSON array of all 15 customers, ascending by distance from
Budapest. Each item has a `distanceKm` field (a number rounded to one
decimal, or `null` if the customer's settlement could not be resolved).
Budapest customers appear first with `distanceKm: 0`; unresolved-location
customers appear last with `distanceKm: null`.

### 9. Run the tests

```sh
pnpm exec vitest run
```

Runs the full test suite (pure domain/geo unit tests plus the Fastify route
tests), with no live database required.

## Optional: PostgreSQL MCP

This repository includes a project-scoped `.mcp.json` that launches
`postgres-mcp` (via `uvx postgres-mcp --access-mode=restricted`, read-only)
and reads `DATABASE_URL` from your environment — no connection string is
inlined in the file. If your MCP client (e.g. Claude Code) supports
project-scoped MCP servers, it picks this up automatically once `.env` is
populated and `docker compose up -d` is running; no further setup is
required. To smoke-test it manually instead:

```sh
uvx postgres-mcp --access-mode=restricted
```

## Shutdown and cleanup

Stop the API server with `Ctrl+C` in its terminal, then stop the database:

```sh
docker compose down
```

This stops and removes the `postgres` container but **preserves the named
volume** (`postgres-data`), so your seeded data is still there next time you
run `docker compose up -d`. To also delete the volume (and all seeded data
with it), run `docker compose down -v` instead — only do this if you
intentionally want a fully clean database on the next start.
