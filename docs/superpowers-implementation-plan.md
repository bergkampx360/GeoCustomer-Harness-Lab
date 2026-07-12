# GeoCustomer Harness Lab — Implementation Plan

## Progress Summary

- **Status:** Planning approved. No implementation started.
- **Milestones completed:** 0 / 9.
- **Next action:** awaiting explicit approval to start Milestone 1.

## Context

A small, offline, self-contained REST service over Postgres. It idempotently seeds 15 customers with locally-resolved lat/lon (no external geocoding API, no runtime LLM calls), and exposes exactly two read-only endpoints — `GET /customers/count` and `GET /customers/by-distance` (Haversine distance from Budapest, ascending, nulls last, deterministic tie-break by name). Source of truth: `docs/assignment.md` and `docs/technical-constraints.md`.

## Approved Architecture Decisions

1. **Nx structure**: a single Nx app, `apps/api`, no `libs/`. Geo logic (haversine, normalization, reference data) has exactly one consumer, so it lives in `apps/api/src/geo/` as plain files/tests rather than a separate Nx project.
2. **Idempotent seed key**: composite unique key on `(name, telepules, countryCode)` — not `name` alone. `countryCode` is a stored column sourced from `location.countryCode` in the seed JSON. Seed upserts via `where: { naturalKey: { name, telepules, countryCode } }`.
3. **Sorting uses raw, unrounded Haversine distance.** Rounding to 1 decimal happens only in the route handler, at response-serialization time — never before or during sorting. This avoids a rounding-before-sorting bug class where two distances that round to the same displayed value (e.g. raw `9.96` and `10.04`, both → `10.0`) would otherwise be ordered incorrectly.
4. **Deterministic name tie-break** via a shared, explicitly-configured `Intl.Collator('en', { sensitivity: 'base' })` (`geo/name-collator.ts`) — not default `localeCompare`, which is environment/locale-dependent.
5. **Postgres MCP sequencing**: the MCP server is configured immediately after Postgres is brought up via Docker Compose (Milestone 3), before the first migration, so it is available for inspection at every subsequent step — schema after migration, row data after seeding.
6. **Shared vs. local MCP config**: a committed `.mcp.json` (project scope) defines which server and how it's invoked, using `${DATABASE_URL}` env-var expansion — no literal credentials, safe to commit. The actual `DATABASE_URL` value lives only in the local, git-ignored `.env`; `.env.example` documents the expected shape.
7. **`by-distance` response shape**: full stored customer fields (`id, name, telepules, countryCode, lat, lon, budget, note`) plus `distanceKm`. Nothing in the constraints restricts the shape.
8. **`budget`/`note` DB nullability**: nullable (`Int?`, `String?`). Storing them is optional-but-allowed per spec; nullable is the safer schema default.
9. **Budapest kerületei (districts)**: skipped. The spec marks this optional and no seed customer uses a district string; unresolved district strings still degrade safely to `null` + logged.
10. **Postgres port**: default `5432`, configurable via `.env`. Confirmed free on the development machine.

## Data Model (Prisma)

```prisma
model Customer {
  id          Int     @id @default(autoincrement())
  name        String
  telepules   String
  countryCode String
  lat         Float?
  lon         Float?
  budget      Int?
  note        String?

  @@unique([name, telepules, countryCode], name: "naturalKey")
}
```

## Acceptance Criteria

- `GET /customers/count` returns `{ "count": N }` matching the actual row count (15 after a fresh seed).
- `GET /customers/by-distance`:
  - ascending by **raw** Haversine distance (rounding happens only when building the response);
  - Budapest customers first, at `0`;
  - unknown-coordinate customers last, `distanceKm: null`;
  - ties broken by `name` via a fixed, explicit `Intl.Collator` — deterministic regardless of host locale;
  - each `distanceKm` in the response rounded to 1 decimal.
- Seed is idempotent on `(name, telepules, countryCode)`: running it twice leaves exactly 15 rows, no duplicates.
- Town matching is accent-, case-, and whitespace-insensitive; unresolved towns store `lat`/`lon = null`, log a warning, and never crash the seed.
- Only the two GET endpoints exist — no POST/PUT/PATCH/DELETE, no auth.
- Seed runs as a separate command/process from the HTTP server (never triggered by an HTTP call).
- Haversine unit tests cover: Budapest→Vienna (~214 km), Budapest→Budapest (0 km), null-coordinate handling — plus the additional focused tests listed in Milestone 6.
- TypeScript strict mode enabled workspace-wide.
- `data/seed-customers.json` is never modified by tooling.
- README documents: Postgres start, MCP setup, migration, seed, server start, tests.
- Postgres MCP is configured **before** it's used, and is actually used during development (schema/table/count/sample data inspection) — not just a config file.
- No secrets or real `.env` committed; `.env.example` provided; shared vs. local MCP config clearly separated.

## Risks & Edge Cases

- **Composite-key collision**: all 15 seed rows are distinct on `(name, telepules, countryCode)`. A future seed listing the same person twice under the same city/country would collide by design.
- **Diacritic stripping coverage**: normalization uses Unicode NFD + strip combining marks (handles `Kraków`'s `ó`, the only diacritic in the current 15 cities). Characters that don't NFD-decompose to ASCII (e.g. `ø`, `đ`, `ß`) aren't in the current seed; since both reference keys and incoming names pass through the same normalizer, matching stays internally consistent regardless.
- **Nx generator bloat**: default `@nx/node` app generators pull in webpack/jest scaffolding that isn't needed. Mitigation: hand-author `apps/api/project.json` with minimal targets (serve/seed/test via `nx:run-commands` wrapping `tsx`/`vitest`).
- **Seed must not crash on one bad row**: geocode lookup is wrapped per-record in the seed loop; a miss logs and continues, never throws.
- **Rounding-before-sorting bug class**: covered by a dedicated test in Milestone 6 (raw `9.96`/`10.04` case).
- **Locale-dependent sort bugs**: removed by using a shared, explicitly-configured `Intl.Collator` instance instead of default `localeCompare`.
- **MCP secret hygiene**: MCP config references `DATABASE_URL` from env rather than embedding credentials; `.env` stays git-ignored; only the shared, credential-free `.mcp.json` is committed.
- **Testing the "unknown town" path**: since all 15 real seed cities resolve, the unit test uses a synthetic town name (e.g. `"Nowhereville"`) fed directly to the geocode lookup function — not by editing the seed file.

## Milestones

### Milestone 1 — Scaffold Nx + pnpm workspace

- **Status:** Pending
- **Goal:** Root-level Nx/pnpm workspace scaffolding exists, with no app code yet.
- **Tasks:**
  - Create Nx workspace at repo root (`nx.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, root `package.json`).
  - Add `.gitignore` appropriate for Node/Nx/pnpm/Prisma.
- **Verification:**
  - `pnpm install` succeeds.
  - `nx --version` / `nx show projects` runs without error (no projects yet, but the CLI resolves).
- **Planned commit message:** `chore: scaffold Nx pnpm workspace`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 2 — Add docker-compose Postgres and env templates

- **Status:** Pending
- **Goal:** A local, disposable Postgres instance is available via Docker Compose, with env templates in place.
- **Tasks:**
  - Add `docker-compose.yml` defining a single Postgres service (default port `5432`, configurable).
  - Add `.env.example` documenting `DATABASE_URL` (and any other required vars).
  - Add local `.env` (git-ignored) with matching values.
- **Verification:**
  - `docker compose up -d` starts Postgres and it reports healthy.
  - `docker compose ps` shows the service running.
- **Planned commit message:** `chore: add docker-compose postgres and env templates`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 3 — Configure Postgres MCP for local development

- **Status:** Pending
- **Goal:** Postgres MCP server is configured and reachable against the running (still schema-less) database, before any schema/migration/seed work happens.
- **Tasks:**
  - Add a committed, shared `.mcp.json` at repo root defining the Postgres MCP server, using `${DATABASE_URL}` env-var expansion — no literal credentials.
  - Confirm `DATABASE_URL` in local `.env` matches the docker-compose Postgres instance.
- **Verification:**
  - Connect via the Postgres MCP and confirm it reaches the database (e.g., lists an empty schema / no tables yet).
- **Planned commit message:** `chore: configure Postgres MCP for local development`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 4 — Add Fastify app skeleton

- **Status:** Pending
- **Goal:** A bootable Fastify server exists inside the Nx workspace, with no routes or DB wiring yet.
- **Tasks:**
  - Hand-author `apps/api/project.json`, `tsconfig.app.json`, `tsconfig.spec.json`, `package.json`.
  - Add minimal `apps/api/src/main.ts` that boots a Fastify instance and listens on a configurable port.
  - Add `serve` Nx target (`nx:run-commands` wrapping `tsx`).
- **Verification:**
  - `nx run api:serve` boots the server without error.
- **Planned commit message:** `feat(api): add Fastify app skeleton`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 5 — Add Prisma schema with composite natural key and initial migration

- **Status:** Pending
- **Goal:** The `Customer` model (with composite `(name, telepules, countryCode)` unique key) exists in Postgres via a Prisma migration.
- **Tasks:**
  - Add `apps/api/prisma/schema.prisma` with the `Customer` model shown above.
  - Run the initial `prisma migrate dev` migration.
  - Add `migrate`/`generate` Nx targets.
- **Verification:**
  - Migration applies cleanly.
  - Via Postgres MCP: confirm the `Customer` table, its columns, and the `naturalKey` unique constraint exist.
- **Planned commit message:** `feat(db): add Prisma schema with composite natural key and initial migration`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 6 — Add geo module with full unit tests

- **Status:** Pending
- **Goal:** All pure geo logic (Haversine distance, town normalization, reference lookup, sorting) exists and is fully unit-tested, independent of the database.
- **Tasks:**
  - `geo/haversine.ts` — Haversine formula.
  - `geo/distance-from-budapest.ts` — null-safe wrapper returning raw, unrounded km.
  - `geo/name-collator.ts` — shared `Intl.Collator('en', { sensitivity: 'base' })`.
  - `geo/sort-by-distance.ts` — sorts by raw distance, nulls last, collator tie-break; returns unrounded `distanceKm`.
  - `geo/normalize-town.ts` — NFD diacritic stripping, lowercase, trim.
  - `geo/town-reference.ts` — bundled `telepules -> {lat, lon}` map for the 15 seed cities.
  - `geo/geocode.ts` — normalize + reference lookup; logs and returns `null` on miss, never throws.
  - Tests: `haversine.spec.ts` (Budapest↔Vienna ≈214 km, zero-distance), `distance-from-budapest.spec.ts` (null handling), `normalize-town.spec.ts` (trim/case/diacritics), `geocode.spec.ts` (known city + synthetic unknown city), `sort-by-distance.spec.ts` (nulls last, deterministic tie-break, raw-vs-rounded ordering using a constructed `9.96`/`10.04` tie-at-rounded-value case).
- **Verification:**
  - `nx run api:test` passes, all listed test files present and green.
- **Planned commit message:** `feat(geo): add haversine, normalization, geocode, distance-from-budapest and sort-by-distance with full unit tests`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 7 — Add idempotent seed script

- **Status:** Pending
- **Goal:** `data/seed-customers.json` can be loaded into Postgres repeatedly without duplication, with unresolved towns degrading safely.
- **Tasks:**
  - `apps/api/src/seed/seed.ts` — reads the seed JSON, resolves lat/lon via `geocode.ts`, upserts via the composite `naturalKey`.
  - Add `seed` Nx target, run as a separate command from the HTTP server (never via an endpoint).
- **Verification:**
  - Run the seed twice locally.
  - Via Postgres MCP: row count is exactly 15 after both runs, no duplicates, sample rows have expected `lat`/`lon`/`countryCode`.
- **Planned commit message:** `feat(seed): add idempotent seed script keyed on (name, telepules, countryCode)`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 8 — Implement customers/count and customers/by-distance endpoints

- **Status:** Pending
- **Goal:** Both required endpoints are implemented and wired into the Fastify app, matching the acceptance criteria exactly.
- **Tasks:**
  - `routes/customers.ts`: `GET /customers/count` via `prisma.customer.count()`.
  - `routes/customers.ts`: `GET /customers/by-distance` — fetch all customers, call `sortByDistanceFromBudapest`, map to response rounding `distanceKm` to 1 decimal only at this step.
  - Wire routes into `main.ts`.
- **Verification:**
  - Manual `curl` against both endpoints on the seeded DB.
  - `GET /customers/count` returns `{"count":15}`.
  - `GET /customers/by-distance` returns Budapest customer(s) first at `0`, ascending order, each `distanceKm` rounded to 1 decimal.
  - Cross-check returned rows against the database via Postgres MCP.
- **Planned commit message:** `feat(api): implement customers/count and customers/by-distance endpoints`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_

### Milestone 9 — Add README and finalize env example

- **Status:** Pending
- **Goal:** A newcomer can run the whole project end-to-end from README instructions alone.
- **Tasks:**
  - `README.md`: Postgres start (docker compose) → MCP setup → migration → seed → server start → tests.
  - Finalize `.env.example` to match all env vars actually used.
- **Verification:**
  - Follow the README from a clean checkout (fresh `docker compose up`, migrate, seed, serve, test) and confirm every step works as documented.
- **Planned commit message:** `docs: add README and finalize env example`
- **Actual commit hash:** _pending_
- **Deviations:** _none yet_
