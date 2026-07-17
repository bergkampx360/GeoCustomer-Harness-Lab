---
baseline_commit: 8dae6862ff9609fd66e4026da47f0a1d71f19969
---

# Story 1.4: Count Endpoint

Status: ready-for-dev

## Story

As an API client,
I want to call `GET /customers/count`,
so that I get the exact number of seeded customers.

## Acceptance Criteria

(Verbatim from `_bmad-output/planning-artifacts/epics.md`, Story 1.4 — do not reinterpret or broaden.)

1. Given a seeded database (15 rows), when `GET /customers/count` is called, then the response is `{"count": 15}` (FR1).
2. Given the database has been re-seeded (still idempotently 15 rows), when the endpoint is called again, then the count still matches exactly.
3. Given the endpoint path, when any method other than `GET` is sent (`POST`/`PUT`/`PATCH`/`DELETE`), then no such method is registered — Fastify's default not-found/method-not-allowed behavior applies (NFR7).

## Tasks / Subtasks

- [ ] Task 1: Create the routes module and register the count route (AC: 1, 3)
  - [ ] Create `apps/api/src/routes/customers.ts` exporting a Fastify plugin/register function (e.g. `async function customerRoutes(app: FastifyInstance) { ... }`) — this is the first file in `src/routes/`, so there is no existing pattern in this repo to copy; follow AD-1 (Transaction Script: transport → domain/db call → response shape, no extra layers) and AD-3 (registered only inside `buildApp()`, never in `server.ts`)
  - [ ] Register exactly one route: `GET /customers/count`
  - [ ] Handler body: `const count = await prisma.customer.count();` then reply with `{ count }` — a plain object, Fastify serializes it to JSON automatically; no manual `JSON.stringify`, no custom envelope (AD-11: default Fastify behavior, no custom error/response wrapper)
  - [ ] Import the shared Prisma client from `../db/client` (`import { prisma } from '../db/client'`) — do not instantiate a second `PrismaClient` (AD-4)
  - [ ] Do **not** register any other HTTP method on `/customers/count` — Fastify only matches routes you explicitly register, so simply not adding `POST`/`PUT`/`PATCH`/`DELETE` handlers satisfies AC3 (Fastify's default 404 applies automatically to unregistered method+path combinations)
- [ ] Task 2: Wire the route into `buildApp()` (AC: 1, 3)
  - [ ] Modify `apps/api/src/app.ts`: import `customerRoutes` (or equivalent) from `./routes/customers` and register it on the Fastify instance before returning it (e.g. `app.register(customerRoutes)` or call the function directly with the instance — pick whichever matches the plugin/function shape chosen in Task 1)
  - [ ] `buildApp()` must still return a fully-configured instance with **no** `.listen()` call — that discipline is unchanged from Story 1.2/1.3 (AD-3)
  - [ ] Do not touch `server.ts` beyond what's already there — it already calls `buildApp()` and wires shutdown; no changes needed for this story
- [ ] Task 3: Add the required Vitest test — mocked Prisma, default target stays database-free (AC: 1, 3)
  - [ ] Create `apps/api/src/routes/customers.spec.ts` exercising `buildApp()` in-process (AD-3), using Fastify's `app.inject({ method: 'GET', url: '/customers/count' })`
  - [ ] Mock the existing `../db/client` module's `prisma` singleton (e.g. Vitest's `vi.mock('../db/client', ...)` stubbing `prisma.customer.count` to resolve `15`) — do not connect to a real database and do not instantiate a second `PrismaClient`
  - [ ] Assert the exact response: status `200` and body deep-equal to `{"count": 15}`
  - [ ] Assert that `POST /customers/count` returns Fastify's default 404 (`app.inject({ method: 'POST', url: '/customers/count' })` → `statusCode === 404`) — confirms AC3
  - [ ] This mocked test is part of the **default** `pnpm exec vitest run` target — it must pass with no live Postgres, consistent with AD-8 and Story 1.3's existing `vitest.config.ts` scoping (all specs currently DB-free)
  - [ ] Verification against the **real** seeded PostgreSQL database is a separate, opt-in concern — see Task 4 (manual/scripted, not a Vitest file, not part of the default test target)
- [ ] Task 4: Verify the whole story end-to-end against the real database — opt-in, manual (AC: 1–3)
  - [ ] `docker compose up -d`, confirm migration is applied, run `nx run api:seed` (idempotent — safe to re-run) so the `customers` table has exactly 15 rows
  - [ ] Start the server (`nx run api:serve` or run the built output) and `curl http://localhost:3000/customers/count` → confirm `{"count":15}`
  - [ ] Re-run `nx run api:seed` a second time, then `curl` the endpoint again → confirm the count is still exactly `15` (AC2 — proves the endpoint reflects live state, not a cached value)
  - [ ] `curl -X POST http://localhost:3000/customers/count` → confirm a 404/Fastify default not-found response, not a 200 (AC3)
  - [ ] `pnpm exec tsc --noEmit` (workspace-wide or scoped to `apps/api`) succeeds
  - [ ] `pnpm exec vitest run` passes with no live Postgres required for the default target (the mocked test from Task 3 is what runs here; this real-DB pass is a separate, manual curl-based check, not an additional Vitest file)

## Dev Notes

- **Architecture governance:** AD-1 (Transaction Script — the route handler is one top-to-bottom function: transport → `prisma.customer.count()` → response shape; no repository/service layer), AD-3 (routes registered only inside `buildApp()`, never via `.listen()`; tests call `buildApp()` directly), AD-4 (reuse the existing `src/db/client.ts` singleton — do not instantiate a second `PrismaClient`) are the three invariants this story exists to satisfy. [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-1, #AD-3, #AD-4]
- **This is the first story to touch `src/routes/` and `app.ts`'s body.** `apps/api/src/app.ts` currently is exactly:
  ```ts
  import Fastify from 'fastify';

  export function buildApp() {
    return Fastify({ logger: true });
  }
  ```
  No routes are registered yet. This story adds the first one. Do not restructure `buildApp()`'s signature or add options beyond what's needed to register the route.
- **`src/server.ts` and `src/db/client.ts` are already correct and complete — read, do not modify.** `server.ts` already calls `buildApp()`, wires `onClose` to disconnect Prisma, does a real fail-fast query (`prisma.customer.count()`) before `.listen()`, and handles `SIGINT`/`SIGTERM`. `db/client.ts` already exports the single lazily-created `prisma` singleton (via `@prisma/adapter-pg`) and throws if `DATABASE_URL` is unset. Nothing in this story requires changing either file.
- **AC3 needs no explicit rejection code.** Fastify only routes what you register — simply registering `GET` (and nothing else) on `/customers/count` is sufficient; Fastify's built-in 404 handles every other method automatically. Do not add a manual 405/method-not-allowed handler; that would be unnecessary ceremony the architecture spine's Transaction Script paradigm and NFR7 ("no endpoint beyond the two specified `GET`s") argue against.
- **Response shape is the plain object `{ count: N }`, `N` a JS number** — Fastify serializes objects returned from (or passed to `reply.send()` in) a handler to JSON automatically. No custom envelope, per AD-11 and the Consistency Conventions table ("Fastify's default error envelope; no custom problem-details layer" — the same "no extra wrapper" spirit applies to success responses).
- **Do not jump ahead:** no Haversine/distance/sorting logic yet (Story 1.5's `src/domain/`), no MCP configuration yet (Story 1.6). This story adds exactly one route.
- **Approved testing direction (resolves the epics.md validation text vs. AD-8 tension):** the epics.md validation text calls for "a Vitest test using `buildApp()` in-process... asserts the same response shape and value." This is satisfied by **mocking** the existing `src/db/client.ts` Prisma singleton in `customers.spec.ts` (Task 3) — the mocked test asserts the exact `{"count": 15}` response and is part of the **default** `vitest run` target, staying consistent with AD-8 (no live-DB test in the default required target) and Story 1.3's established DB-free `vitest.config.ts` scoping. Verification against the real seeded PostgreSQL database happens separately, as a manual/opt-in check (Task 4) — never as an additional Vitest spec file, and never folded into the default test target.

### Previous Story Intelligence (from Story 1.3)

- **Nx/pnpm invocation:** this shell environment sets `CLAUDECODE`/`OPENCODE`, switching Nx's CLI into an agent-oriented NDJSON output mode. Prefix plain `nx`/`pnpm` generator or exec commands with `env -u CLAUDECODE -u OPENCODE` for standard, parseable output.
- **Port collisions are environment-specific:** `docker-compose.yml` sources the Postgres port from `${POSTGRES_PORT}` because host port 5432 may already be bound by an unrelated container. If it recurs, adjust only the local, git-ignored `.env` — never `docker-compose.yml` or `.env.example`'s default. Never stop or touch a container not created by this project's own `docker-compose.yml` (watch for `superpowers-db-1`, `plantbase-pg` in this environment).
- **Node LTS deviation still applies:** this environment's only available `node` is a non-LTS release with no version manager available. This is an approved, disclosed deviation carried from Stories 1.1–1.3 — do not re-litigate it; authoritative Node 24 LTS verification remains deferred to Story 1.7.
- **`vitest.config.ts` already scopes tests to `apps/**/src/**/*.spec.ts`, excluding `node_modules`/`dist`/`.nx`** (added in Story 1.3 to avoid picking up stale Nx build-cache artifacts). A new `apps/api/src/routes/customers.spec.ts` will automatically be picked up by this existing config — no config change needed.
- **`DATABASE_URL` must be present in the shell/`.env`** — `db/client.ts` throws immediately if it's unset; existing behavior, not something to change here.
- **Docker Compose discipline:** validate against a running container, then `docker compose down` afterward (volume preserved, unrelated containers untouched). Established in Stories 1.1–1.3, expected to continue.

### Project Structure Notes

Builds directly on Stories 1.2/1.3's foundation (`apps/api/src/db/client.ts`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, seeded `customers` table). Expected structure after this story (only what this story adds):

```text
{repo-root}/
  apps/
    api/
      src/
        app.ts                       # MODIFIED — registers the new routes module
        routes/
          customers.ts               # NEW — GET /customers/count
          customers.spec.ts          # NEW — in-process test via buildApp()/app.inject()
        server.ts, main.ts, seed.ts  # UNCHANGED
        db/
          client.ts                  # UNCHANGED — reused as-is
        geo/                         # UNCHANGED (Story 1.3)
```

No `src/domain/` yet — that belongs to Story 1.5.

### References

- [Source: planning-artifacts/epics.md, Story 1.4] — approved scope, acceptance criteria, objective, dependencies, exclusions, validation commands
- [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-1] — Transaction Script paradigm
- [Source: ARCHITECTURE-SPINE.md#AD-3] — `buildApp()`/`server.ts` split, tests use `buildApp()` directly
- [Source: ARCHITECTURE-SPINE.md#AD-4] — shared Prisma client singleton reuse
- [Source: ARCHITECTURE-SPINE.md#AD-8] — DB-touching tests are separate/optional, not part of the default required test target
- [Source: ARCHITECTURE-SPINE.md#AD-11] — no custom response/error envelope; Fastify defaults
- [Source: spec-geocustomer-backend/api-contract.md, "GET /customers/count"] — exact response shape `{"count": 15}`
- [Source: spec-geocustomer-backend/testing-requirements.md] — Vitest is the test framework
- [Source: _bmad-output/implementation-artifacts/1-3-idempotent-seed-with-offline-location-resolution.md] — established conventions (Nx/pnpm invocation, Docker Compose discipline, Node LTS deviation, existing `db/client.ts`/`vitest.config.ts` to reuse verbatim)
- [Source: apps/api/src/app.ts, src/server.ts, src/db/client.ts] — current state read directly during story creation

## Dependencies and Exclusions

**Dependencies:** Story 1.2 (Prisma client), Story 1.3 (seeded data to verify against).

**Explicitly excluded from this story** (reserved for later stories):

- No by-distance logic (Story 1.5)
- No authentication
- No additional HTTP methods on `/customers/count`
- No PostgreSQL MCP configuration (Story 1.6)

## Validation Commands

Run all of the following and confirm the stated result before moving this story to review:

- After seeding, `curl http://localhost:<port>/customers/count` returns `{"count":15}` (opt-in real-DB check)
- Re-seed (idempotently), then `curl` again → still `{"count":15}` (opt-in real-DB check)
- `curl -X POST http://localhost:<port>/customers/count` → Fastify default not-found response, not `200` (opt-in real-DB check)
- A Vitest test using `buildApp()` in-process with the Prisma singleton mocked asserts the exact `{"count": 15}` response and that `POST` returns 404 — part of the default `vitest run` target, no live database required
- `pnpm exec tsc --noEmit` succeeds
- `pnpm exec vitest run` (default target) passes with no live Postgres required

## Definition of Done

- [ ] All 3 acceptance criteria verified against the running implementation
- [ ] All Validation Commands above pass with the stated result
- [ ] No excluded item (by-distance logic, auth, extra HTTP methods, MCP) was added
- [ ] Lands as its own small, focused commit
- [ ] Passed code review before being marked done

## Evidence Expected Before Review

- `pnpm exec vitest run` output showing the mocked `customers.spec.ts` test asserting `{"count": 15}` and the `POST` → 404 case, passing with no live database
- Terminal output (transcript) of the separate, opt-in real-database check: `curl`/`app.inject` results for `GET /customers/count` before and after a re-seed, both `{"count":15}`, and a non-`GET` method on the same path returning Fastify's default not-found response
- `pnpm exec tsc --noEmit` output

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-17: Story drafted from `epics.md` Story 1.4 and the approved architecture spine. Status set to `ready-for-dev`.
- 2026-07-17: Testing direction approved and incorporated: the default Vitest target stays database-free; the route test mocks the existing Prisma singleton and asserts the exact `{"count": 15}` response; real-database verification is a separate, opt-in check (Task 4), never part of the default required Vitest target.
