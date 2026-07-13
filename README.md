# GeoCustomer Harness Lab

A small, offline, self-contained REST service over PostgreSQL. It idempotently seeds 15 customers with locally-resolved latitude/longitude (no external geocoding API, no runtime LLM calls), and exposes exactly two read-only endpoints:

- `GET /customers/count`
- `GET /customers/by-distance` — customers ordered by distance from Budapest

See `docs/assignment.md` and `docs/technical-constraints.md` for the full specification, and `docs/superpowers-implementation-plan.md` for the milestone-by-milestone implementation record.

## Prerequisites

- **Node.js**: a version satisfying `^20.19 || ^22.12 || >=24.0` (Prisma 7's supported range). This project was built and verified on Node v26.4.0.
- **pnpm**: `11.9.0` (declared in the root `package.json`'s `packageManager` field; run via Corepack or install that exact version).
- **Docker**: any Docker-Compose-compatible runtime (Docker Desktop, OrbStack, etc.) — used only to run PostgreSQL locally.
- **Claude Code**: only required if you want to use the project-scoped PostgreSQL MCP server during development (schema/data inspection). Not required to build, migrate, seed, run, or test the project.

## Setup and run, in order

All commands are run from the repository root.

### 1. Install dependencies

```bash
pnpm install
```

pnpm may ask you to approve native build scripts for `nx`, `esbuild`, `prisma`, and `@prisma/engines` the first time — these are legitimate postinstall steps (binary downloads), not arbitrary code execution from untrusted sources.

### 2. Create your local `.env`

```bash
cp .env.example .env
```

The defaults in `.env.example` match `docker-compose.yml`'s defaults, so no edits are required for local development. `.env` is git-ignored; only `.env.example` is committed.

### 3. Start PostgreSQL

```bash
docker compose up -d
```

### 4. Verify the container is healthy

```bash
docker compose ps
```

Wait until the `db` service shows `(healthy)`. The healthcheck runs `pg_isready` every 5 seconds.

### 5. Generate the Prisma Client

```bash
pnpm exec nx run api:prisma-generate
```

Generates `apps/api/src/generated/prisma` (git-ignored — regenerate it any time via this command; never hand-edit it).

### 6. Apply migrations

```bash
pnpm exec nx run api:migrate-dev
```

On a fresh checkout this applies the existing, already-committed migration(s) under `apps/api/prisma/migrations/` — no new migration is created since the schema hasn't changed. (If you *do* change `schema.prisma` yourself, run `pnpm exec nx run api:migrate-dev -- --name <describe-the-change>` to generate a new migration.)

### 7. Configure the PostgreSQL MCP server (optional, Claude Code only)

The project ships a committed, project-scoped `.mcp.json` that wires up a Postgres MCP server (`crystaldba/postgres-mcp`, run via Docker) for schema/data inspection during development. It requires no manual configuration beyond having completed step 2 (`.env` must exist with a valid `DATABASE_URL`) — see [PostgreSQL MCP setup](#postgresql-mcp-setup) below for exactly how it works. If you're already in a running Claude Code session from before `.mcp.json` existed, **restart/reconnect the session** so it picks up the project-scoped server; Claude Code loads project MCP servers at session start, not on the fly.

### 8. Run the seed

```bash
pnpm exec nx run api:seed
```

Reads `data/seed-customers.json` (never modified by tooling), resolves each customer's town to coordinates via the bundled local reference, and upserts all 15 rows.

### 9. Verify idempotency — run the seed again

```bash
pnpm exec nx run api:seed
```

Row count must stay at exactly 15 after this second run — the upsert is keyed on the composite natural key `(name, telepules, countryCode)`, so re-running never creates duplicates.

### 10. Start the API

```bash
pnpm exec nx run api:serve
```

Listens on `http://${HOST:-127.0.0.1}:${PORT:-3000}`. Stop it any time with `Ctrl+C` (`SIGINT`) — the server closes Fastify and disconnects Prisma cleanly before exiting.

### 11. Call both endpoints

```bash
curl http://127.0.0.1:3000/customers/count
curl http://127.0.0.1:3000/customers/by-distance
```

### 12. Run typecheck

```bash
pnpm exec nx run api:typecheck
```

### 13. Run tests

```bash
pnpm exec nx run api:test
```

Runs the full Vitest suite (geo module + route response shaping) — all of it database-independent.

### 14. Stop the services

Stop the API with `Ctrl+C` if still running, then:

```bash
docker compose down
```

Add `-v` to also remove the Postgres data volume (a full reset — you'll need to re-run migrate and seed afterward).

## Nx commands reference

Every command below maps directly to a target in `apps/api/project.json`:

| Command | What it does |
|---|---|
| `pnpm exec nx run api:serve` | Starts the Fastify API (`tsx src/main.ts`). |
| `pnpm exec nx run api:typecheck` | `tsc --noEmit` against `apps/api/tsconfig.app.json`. |
| `pnpm exec nx run api:test` | Runs the Vitest suite (`vitest run`). |
| `pnpm exec nx run api:prisma-generate` | `prisma generate --schema=apps/api/prisma/schema.prisma`. |
| `pnpm exec nx run api:migrate-dev` | `prisma migrate dev --schema=apps/api/prisma/schema.prisma`. |
| `pnpm exec nx run api:seed` | Runs `apps/api/src/seed/seed.ts` — a separate CLI process (see below). |

`pnpm exec nx show projects` lists registered projects (`["api"]`); `pnpm exec nx show project api` shows the full target list.

## Design notes

- **The seed is a separate CLI process.** `nx run api:seed` runs `apps/api/src/seed/seed.ts` directly via `tsx`; it is never triggered by an HTTP request, and the running API server has no route that invokes it.
- **No external geocoding API and no runtime LLM call anywhere in this project.** Town → coordinate resolution is entirely local (see next point); the two HTTP endpoints and the seed script make no outbound network calls.
- **The local city coordinate reference** (`apps/api/src/geo/town-reference.ts`) bundles known city-center coordinates for exactly the 15 cities present in `data/seed-customers.json`. Lookup is accent-, case-, and whitespace-insensitive (`apps/api/src/geo/normalize-town.ts` trims, NFD-decomposes, and strips diacritics before matching).
- **Unknown cities are not an error.** If a town isn't in the reference, `geocodeTown` logs a warning and returns `null`; the seed stores `lat`/`lon` as `null` for that customer and continues processing the rest — it never crashes the whole seed run.
- **Distance sorting always uses raw, unrounded values.** `apps/api/src/geo/sort-by-distance.ts` sorts by true Haversine distance (nulls last, deterministic name tie-break via a shared `Intl.Collator`). Rounding to one decimal happens only once, in `apps/api/src/routes/customers.ts`, when building the HTTP response — never before or during sorting.
- **`.env` and the generated Prisma Client are never committed.** `.env` is git-ignored (only `.env.example` is tracked); `apps/api/src/generated/prisma/` is git-ignored and regenerated via `nx run api:prisma-generate`.

## PostgreSQL MCP setup

- **Project-scoped `.mcp.json`** (committed, no credentials) defines a `postgres` MCP server whose `command` is `./scripts/mcp-postgres.sh` — a small, secret-free wrapper script, not a literal connection string.
- **`scripts/mcp-postgres.sh`** loads the local `.env` at invocation time (`set -a; source .env; set +a`) and exits with a clear error if `DATABASE_URL` isn't set — it never assumes Claude Code auto-loads `.env` for it, because it doesn't.
- **Docker host rewrite:** the MCP server runs in its own container (`crystaldba/postgres-mcp`), so the script rewrites `localhost` → `host.docker.internal` in the connection string before passing it in as `DATABASE_URI`, so the container can reach the host-published Postgres port.
- **Restricted access mode:** the server runs with `--access-mode=restricted` (read-only transactions) — it's for inspection (schema, tables, row counts, sample data) during development, not for making changes.
- **Session restart/approval:** Claude Code loads project-scoped `.mcp.json` servers at session start. If `.mcp.json` didn't exist yet when your current session started, restart/reconnect the session (and approve the project MCP server if prompted) before its tools (`mcp__postgres__*`) become available.

## Verification (what "done" looks like)

1. `docker compose ps` → `db` service `(healthy)`.
2. `pnpm exec nx run api:seed` (run twice) → both succeed; via MCP or `psql`, `SELECT COUNT(*) FROM "Customer"` → `15`, no duplicates.
3. `pnpm exec nx run api:typecheck` → passes.
4. `pnpm exec nx run api:test` → all suites pass.
5. `curl http://127.0.0.1:3000/customers/count` → `{"count":15}`.
6. `curl http://127.0.0.1:3000/customers/by-distance` → 15 customers, Budapest customer(s) first at `distanceKm: 0`, strictly non-decreasing distances, each rounded to one decimal, no unsupported routes (`POST`, `PUT`, `PATCH`, `DELETE`, or a health-check endpoint all return `404`).
