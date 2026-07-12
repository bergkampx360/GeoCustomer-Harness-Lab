# GeoCustomer Harness Lab — Implementation Plan

## Progress Summary

- **Status:** Milestone 5 completed.
- **Milestones completed:** 5 / 9.
- **Next action:** awaiting explicit approval to start Milestone 6.

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

  @@unique([name, telepules, countryCode], name: "naturalKey", map: "naturalKey")
}
```

`map: "naturalKey"` was added during Milestone 5 implementation so the underlying Postgres constraint itself is named `naturalKey`, not just the Prisma Client API field — see Milestone 5 for details.

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

- **Status:** Completed
- **Goal:** Root-level Nx/pnpm workspace scaffolding exists, with no app code yet.
- **Tasks:**
  - Create Nx workspace at repo root (`nx.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, root `package.json`).
  - Add `.gitignore` appropriate for Node/Nx/pnpm/Prisma.
- **Verification:**
  - `pnpm install` succeeds. ✅ (`nx@23.0.2`, `typescript@7.0.2` installed)
  - `nx --version` / `nx show projects` runs without error (no projects yet, but the CLI resolves). ✅ (`nx show projects` → `[]`)
  - `strict: true` confirmed via `tsc --showConfig -p tsconfig.base.json`. ✅
  - `node_modules/` and `.nx/workspace-data/` confirmed git-ignored via `git check-ignore` / `git status --ignored`. ✅
- **Planned commit message:** `chore: scaffold Nx pnpm workspace`
- **Actual commit hash:** `787fb3b`
- **Deviations:**
  - Hand-authored `nx.json`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`/`tsconfig.json` directly instead of running `create-nx-workspace` interactively, to avoid generator-added scaffolding (e.g. sample apps, unrequested plugins) and to keep exact control over which two dependencies (`nx`, `typescript`) get installed, consistent with the "avoid unnecessary packages/layers" constraint and the plan's flagged "Nx generator bloat" risk.
  - Added `tsconfig.json` (extends `tsconfig.base.json`, empty `references`) alongside `tsconfig.base.json` — standard Nx root convention, not separately called out in the original plan but needed for the base config to be a valid root project reference target once apps are added later.
  - pnpm required an explicit build-script approval for `nx`'s postinstall step; approved via `pnpm-workspace.yaml`'s `allowBuilds: { nx: true }` (pnpm's own supply-chain confirmation mechanism, not a new dependency).
  - This milestone's plan-document update (marking Completed, recording deviations) is included in the `chore: scaffold Nx pnpm workspace` commit. The **actual commit hash** could not be included in that same commit without knowing it in advance, so it was recorded in an immediately following focused documentation commit (`docs: record Milestone 1 commit hash`), per the plan's own update rule.

### Milestone 2 — Add docker-compose Postgres and env templates

- **Status:** Completed
- **Goal:** A local, disposable Postgres instance is available via Docker Compose, with env templates in place.
- **Tasks:**
  - Add `docker-compose.yml` defining a single Postgres service (default port `5432`, configurable). ✅
  - Add `.env.example` documenting `DATABASE_URL` (and any other required vars). ✅
  - Add local `.env` (git-ignored) with matching values. ✅
- **Verification:**
  - `docker compose config` validates. ✅
  - `docker compose up -d` starts Postgres. ✅
  - Container reports healthy via `docker inspect --format='{{.State.Health.Status}}'` → `healthy`. ✅
  - `docker compose ps` shows the service `Up ... (healthy)` on `0.0.0.0:5432->5432/tcp`. ✅
  - `.env` confirmed git-ignored via `git check-ignore -v .env`; `.env.example` confirmed untracked-but-not-ignored. ✅
- **Planned commit message:** `chore: add docker-compose postgres and env templates`
- **Actual commit hash:** `d6648a792fb64e741fc923d07ea4bb9559421d22`
- **Deviations:**
  - Added a named Docker volume (`postgres-data`) for data persistence across container restarts. Not explicitly requested in the plan, but standard for a local Postgres dev instance and not disallowed by the technical constraints (which only rule out cloud/orchestration infrastructure, not a local volume).
  - `POSTGRES_PORT` was added as its own env var (defaulting to `5432`) separately from `DATABASE_URL`, so the compose file's host port mapping and Prisma's future connection string both derive from the same configurable value without duplicating a hardcoded port in two places.

### Milestone 3 — Configure Postgres MCP for local development

- **Status:** Completed
- **Goal:** Postgres MCP server is configured and reachable against the running (still schema-less) database, before any schema/migration/seed work happens.
- **Selected MCP server:** [`crystaldba/postgres-mcp`](https://github.com/crystaldba/postgres-mcp) ("Postgres MCP Pro"), run via its official Docker image `crystaldba/postgres-mcp`. Container reported **server version `1.6.0`** (newer than the `0.3.0` on PyPI — the Docker image tracks more current builds). Selected over:
  - `@modelcontextprotocol/server-postgres` — confirmed **deprecated** on npm and archived on GitHub (`modelcontextprotocol/servers-archived`, `archived: true`); excluded per instruction.
  - `@ahmetkca/mcp-server-postgres` — single-maintainer npm package, last published 2025-08-08, GitHub repo unreachable via the GitHub API; not a safe pick.
  - `crystaldba/postgres-mcp`'s own GitHub repo, by contrast, is **not archived**, was pushed 2026-01-22 and updated as recently as 2026-07-12, with 3,045 stars and 66 open issues — a genuinely active project.
- **Tasks:**
  - Add a committed, shared `.mcp.json` at repo root defining the Postgres MCP server. ✅ — implemented as `{"mcpServers":{"postgres":{"command":"./scripts/mcp-postgres.sh","args":[]}}}`, no literal credentials.
  - Confirm `DATABASE_URL` in local `.env` matches the docker-compose Postgres instance. ✅ (`diff .env.example .env` — identical, both point at the compose service).
- **How `DATABASE_URL` reaches the MCP process:** Claude Code does not auto-load a project's `.env` into `.mcp.json`'s environment, and the container can't resolve host `localhost` directly, so a committed wrapper script (`scripts/mcp-postgres.sh`, contains no secrets) is invoked as the MCP `command`. At launch it: sources the local, git-ignored `.env`; exits with a clear error to stderr if `DATABASE_URL` is unset; rewrites `localhost` → `host.docker.internal` (container-to-host-published-port reachability, standard on Docker Desktop for macOS); and execs `docker run -i --rm -e DATABASE_URI=<rewritten> crystaldba/postgres-mcp --access-mode=restricted`. `--access-mode=restricted` (read-only transactions) was chosen since this milestone's stated MCP purpose is inspection only.
- **Verification:**
  - `docker compose ps` confirmed Postgres still healthy from Milestone 2 before configuring MCP. ✅
  - `scripts/mcp-postgres.sh` tested directly: with `.env` temporarily removed, it fails with a clear stderr message and exit code 1, then `.env` was restored and diffed byte-for-byte against its prior content. ✅
  - `docker pull crystaldba/postgres-mcp` succeeded. ✅
  - **Actual MCP verification performed:** since Claude Code loads project `.mcp.json` servers at session start (not hot-reloaded mid-session — see Deviations), live in-session MCP tool calls were not available yet this turn. As a substitute, the exact same containerized server was driven manually over its stdio JSON-RPC protocol (`initialize` → `notifications/initialized` → `tools/call`), reproducing precisely what the Claude Code MCP client would send:
    - `execute_sql({"sql": "select current_database(), current_user, version();"})` → `current_database: geocustomer`, `current_user: geocustomer`, `PostgreSQL 16.14` — **connection succeeds, database name confirmed**.
    - `list_schemas({})` → `information_schema`, `pg_catalog`, `pg_toast` (system), `public` (user schema, owner `pg_database_owner`) — **current schema state confirmed**.
    - `list_objects({"schema_name": "public", "object_type": "table"})` → `[]` — **confirmed no application tables exist yet**.
- **Planned commit message:** `chore: configure Postgres MCP for local development`
- **Actual commit hash:** `d8ba31137731be5f7ed46f0121d9a7e509d60980`
- **Deviations:**
  - Used the Docker image (`crystaldba/postgres-mcp`) rather than the project's primary-documented `uvx postgres-mcp` invocation, since `uv`/Python MCP tooling isn't installed in this environment and Docker is already a hard project dependency — avoids adding a new toolchain for one dev tool.
  - Added `scripts/mcp-postgres.sh`, not called out explicitly in the original plan, as the mechanism satisfying "reproducible way for the MCP process to receive DATABASE_URL" without assuming Claude Code auto-loads `.env`.
  - `.mcp.json` does not use `${DATABASE_URL}` env-var expansion as originally sketched in the plan (Approved Architecture Decisions #6) — Claude Code's own `.mcp.json` variable expansion pulls from the parent process's environment, not from a project `.env` file, so a literal `${DATABASE_URL}` there would have been silently empty. The wrapper script approach was chosen instead and is the more explicit, verifiable mechanism; the underlying goal (no committed secrets, reproducible local wiring) is unchanged.
  - **Live in-session MCP tool verification could not be performed in the same turn the config was created** — Claude Code loads project-scoped `.mcp.json` servers at session start, and that session was already running when the file was created. The equivalent verification was performed by manually driving the same Docker container over the MCP stdio protocol (see Verification above), which exercises identical code paths (same image, same connection string, same tool implementations) but was not literally "the Claude Code session using its MCP tool."
  - **Native MCP integration verification: Completed.** A fresh Claude Code session subsequently loaded the project-scoped `postgres` MCP server successfully (its tools appeared as available `mcp__postgres__*` tools with no manual setup). The following native tools were then invoked directly in-session: `mcp__postgres__execute_sql`, `mcp__postgres__list_schemas`, `mcp__postgres__list_objects`. Verified results:
    - `current_database`: `geocustomer`
    - `current_user`: `geocustomer`
    - PostgreSQL version: `16.14`
    - Schemas: `information_schema`, `pg_catalog`, `pg_toast`, `public`
    - Tables in `public`: none
    
    These match the earlier manual stdio verification exactly, confirming the `.mcp.json` + wrapper-script configuration is correct end-to-end via the actual Claude Code MCP client, not just the underlying container.

### Milestone 4 — Add Fastify app skeleton

- **Status:** Completed
- **Goal:** A bootable Fastify server exists inside the Nx workspace, with no routes or DB wiring yet.
- **Tasks:**
  - Hand-author `apps/api/project.json`, `tsconfig.app.json`, `package.json`. ✅ (`tsconfig.spec.json` deferred — see Deviations)
  - Add minimal `apps/api/src/main.ts` that boots a Fastify instance and listens on a configurable port. ✅
  - Add `serve` Nx target (`nx:run-commands` wrapping `tsx`). ✅ — plus a `typecheck` target (`nx:run-commands` wrapping `tsc --noEmit`), needed to satisfy "TypeScript compilation succeeds" as an explicit, independently runnable verification step.
- **Dependencies added** (in `apps/api/package.json`, the only new dependencies this milestone): `fastify@^5.10.0` (runtime), `tsx@^4.23.0` and `@types/node@^26.1.1` (dev, to run/typecheck TS directly with no build step).
- **Environment variables:** `HOST` (default `127.0.0.1` — local-only by default, matching the project's no-auth/local-dev posture) and `PORT` (default `3000`).
- **Verification:**
  - `nx show projects` → `["api"]`; `nx show project api` → confirms `serve`/`typecheck` targets registered. ✅ (Nx project discovered)
  - `nx run api:typecheck` → passed after fixing two `TS4111` errors (`process.env.HOST`/`.PORT` needed bracket access under `noPropertyAccessFromIndexSignature`, enabled in Milestone 1). ✅ (TypeScript compilation succeeds)
  - `nx run api:serve` → logged `Server listening at http://127.0.0.1:3000`; `curl http://127.0.0.1:3000/` → `404` (expected — no routes registered yet, this milestone explicitly excludes routes). ✅ (Fastify server starts without errors)
  - Sent `SIGINT` to the running server process; process exited on its own (confirmed via `kill -0` finding no process left), no force-kill needed. ✅ (server stops cleanly)
- **Planned commit message:** `feat(api): add Fastify app skeleton`
- **Actual commit hash:** `fbdf38d11cddda4ea192c8f0c4787877480ba130`
- **Deviations:**
  - Deferred `apps/api/tsconfig.spec.json` to Milestone 6 (when Vitest and the first test files actually arrive) rather than creating an unused placeholder now — this milestone explicitly excludes tests, and an empty spec tsconfig with no consumer would be dead scaffolding until then.
  - Added a `typecheck` Nx target beyond the single `serve` target originally sketched in the plan, since the milestone's own verification checklist requires confirming "TypeScript compilation succeeds" as a distinct, repeatable check, not just an implicit side effect of `tsx` running.
  - `pnpm install` required one additional build-script approval (`esbuild`, a transitive dependency of `tsx`, via `pnpm-workspace.yaml`'s `allowBuilds`) — the same supply-chain confirmation mechanism used for `nx` in Milestone 1, not a new project dependency.
  - `HOST` defaults to `127.0.0.1` rather than `0.0.0.0`; not specified in the plan, chosen as the more conservative "sensible local default" for a service with no auth.

### Milestone 5 — Add Prisma schema with composite natural key and initial migration

- **Status:** Completed
- **Goal:** The `Customer` model (with composite `(name, telepules, countryCode)` unique key) exists in Postgres via a Prisma migration.
- **Versions:** `prisma` CLI and `@prisma/client` both `7.8.0`. Migration name: `20260712195509_init`.
- **Tasks:**
  - Add `apps/api/prisma/schema.prisma` with the `Customer` model. ✅ (final field set: `id, name, telepules, countryCode, lat, lon, budget, note` — no timestamps or other fields added, per instruction to keep the schema intentionally small.)
  - Run the initial `prisma migrate dev` migration. ✅ — `20260712195509_init`.
  - Add `prisma-generate`/`migrate-dev` Nx targets. ✅
- **Prisma model and constraint definition:**
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

    @@unique([name, telepules, countryCode], name: "naturalKey", map: "naturalKey")
  }
  ```
  Both `name:` (Prisma Client API field name, used later for `where: { naturalKey: {...} } }`) and `map:` (actual Postgres constraint/index name) are set to `naturalKey` — see Deviations for why `map` was added.
- **Nx targets added:** `prisma-generate` (`prisma generate --schema=apps/api/prisma/schema.prisma`) and `migrate-dev` (`prisma migrate dev --schema=apps/api/prisma/schema.prisma`), both run with the default (workspace-root) `cwd` — required so Prisma's own `.env` discovery (`./.env`) finds the root `.env`. Both targets rely on **Nx's built-in `.env` auto-loading**; invoking the underlying `prisma` command directly via `pnpm exec` does *not* auto-load `.env` (confirmed empirically), so the Nx targets are the documented, reproducible entry point for these commands, not the bare CLI.
- **Verification:**
  - `pnpm exec prisma validate` (with `.env` sourced) → schema valid. ✅ (Prisma schema validation)
  - `nx run api:prisma-generate` → Prisma Client generated to `apps/api/src/generated/prisma` (git-ignored — regenerable build output, see Deviations). ✅ (Prisma client generation)
  - `nx run api:migrate-dev -- --name init` → migration `20260712195509_init` created and applied; `Your database is now in sync with your schema.` ✅ (migration application)
  - `nx run api:typecheck` → passes with the generated client present in `src/`, unused by app code. ✅ (existing API typecheck)
  - **Native Postgres MCP verification** (`mcp__postgres__list_objects`, `mcp__postgres__get_object_details`, `mcp__postgres__execute_sql`):
    - `list_objects(schema_name="public", object_type="table")` → `Customer`, `_prisma_migrations` (Prisma's own bookkeeping table — expected). ✅ table exists
    - `get_object_details(schema_name="public", object_name="Customer")` → columns `id:integer NOT NULL`, `name:text NOT NULL`, `telepules:text NOT NULL`, `countryCode:text NOT NULL`, `lat:double precision NULL`, `lon:double precision NULL`, `budget:integer NULL`, `note:text NULL` — matches the required fields and nullability exactly. ✅
    - Same call → `constraints: [{"name": "Customer_pkey", "type": "PRIMARY KEY", "columns": ["id"]}]`. ✅ primary key exists
    - Same call → `indexes: [..., {"name": "naturalKey", "definition": "CREATE UNIQUE INDEX \"naturalKey\" ON public.\"Customer\" USING btree (name, telepules, \"countryCode\")"}]`. ✅ named `naturalKey` composite unique constraint exists
    - `execute_sql("select count(*) from \"Customer\";")` → `count: 0`. ✅ no customer rows exist yet
    - (One `list_objects` call transiently errored — "terminating connection due to administrator command" — immediately after the Postgres container was recreated mid-session; a retry succeeded cleanly. Noted, not a configuration defect.)
- **Planned commit message:** `feat(db): add Prisma schema with composite natural key and initial migration`
- **Actual commit hash:** `6a46ca12db509e9a363aadcd9252cb709af8d83e`
- **Deviations:**
  - **Prisma 7 requires `prisma.config.ts`**: the plan assumed `datasource db { url = env("DATABASE_URL") }` in `schema.prisma` (as in earlier Prisma versions), but Prisma 7.8.0 rejects `url` in the schema file (`P1012`, "no longer supported... Move connection URLs for Migrate to `prisma.config.ts`"). Added a root `prisma.config.ts` (`defineConfig({ schema: 'apps/api/prisma/schema.prisma', datasource: { url: env('DATABASE_URL') } })`); `schema.prisma`'s datasource block now only declares `provider = "postgresql"`. Discovered empirically (live CLI error), since fetched documentation had not reflected this change.
  - **`map: "naturalKey"` added, not just `name: "naturalKey"`**: the first migration attempt (later discarded) showed that `name:` alone only sets the Prisma Client API field name — the actual Postgres constraint defaulted to `Customer_name_telepules_countryCode_key`. Since instruction #10 requires verifying a constraint *literally named* `naturalKey` via MCP, added `map: "naturalKey"` so the database object itself carries that name. The database was reset (`docker compose down -v` + `up -d`, no data existed yet) and the migration regenerated cleanly as `20260712195509_init`.
  - **`prisma` CLI installed at the workspace root**, not in `apps/api/package.json` as first attempted: pnpm only links workspace-package binaries into that package's own `node_modules/.bin`, but Prisma's `.env` discovery depends on the *invocation* `cwd` being the repo root (where `.env` lives) — so the CLI needed to be resolvable from root. `@prisma/client` (the actual runtime dependency) stays in `apps/api/package.json`.
  - **`apps/api/src/generated/prisma` (the generated Prisma Client output) is git-ignored**, not committed — it's regenerable build output from `nx run api:prisma-generate`, consistent with how `node_modules`/`dist` are already treated in this repo.
  - Prisma's preinstall check printed a Node.js version compatibility notice (this environment runs Node v26.4.0; the notice lists 20.19+/22.12+/24.0+) but every subsequent Prisma command (validate, generate, migrate) worked correctly — treated as an informational notice, not a blocker.
  - No app code changes: `apps/api/src/main.ts` is untouched, confirming Prisma Client usage, seed logic, customer routes, and geo logic were not implemented this milestone, as instructed.

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
