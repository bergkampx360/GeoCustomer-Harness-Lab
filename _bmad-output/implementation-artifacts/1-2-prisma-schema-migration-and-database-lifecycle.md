# Story 1.2: Prisma Schema, Migration, and Database Lifecycle

Status: ready-for-dev

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

- [ ] Task 1: Install and initialize Prisma (AC: 1)
  - [ ] Add `prisma` (dev dependency) and `@prisma/client` (dependency) via pnpm — this is the story's own required technology (SPEC `technical-stack.md`, `technical-constraints.md`), not an out-of-scope addition
  - [ ] Initialize `apps/api/prisma/schema.prisma` with the `datasource` reading `DATABASE_URL` from the environment (already defined in `.env.example`/`.env` from Story 1.1 — no changes needed there)
  - [ ] Verify the current Prisma client generator syntax against Prisma's own docs before wiring it (Prisma's generator conventions have changed across major versions — do not assume an older syntax from training data)
- [ ] Task 2: Define the `Customer` model (AC: 1, 2)
  - [ ] Fields, matching `data-and-seed.md` verbatim — do not rename: `id`, `name`, `telepules`, `lat` (nullable), `lon` (nullable), `countryCode`, optional `budget`, optional `note`
  - [ ] `@@map("customers")` table mapping
  - [ ] `@@unique([name, telepules, countryCode])` constraint (AD-5 — the seed's idempotency key; do not substitute a different key)
- [ ] Task 3: Run the first migration against the Dockerized Postgres (AC: 1)
  - [ ] Ensure Story 1.1's Postgres container is running (`docker compose up -d`) before migrating
  - [ ] `pnpm exec prisma migrate dev --name init`
  - [ ] Confirm the `customers` table and the unique constraint exist (e.g. `\d customers` via `psql`, or the container's own `psql` client)
- [ ] Task 4: Shared Prisma client singleton (AC: 3)
  - [ ] `src/db/client.ts` exports one lazily-created `PrismaClient` instance
  - [ ] No other file instantiates `PrismaClient` directly — grep the tree to confirm before finishing
- [ ] Task 5: Fastify app boundary skeleton and graceful shutdown (AC: 4)
  - [ ] `src/app.ts` exports `buildApp()` — a fully-configured Fastify instance, **no routes registered yet**, no `.listen()` call (routes are Stories 1.4/1.5)
  - [ ] `src/server.ts` is the only file that calls `buildApp().listen(...)`; registers `SIGINT`/`SIGTERM` handlers that call `app.close()` (which, via Fastify's `onClose` hook, disconnects the shared Prisma client) before the process exits
  - [ ] `src/main.ts` becomes a one-line shim (`import './server';`) — Nx's existing `build`/`serve` targets already point at `main.ts` as the entrypoint (see `apps/api/project.json`); this keeps that wiring intact without editing Nx config, while still satisfying AD-3's `app.ts`/`server.ts` split. Replace the current placeholder (`console.log('Hello World');`) accordingly.
- [ ] Task 6: Verify the whole story end-to-end (AC: 1–4)
  - [ ] Run every command in Validation Commands below and confirm each stated result

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

- [ ] All 4 acceptance criteria verified against the running implementation
- [ ] All Validation Commands above pass with the stated result
- [ ] No excluded item (seed logic, HTTP routes, Haversine/sorting, MCP, unrelated business logic) was added
- [ ] Lands as its own small, focused commit
- [ ] Passed code review before being marked done

## Evidence Expected Before Review

- Terminal output (or transcript) of `prisma migrate dev`, the `\d customers` schema inspection, and the `SIGTERM` shutdown test, each showing the expected result above
- Confirmation (via `grep`) that exactly one file constructs `PrismaClient`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
