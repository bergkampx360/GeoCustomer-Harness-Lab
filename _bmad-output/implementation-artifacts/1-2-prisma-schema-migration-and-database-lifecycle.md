---
baseline_commit: 94f73f0960d22f0ab82dbf9e03bf63b6f82ec145
---

# Story 1.2: Prisma Schema, Migration, and Database Lifecycle

Status: done

## Story

As the developer building the data layer,
I want the `Customer` Prisma schema migrated into Postgres and a single shared client with graceful shutdown wiring,
so that all later stories read and write through one consistent, cleanly-lifecycled database connection.

## Acceptance Criteria

(Verbatim from `_bmad-output/planning-artifacts/epics.md`, Story 1.2 — do not reinterpret or broaden.)

1. Given the Prisma schema, when `prisma migrate dev` is run against the Dockerized Postgres, then a `customers` table is created matching SPEC.md's data model (`id`, `name`, `telepules`, `lat`, `lon`, `countryCode`, optional `budget`/`note`).
2. Given the schema, when inspected, then a unique constraint exists on `(name, telepules, countryCode)` (AD-5).
3. Given `src/db/client.ts`, when imported from two different modules, then both receive the same singleton `PrismaClient` instance (AD-4).
4. Given the running server, when it receives `SIGINT` or `SIGTERM`, then it calls `app.close()`, disconnects Prisma, and exits cleanly with no hanging process (AD-11).

## Tasks / Subtasks

- [x] Task 1: Install and initialize Prisma (AC: 1)
  - [x] Add `prisma` (dev dependency) and `@prisma/client` (dependency) via pnpm — this is the story's own required technology (SPEC `technical-stack.md`, `technical-constraints.md`), not an out-of-scope addition
  - [x] Initialize `apps/api/prisma/schema.prisma` with the `datasource` reading `DATABASE_URL` — per approved decision, via `prisma.config.ts` at the repo root, not the obsolete inline `datasource { url = ... }` convention
  - [x] Verify the current Prisma client generator syntax against Prisma's own docs before wiring it — confirmed Prisma 7 requires an explicit `output` path and a driver adapter; see Completion Notes
- [x] Task 2: Define the `Customer` model (AC: 1, 2)
  - [x] Fields, matching `data-and-seed.md` verbatim — do not rename: `id`, `name`, `telepules`, `lat` (nullable), `lon` (nullable), `countryCode`, optional `budget`, optional `note`
  - [x] `@@map("customers")` table mapping
  - [x] `@@unique([name, telepules, countryCode])` constraint (AD-5 — the seed's idempotency key; do not substitute a different key)
- [x] Task 3: Run the first migration against the Dockerized Postgres (AC: 1)
  - [x] Ensure Story 1.1's Postgres container is running (`docker compose up -d`) before migrating
  - [x] `pnpm exec prisma migrate dev --name init`
  - [x] Confirm the `customers` table and the unique constraint exist (e.g. `\d customers` via `psql`, or the container's own `psql` client)
- [x] Task 4: Shared Prisma client singleton (AC: 3)
  - [x] `src/db/client.ts` exports one lazily-created `PrismaClient` instance
  - [x] No other file instantiates `PrismaClient` directly — grep the tree to confirm before finishing
- [x] Task 5: Fastify app boundary skeleton and graceful shutdown (AC: 4)
  - [x] `src/app.ts` exports `buildApp()` — a fully-configured Fastify instance, **no routes registered yet**, no `.listen()` call (routes are Stories 1.4/1.5)
  - [x] `src/server.ts` is the only file that calls `buildApp().listen(...)`; registers `SIGINT`/`SIGTERM` handlers that call `app.close()` (which, via Fastify's `onClose` hook, disconnects the shared Prisma client) before the process exits
  - [x] `src/main.ts` becomes a one-line shim (`import './server';`) — Nx's existing `build`/`serve` targets already point at `main.ts` as the entrypoint (see `apps/api/project.json`); this keeps that wiring intact without editing Nx config, while still satisfying AD-3's `app.ts`/`server.ts` split. Replace the current placeholder (`console.log('Hello World');`) accordingly.
- [x] Task 6: Verify the whole story end-to-end (AC: 1–4)
  - [x] Run every command in Validation Commands below and confirm each stated result

### Review Findings

- [x] [Review][Patch] Add `prisma generate` to the reproducible install flow — a fresh clone/CI running `pnpm install && nx build api` would fail today since the git-ignored generated client doesn't exist until manually generated; directly relevant to Story 1.7's upcoming fresh-clone requirement [package.json]
- [x] [Review][Patch] Move the Prisma-disconnecting `onClose` hook out of `buildApp()` into `server.ts`'s own shutdown wiring, so `buildApp()` stays safe to call more than once per process — the exact pattern AD-3 itself describes for tests ("Tests import `buildApp()` directly") — while still satisfying AD-11's literal close-triggers-disconnect mechanism [apps/api/src/app.ts, apps/api/src/server.ts]
- [x] [Review][Patch] Boot-failure path (`prisma.customer.count()` throws) never calls `app.close()` before `process.exit(1)`, so the disconnect hook never runs on a failed boot — only the happy-path shutdown was actually exercised [apps/api/src/server.ts:8-16]
- [x] [Review][Patch] `shutdown()` had no re-entrancy guard and no try/catch — a second signal during shutdown could re-enter concurrently, and a rejected `app.close()` would become an unhandled rejection instead of a clean exit. Fixed: `shuttingDown` guard added, `app.close()` wrapped in try/catch with explicit error logging and `process.exit(1)` on failure [apps/api/src/server.ts:19-26]
- [x] [Review][Declined, non-blocking] Reviewer additionally suggested a watchdog timeout on `app.close()` (to bound a hung close). This was explicitly declined per approved decision: no watchdog timeout and no new shutdown abstraction for this project — disproportionate for GeoCustomer-Harness-Lab's scope. Non-blocking; no watchdog was implemented and none is required by any acceptance criterion [apps/api/src/server.ts]
- [x] [Review][Patch] `DATABASE_URL` is passed to `PrismaPg`/read by `prisma.config.ts` with no validation that it's actually set — failure surfaces as an opaque low-level connection error instead of a clear config-time message [apps/api/src/db/client.ts:4, prisma.config.ts:14]
- [x] [Review][Patch] Change Log entry says "2026-07-13" but the migration this story adds is timestamped `20260716160812_init` and the Debug Log evidence reflects that same later date — the audit trail is internally inconsistent [this file, Change Log]
- [x] [Review][Defer] No automated regression tests for `app.ts`/`server.ts`/`db/client.ts` — deferred, Vitest wiring is explicitly Story 1.5's job (AD-8 scopes it to pure domain logic), consistent with Story 1.1's precedent of no test infra outside AD-8's scope
- [x] [Review][Defer] Race between an in-flight boot (`start()` still awaiting `prisma.customer.count()`/`app.listen()`) and an incoming signal — deferred, real but very low-probability/low-consequence for this project's actual usage; partially mitigated incidentally by the re-entrancy guard above, not fully solved
- [x] [Review][Defer] Driver-adapter/Docker portability (`binaryTargets` for a Linux container) unverified — deferred, out of scope: no story in the approved plan containerizes the API itself, and cloud deployment is explicitly excluded scope

### Final Review Findings (2026-07-17, third pass)

- [x] [Review][Patch] `prisma.config.ts`'s `DATABASE_URL` fallback used `??`, which does not substitute the placeholder when `DATABASE_URL` is set to an empty string (only `undefined`/`null` trigger `??`), unlike `db/client.ts`'s stricter falsy check — inconsistent behavior for the same misconfiguration. Fixed: `??` changed to `||` [prisma.config.ts:9]
- [x] [Review][Defer] `server.ts` hardcodes `port: 3000` with no `PORT`/`API_PORT` environment override — deferred, non-blocking: no acceptance criterion or Dev Note requires port configurability for this story (zero HTTP routes exist yet); real but low-consequence given this project's small scope [apps/api/src/server.ts]
- [x] [Review][Defer] No process-level `unhandledRejection`/`uncaughtException` handlers beyond the explicit `SIGINT`/`SIGTERM` and `start()`/`shutdown()` try/catch blocks — deferred, non-blocking: AC4 only requires clean handling of `SIGINT`/`SIGTERM`, and this follows the same "no new shutdown abstraction, disproportionate for this project's scope" reasoning already applied to the declined watchdog timeout [apps/api/src/server.ts]
- Verified false positives (confirmed by reading source, not re-listed as findings): `@prisma/adapter-pg`'s internal `pg.Pool` registers its own `'error'` listeners (`dist/index.js:793`, `onIdleClientError`) — no unhandled-idle-client crash risk; the generated Prisma Client (`apps/api/src/generated/prisma/*.ts`) does import from `@prisma/client` internally — not an unused/dead dependency.
- Acceptance Auditor: zero AC violations found — all four acceptance criteria independently reverified against the diff and confirmed satisfied.

## Dev Notes

- **Architecture governance:** AD-4 (one Prisma schema, one generated client, one shared singleton used by both server and seed), AD-5 (seed idempotency key — the unique constraint this story creates is what Story 1.3's upsert will key on), AD-3 (Fastify `buildApp()`/`server.ts` split), and AD-11 (graceful shutdown disconnecting Prisma via `app.close()`) are the four invariants this story exists to satisfy. [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-3, #AD-4, #AD-5, #AD-11]
- **Data model fields are frozen, verbatim:** `id`, `name`, `telepules`, `lat`, `lon`, `countryCode`, optional `budget`/`note` — these exact names, not translated or renamed, per the SPEC's own explicit decision. [Source: spec-geocustomer-backend/data-and-seed.md]
- **`countryCode` is persisted but never exposed in any API response** — this story only persists it (as part of the unique constraint); it must not leak into any future response shape (relevant context for Stories 1.4/1.5, not an action for this story). [Source: spec-geocustomer-backend/data-and-seed.md, api-contract.md "Fields not included"]
- **Do not jump ahead:** no seed data loaded yet (Story 1.3), no HTTP routes registered yet (Stories 1.4/1.5), no count/by-distance logic yet. `buildApp()` in this story has zero routes — that is correct, not incomplete.
- **Seed idempotency depends on this story's constraint being correct:** Story 1.3's upsert keys on exactly `(name, telepules, countryCode)`. Getting this constraint right now is load-bearing for the next story.
- **Prisma version:** SPEC/architecture fix "Prisma" as the required technology (schema, migrations, seed, typed access) but not an exact version — select whatever resolves as current-stable via pnpm at implementation time and record it in the lockfile, consistent with how Story 1.1 handled Nx/TypeScript versions. [Source: ARCHITECTURE-SPINE.md#Stack]

### Previous Story Intelligence (from Story 1.1)

- **Nx/pnpm invocation:** this shell environment sets `CLAUDECODE`/`OPENCODE`, which switches Nx's CLI into a different, agent-oriented output mode (NDJSON, and `create-nx-workspace` maps presets to different templates). For plain `nx`/`pnpm` generator or exec commands, prefix with `env -u CLAUDECODE -u OPENCODE` to get standard, parseable output — this is what Story 1.1 used throughout.
- **pnpm build-script approval:** new native/postinstall packages (Prisma's own CLI included, historically) may trigger pnpm's `[ERR_PNPM_IGNORED_BUILDS]` gate. Run `pnpm approve-builds --all` if this happens, the same way Story 1.1 resolved it for `esbuild`/`nx`/`unrs-resolver`.
- **Port collisions are environment-specific, not a code concern:** Story 1.1 found host port 5432 already bound by an unrelated running container (`superpowers-db-1`) in this dev environment. `docker-compose.yml` already sources the port from `${POSTGRES_PORT}` (never hardcoded) specifically because of this — if the same collision recurs, adjust only the local, git-ignored `.env`, never `docker-compose.yml` or the committed `.env.example` default (`5432`). Do not stop or otherwise touch any container not created by this project's own `docker-compose.yml`.
- **Node LTS deviation still applies:** this environment's only available `node` is a non-LTS release with no version manager to switch to the committed Node 24 LTS target (`.nvmrc`, `package.json` `engines.node`). This was an approved, disclosed deviation for Story 1.1 and applies identically here — do not re-litigate it, just carry the same honest disclosure pattern (surface it, don't suppress it) if it resurfaces in this story's own validation output. Authoritative Node 24 verification remains deferred to Story 1.7.
- **Docker Compose discipline:** validate against a running container, then run `docker compose down` afterward (volume preserved, unrelated containers untouched) — established in Story 1.1 and expected to continue every story that touches the database.

### Project Structure Notes

Builds directly on Story 1.1's foundation (`apps/api`, single Nx project, `docker-compose.yml`, `.env.example`). Expected structure after this story (only what this story adds — later stories add the rest):

```text
{repo-root}/
  apps/
    api/
      prisma/
        schema.prisma        # Customer model, @@map("customers"), @@unique([name, telepules, countryCode])
        migrations/          # created by `prisma migrate dev --name init`
      src/
        app.ts                # buildApp(): Fastify instance, no routes yet, no .listen()
        server.ts             # buildApp().listen() + SIGINT/SIGTERM -> app.close() -> Prisma disconnect
        main.ts                # one-line shim: import './server'; (replaces the Story 1.1 placeholder)
        db/
          client.ts            # single PrismaClient singleton
        assets/.gitkeep         # unchanged from Story 1.1
```

No `src/routes/`, no `src/seed.ts`, no `src/geo/`, no `src/domain/` yet — those belong to Stories 1.3, 1.4, and 1.5.

### References

- [Source: planning-artifacts/epics.md, Story 1.2] — approved scope, acceptance criteria, objective, dependencies, exclusions, validation commands
- [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-3] — Fastify `buildApp()`/`server.ts` boundary
- [Source: ARCHITECTURE-SPINE.md#AD-4] — Prisma placement and client singleton
- [Source: ARCHITECTURE-SPINE.md#AD-5] — seed idempotency key (this story creates the constraint it depends on)
- [Source: ARCHITECTURE-SPINE.md#AD-11] — clean shutdown and error-handling boundaries
- [Source: spec-geocustomer-backend/data-and-seed.md] — exact data model fields, `countryCode` decision
- [Source: spec-geocustomer-backend/api-contract.md] — confirms `countryCode` must not appear in any response
- [Source: _bmad-output/implementation-artifacts/1-1-workspace-and-postgresql-foundation.md] — established conventions (Nx/pnpm invocation, Docker Compose discipline, Node LTS deviation)

## Dependencies and Exclusions

**Dependencies:** Story 1.1 (workspace and a running Postgres container).

**Explicitly excluded from this story** (reserved for later stories):

- Seed data loading or seed logic (Story 1.3)
- HTTP routes of any kind, including `GET /customers/count` and `GET /customers/by-distance` (Stories 1.4/1.5)
- Haversine/distance/sorting logic (Story 1.5)
- PostgreSQL MCP configuration (Story 1.6)
- Any application or business logic beyond the schema, migration, client singleton, and shutdown wiring

## Validation Commands

Run all of the following and confirm the stated result before moving this story to review:

- `pnpm exec prisma migrate dev --name init` → succeeds, creates the `customers` table
- Schema inspection (`\d customers` via `psql`, e.g. `docker compose exec -T postgres psql -U <user> -d <db> -c '\d customers'`) → shows all required columns and the `(name, telepules, countryCode)` unique constraint
- Starting the server (`pnpm exec nx serve api` or equivalent) then sending it `SIGTERM` → exits promptly (bounded time, exit code 0), logs a shutdown message, and leaves no leaked Postgres connection (`SELECT count(*) FROM pg_stat_activity;` before vs. after)
- Code inspection confirms `src/db/client.ts` is the only place `new PrismaClient()` is called in the tree (`grep -rn "new PrismaClient" apps/api/src`)

## Definition of Done

- [x] All 4 acceptance criteria verified against the running implementation
- [x] All Validation Commands above pass with the stated result
- [x] No excluded item (seed logic, HTTP routes, Haversine/sorting, MCP, unrelated business logic) was added
- [ ] Lands as its own small, focused commit (pending: staging/commit is the next, separate approval step)
- [x] Passed code review before being marked done

## Evidence Expected Before Review

- Terminal output (or transcript) of `prisma migrate dev`, the `\d customers` schema inspection, and the `SIGTERM` shutdown test, each showing the expected result above
- Confirmation (via `grep`) that exactly one file constructs `PrismaClient`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`

### Debug Log References

- `prisma validate` → `The schema at apps/api/prisma/schema.prisma is valid` (confirms the datasource-less `db` block + `prisma.config.ts`-supplied URL is valid Prisma 7 syntax).
- `prisma migrate dev --name init` → applied migration `20260716160812_init`, "Your database is now in sync with your schema."
- `prisma generate` → confirmed NOT run automatically by `migrate dev` in Prisma 7 (the generated client directory did not exist until run explicitly); `✔ Generated Prisma Client (7.8.0) to ./apps/api/src/generated/prisma`.
- `docker compose exec -T postgres psql -U changeme -d geocustomer -c '\d customers'` → all 8 columns present with correct nullability; unique index `customers_name_telepules_countryCode_key` on `(name, telepules, countryCode)` confirmed.
- `pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit` → exit 0 after every change.
- `grep -rn "new PrismaClient" apps/api/src` (excluding the generated dir) → exactly one hit, `src/db/client.ts`.
- **`import.meta` build failure and fix:** `nx build api` initially warned about `import.meta` being unavailable in the project's CJS esbuild output, and running the built output threw `TypeError [ERR_INVALID_ARG_TYPE]` at `fileURLToPath(import.meta.url)` inside the generated client — Prisma 7's `prisma-client` generator defaults to ESM-shaped output. Fixed by adding `moduleFormat = "cjs"` to the generator block (Prisma's own documented option for exactly this mismatch) and re-running `prisma generate`; rebuild was then clean and the built server ran without error.
- **`$connect()` does not open a real connection under driver adapters:** verified empirically with a throwaway script — calling `prisma.$connect()` alone left `pg_stat_activity` unchanged, while an actual query (`prisma.customer.count()`) did open a visible pooled connection, which then disappeared after `$disconnect()`. `server.ts`'s boot-time check was written against `prisma.customer.count()` instead of `$connect()` for this reason.
- **AC4 end-to-end (SIGTERM):** built and ran `dist/apps/api/main.js` directly; `pg_stat_activity` showed one unlabelled app connection alongside the `psql` inspection session; sent `SIGTERM`; log showed `"Received SIGTERM, shutting down..."`; process exited with code 0; `pg_stat_activity` re-checked immediately after — the app connection was gone, only `psql` remained.
- **AC4 (SIGINT):** repeated the same start/signal/exit-code check with `SIGINT` — identical clean exit (code 0), same log line with `SIGINT` substituted, same code path (`shutdown()`).
- **Post-validation teardown:** `docker compose down` — container and network removed, `bmad_postgres-data` volume preserved, `superpowers-db-1` and `plantbase-pg` confirmed untouched and still healthy throughout (`docker ps`).

### Review-Correction Re-Validation (2026-07-17)

- `prisma generate` with `DATABASE_URL` unset in the shell → succeeded (`✔ Generated Prisma Client (7.8.0) to ./apps/api/src/generated/prisma`), confirming `generate` no longer requires a real connection string once `prisma.config.ts`'s datasource fell back to a placeholder.
- Full fresh-install simulation: copied the working tree to a scratch dir, deleted `node_modules` and `apps/api/src/generated`, ran `pnpm install --frozen-lockfile` with no `.env` present → root `postinstall` ran `prisma generate` automatically and `apps/api/src/generated/prisma` was regenerated, with no live database involved.
- `pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit` → exit 0.
- `prisma migrate dev --name init` against the running container → "Already in sync, no schema change or pending migration was found." (schema unchanged by this correction pass).
- `\d customers` → all columns and the `(name, telepules, countryCode)` unique constraint unchanged.
- `nx build api` → succeeded; built `dist/apps/api/main.js` run directly.
- SIGTERM: `pg_stat_activity` count 6 → 7 (server connects) → sent `SIGTERM` → process exited code 0, log showed `"Received SIGTERM, shutting down..."`, `pg_stat_activity` back to 6.
- SIGINT: same server started and sent `SIGINT` → exited code 0, log showed `"Received SIGINT, shutting down..."`.
- Boot-failure path: started the built server with `DATABASE_URL` pointed at an unreachable port (5999) → `prisma.customer.count()` threw, error logged, process exited code 1 (no hang, no unhandled rejection) — confirms `app.close()`/Prisma disconnect now run before a failed-boot exit.
- `DATABASE_URL` validation: started the built server with `.env` temporarily moved aside and no `DATABASE_URL` in the environment → failed fast with `Error: DATABASE_URL is not set. Copy .env.example to .env and set DATABASE_URL before starting the server.`, exit code 1.
- `grep -rn "new PrismaClient" apps/api/src` (excluding generated) → still exactly one hit, `src/db/client.ts`.
- Teardown: `docker compose down` — container/network removed, volume preserved, `superpowers-db-1`/`plantbase-pg` untouched.

### Boot-Failure Cleanup Hardening Re-Validation (2026-07-17, second pass)

- Correction: the review's watchdog-timeout suggestion was re-classified from "Patch" to "Declined, non-blocking" per the approved decision (no watchdog timeout, no new shutdown abstraction) — see Review Findings above. The re-entrancy guard and shutdown try/catch were already implemented in the first correction pass and remain unchanged.
- Applied hardening: `start()`'s failure path now wraps `app.close()` in its own try/catch — if the cleanup call itself throws (e.g. the `onClose` hook's `prisma.$disconnect()` fails), the close error is logged separately from the original boot error and the process still exits deterministically with code 1, rather than an unhandled rejection escaping `start()` [apps/api/src/server.ts:19-27].
- `pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit` → exit 0.
- `docker compose up -d` (fresh container, this project's own `bmad-postgres-1`) → healthy; `nx build api` → succeeded.
- SIGTERM: `pg_stat_activity` 6 → 7 (server connects) → `SIGTERM` sent → log `"Received SIGTERM, shutting down..."` → exit code 0 → `pg_stat_activity` back to 6.
- SIGINT: same server, `SIGINT` sent → exit code 0, log `"Received SIGINT, shutting down..."`.
- Boot failure (unreachable `DATABASE_URL`, port 5999): `prisma.customer.count()` threw → error logged → exit code 1, no hang.
- Boot-failure cleanup-error branch specifically (the new hardening): since forcing `app.close()` itself to fail requires a live rejection that isn't reachable via CLI signals alone, the two-log/exit-1 behavior was verified in isolation against the exact `start()` catch-block logic (both the original error and the close error are logged, `process.exit(1)` still runs) — confirms no unhandled rejection and a deterministic exit code even when cleanup itself fails.
- `grep -rn "new PrismaClient" apps/api/src` (excluding generated) → still exactly one hit, `src/db/client.ts`.
- `\d customers` → all columns and the `(name, telepules, countryCode)` unique constraint unchanged.
- Teardown: `docker compose down` — container/network removed, volume preserved, `superpowers-db-1`/`plantbase-pg` untouched.

### Completion Notes List

- **Prisma 7 official architecture followed exactly as approved:** `prisma` (dev), `@prisma/client` + `@prisma/adapter-pg` + `pg` (runtime), `@types/pg` (dev); `prisma-client` generator with explicit `output = "../src/generated/prisma"`; `prisma.config.ts` at the repo root supplies `DATABASE_URL` via `env<Env>("DATABASE_URL")` (no `datasource { url = ... }` in `schema.prisma`); `PrismaClient` instantiated with a `PrismaPg` adapter, never bare `new PrismaClient()`; `prisma migrate dev` and `prisma generate` both run explicitly (Prisma 7 no longer chains them).
- **`dotenv` added as one small, necessary addition beyond the explicitly-approved package list:** the official `prisma.config.ts` pattern itself requires `import 'dotenv/config'` to populate `process.env` before `defineConfig` runs; the same import is also needed at the top of `server.ts` so `DATABASE_URL` is available to `src/db/client.ts` when running the compiled server directly (outside Docker, nothing else loads `.env` into that process). Disclosed here rather than silently added.
- **Generated Prisma Client output path confirmed exactly:** `apps/api/src/generated/prisma/client.ts` — the import used in `src/db/client.ts` is `../generated/prisma/client`. Directory added to `.gitignore` (reproducible via `prisma generate`, per approved decision); schema and migration files under `apps/api/prisma/` are committed normally (not ignored).
- **`moduleFormat = "cjs"` added to the generator block** — a build-tooling detail necessary to make Prisma 7's generated client run under this Nx project's existing CJS/esbuild output, discovered only by actually building and running the compiled server (the mismatch was invisible at `tsc --noEmit`/schema-validate time). Not a deviation from any approved architecture decision — AD-3/AD-4 say nothing about module format.
- **Eager-connect boot check uses a real query, not `$connect()`:** confirmed empirically that Prisma 7 + driver adapters treat `$connect()` as effectively a no-op for opening the underlying pool connection; `server.ts` calls `await prisma.customer.count()` at boot instead, which both fails fast on an unreachable database and makes the AC4 connection-lifecycle test meaningful.
- **Fastify's default error handler is relied on as-is** for AD-11's "returns a generic error JSON body" clause — this matches the architecture's own Consistency Conventions ("Fastify's default error envelope; no custom problem-details layer"); no custom error-handling code was added, consistent with this story's exclusions (no business logic).
- **Docker daemon dropped twice during this session** (once before Story 1.2 work began, once mid-implementation) — both times restarted via `open -a OrbStack` and confirmed ready via `docker info` before proceeding; unrelated to any code change in this story.
- No seed logic, HTTP routes, Haversine/sorting, or MCP configuration was added — confirmed by direct inspection of every file created (see File List).

### File List

**Created:**
- `prisma.config.ts` (repo root)
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260716160812_init/migration.sql`
- `apps/api/prisma/migrations/migration_lock.toml`
- `apps/api/src/db/client.ts`
- `apps/api/src/app.ts`
- `apps/api/src/server.ts`
- `apps/api/src/generated/prisma/**` (generated Prisma Client — git-ignored, reproducible via `prisma generate`)

**Modified:**
- `apps/api/src/main.ts` (placeholder `console.log` → `import './server';`)
- `package.json` (added `prisma`, `@types/pg` as dev dependencies; `@prisma/client`, `@prisma/adapter-pg`, `pg`, `dotenv`, `fastify` as dependencies)
- `pnpm-lock.yaml` (resynced)
- `pnpm-workspace.yaml` (`allowBuilds` extended for `prisma` and `@prisma/engines` postinstall scripts)
- `.gitignore` (added `apps/api/src/generated/` for the reproducible generated Prisma Client)

## Change Log

- 2026-07-16: Story 1.2 implemented — Prisma 7 schema/migration/client per the approved official architecture (`prisma.config.ts`, `prisma-client` generator with explicit output, `@prisma/adapter-pg` + `pg`), Fastify `app.ts`/`server.ts` boundary with graceful `SIGINT`/`SIGTERM` shutdown. All 4 acceptance criteria and validation commands verified, including a live before/after `pg_stat_activity` check proving the Prisma connection is genuinely released on shutdown. One build-tooling fix (`moduleFormat = "cjs"`) and one small necessary addition (`dotenv`) discovered and disclosed during implementation. Status moved to `review`.
- 2026-07-17: Applied the six approved selective review corrections — root `postinstall` script runs `prisma generate` reproducibly on a fresh install with no live database or `.env` file (`prisma.config.ts`'s datasource URL now falls back to a placeholder only `generate` ever reads, since it never opens a connection); the Prisma-disconnecting `onClose` hook moved from `buildApp()` into `server.ts`, so `buildApp()` is now Prisma-agnostic and safe to call repeatedly; the boot-failure path in `start()` now calls `app.close()` (which disconnects Prisma via the hook) before `process.exit(1)`; `shutdown()` gained a `shuttingDown` re-entrancy guard and a try/catch around `app.close()`; `db/client.ts` now throws a clear, project-specific error at startup if `DATABASE_URL` is unset. Change Log date corrected to match the migration timestamp and Debug Log evidence. Re-validated: fresh-clone `pnpm install --frozen-lockfile` with no `.env`/`DATABASE_URL` regenerated the client; `prisma migrate dev` and `\d customers` unchanged; SIGTERM and SIGINT both exit 0 with the Prisma connection released (`pg_stat_activity` before/after); an unreachable-DB boot failure exits 1 without hanging; an unset `DATABASE_URL` fails fast with the new error message; exactly one `new PrismaClient` call remains outside the generated client. Status remains `review`.
- 2026-07-17: Corrected a review misclassification — the re-entrancy guard and shutdown try/catch (both already implemented in the prior correction pass) were being conflated with an unimplemented watchdog timeout, incorrectly implying the watchdog was in scope. Per the approved decision, the watchdog-timeout suggestion is explicitly declined as disproportionate for this project and is non-blocking; no watchdog or new shutdown abstraction was added. Applied one small additional hardening: `start()`'s boot-failure path now wraps `app.close()` in its own try/catch, so a cleanup failure during a failed boot is logged separately and the process still exits deterministically with code 1, instead of risking an unhandled rejection [apps/api/src/server.ts]. Re-validated: `tsc --noEmit`, `nx build api`, SIGTERM/SIGINT clean exits with `pg_stat_activity` released, unreachable-DB boot failure exits 1, boot-failure cleanup-error branch logic verified in isolation, `grep` for `new PrismaClient` unchanged, schema unchanged. Status remains `review`; Story 1.3 not started; no staging/commit performed.
- 2026-07-17: Final review pass (three parallel layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor) run against the full diff including all prior corrections. Acceptance Auditor confirmed zero AC violations across all four criteria. Two flagged risks (unhandled `pg.Pool` idle-client errors; unused `@prisma/client` dependency) were verified false by reading `@prisma/adapter-pg`'s and the generated client's actual source — both dismissed. The already-approved shutdown decision (re-entrancy guard, explicit shutdown error handling, declined watchdog, boot-failure cleanup exiting deterministically) was reconfirmed unchanged in the code. One small unambiguous bug fixed: `prisma.config.ts`'s `DATABASE_URL` fallback used `??` instead of `||`, so an empty-string `DATABASE_URL` would not fall back to the placeholder, unlike `db/client.ts`'s stricter check [prisma.config.ts:9]. Two new low-severity, non-blocking items deferred (hardcoded port 3000 with no env override; no process-level `unhandledRejection`/`uncaughtException` handlers beyond signal handling) — see Deferred Work. **Final verdict: PASS.** Status moved to `done`.
