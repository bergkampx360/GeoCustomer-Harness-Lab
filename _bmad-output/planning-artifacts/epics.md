---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - docs/assignment.md
  - docs/technical-constraints.md
  - _bmad-output/planning-artifacts/spec-geocustomer-backend/SPEC.md
  - _bmad-output/planning-artifacts/architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md
---

# GeoCustomer-Harness-Lab - Epic Breakdown

## Overview

This document decomposes the frozen GeoCustomer backend specification (`SPEC.md` + companions) and the approved architecture spine (`ARCHITECTURE-SPINE.md`) into one small epic and seven implementation stories, each sized to a single focused, reviewable commit. No requirement is added or broadened beyond `docs/assignment.md` and `docs/technical-constraints.md`.

## Requirements Inventory

### Functional Requirements

FR1: The system exposes `GET /customers/count`, returning the exact seeded row count as `{"count": N}`. (SPEC CAP-1)
FR2: The system exposes `GET /customers/by-distance`, returning all customers ascending by distance from Budapest, each annotated with `distanceKm` rounded to one decimal; Budapest customers first at `0`; unresolved-location customers last with `null`; ties broken by `name`. (SPEC CAP-2)
FR3: The system idempotently loads the fixed seed file (`data/seed-customers.json`) and offline-geocodes each customer's settlement via a bundled local reference; an unresolvable settlement yields `null` coordinates, is logged, and does not stop processing. (SPEC CAP-3)

### NonFunctional Requirements

NFR1: The service runs fully offline — no runtime LLM calls, no external geocoding API calls, at any point.
NFR2: TypeScript strict mode; pnpm as package manager; a small Nx monorepo (single project); no frontend application.
NFR3: PostgreSQL runs locally via Docker Compose; Prisma is used for schema definition, migrations, seed, and typed database access.
NFR4: Vitest is the test framework; the Haversine distance calculation must have unit tests covering a known distance (Budapest–Vienna, ≈214 km), the zero-distance case, and null-coordinate handling.
NFR5: PostgreSQL MCP must be configured **and** actively used during development to inspect the schema, the `customers` table, the seeded row count, and sample data — configuration alone does not satisfy this.
NFR6: Small, focused, verified commits; no hidden, ignored, or bypassed failures; tests must not be weakened to pass; no secrets or the real `.env` file committed — `.env.example` provided instead.
NFR7: No authentication or authorization; no endpoint beyond the two specified `GET`s (no CRUD, no message queues, no event sourcing/CQRS, no Kubernetes, no cloud deployment, no PostGIS, no external geocoding, no runtime AI integration).

### Additional Requirements (from Architecture Spine)

- AD-1: Transaction Script paradigm — no repository/service/DDD layering; each endpoint and the seed are single top-to-bottom procedures.
- AD-2: Single Nx project (`apps/api`) — no separate lib for domain logic; internal folders provide separation instead.
- AD-3: `buildApp()` (routes, no `.listen()`) / `server.ts` (`.listen()` + shutdown) split, so tests exercise the app without a real listening server.
- AD-4: One Prisma schema, one generated client, one shared singleton (`src/db/client.ts`) used by both the server and the seed.
- AD-5: Seed idempotency enforced via a `@@unique([name, telepules, countryCode])` constraint and **upsert** — not truncate-and-reinsert.
- AD-6: One bundled settlement reference (`src/geo/settlement-coordinates.ts`) + one normalization function (accent/case/whitespace-insensitive; Budapest district aliases).
- AD-7: Haversine and sorting as pure, Fastify/Prisma-free functions in `src/domain/`.
- AD-8: Unit tests co-located with the pure modules they test; any DB-touching test is separate and optional.
- AD-9: Docker Compose with a single `postgres:16-alpine` service (frozen version) and env-var-sourced credentials.
- AD-10: `postgres-mcp` (crystaldba) via `uvx postgres-mcp --access-mode=restricted`; project-scoped, repo-committed `.mcp.json` reading `DATABASE_URL` from the environment.
- AD-11: Graceful `SIGINT`/`SIGTERM` shutdown disconnecting Prisma via `app.close()`; Fastify's default error handler, no custom envelope.

### UX Design Requirements

N/A — no frontend or UI is in scope. Explicitly excluded by `docs/technical-constraints.md` ("Do not create a frontend application") and `SPEC.md` Non-goals.

### FR Coverage Map

FR1: Epic 1 — Story 1.4 (Count Endpoint)
FR2: Epic 1 — Story 1.5 (By-Distance Endpoint with Haversine and Sorting)
FR3: Epic 1 — Story 1.3 (Idempotent Seed with Offline Location Resolution)
NFR1: Epic 1 — enforced throughout; concretely in Stories 1.3 and 1.5 (no network calls in seed or query path)
NFR2: Epic 1 — Story 1.1 (Workspace and PostgreSQL Foundation)
NFR3: Epic 1 — Stories 1.1–1.2 (Docker Compose, then Prisma schema/migration)
NFR4: Epic 1 — Story 1.5 (Haversine unit tests)
NFR5: Epic 1 — Story 1.6 (PostgreSQL MCP Integration and Verification)
NFR6: Epic 1 — every story's Validation section; closed out by Story 1.7
NFR7: Epic 1 — Stories 1.4–1.5 fix the endpoint surface at exactly two `GET`s; every story's Exclusions reinforce the excluded scope

## Epic List

### Epic 1: GeoCustomer Backend Service

Deliver a small, self-contained, offline REST service over PostgreSQL that exposes the seeded customer list's total count and its ranking by distance from Budapest, built from an idempotent, offline-geocoded seed process, with the PostgreSQL MCP actively used during development and the whole setup verified from a fresh clone.
**FRs covered:** FR1, FR2, FR3 (all NFRs apply within this single epic)

One epic only — the assignment is a single small backend service with no independent user-value domains to separate; splitting further would create epics that share the same few files with no genuine risk boundary between them (see `bmad-create-epics-and-stories` guidance on file-churn consolidation).

## Epic 1: GeoCustomer Backend Service

Deliver a small, self-contained, offline REST service over PostgreSQL that exposes the seeded customer list's total count and its ranking by distance from Budapest, built from an idempotent, offline-geocoded seed process, with the PostgreSQL MCP actively used during development and the whole setup verified from a fresh clone.

### Story 1.1: Workspace and PostgreSQL Foundation

As the developer setting up the project,
I want a working Nx/pnpm workspace and a local PostgreSQL instance running via Docker Compose,
So that every later story has a real database and a strict-TypeScript project to build against.

**Acceptance Criteria:**

**Given** a fresh clone
**When** `pnpm install` is run
**Then** dependencies install cleanly with no errors

**Given** `.env` created from a committed `.env.example`
**When** `docker compose up -d` is run
**Then** a `postgres:16-alpine` container starts and is reachable on the configured port (AD-9)

**Given** the Nx workspace
**When** its projects are listed
**Then** exactly one project (`api`) exists (AD-2)

**Given** the base `tsconfig`
**When** inspected
**Then** strict mode is enabled

**Objective:** Stand up the single-project Nx workspace and a local, Dockerized PostgreSQL 16 instance so subsequent stories build against a real database from day one.

**Scope:** pnpm + Nx workspace init (single `apps/api` project per AD-2); strict `tsconfig`; `docker-compose.yml` with one `postgres:16-alpine` service (AD-9) and a named volume; `.env.example` with placeholder `DATABASE_URL`/`PG*` vars; `.gitignore` for `.env`, `node_modules`, build output.

**Dependencies:** None — first story.

**Explicit exclusions:** No Prisma schema yet. No Fastify app or routes yet. No seed logic yet.

**Validation commands / evidence expected:** `pnpm install` succeeds; `docker compose up -d` then `docker compose ps` shows the `postgres:16-alpine` container healthy; `nx show projects` (or equivalent) lists exactly one project; `pnpm exec tsc --noEmit` succeeds against the workspace skeleton.

---

### Story 1.2: Prisma Schema, Migration, and Database Lifecycle

As the developer building the data layer,
I want the `Customer` Prisma schema migrated into Postgres and a single shared client with graceful shutdown wiring,
So that all later stories read and write through one consistent, cleanly-lifecycled database connection.

**Acceptance Criteria:**

**Given** the Prisma schema
**When** `prisma migrate dev` is run against the Dockerized Postgres
**Then** a `customers` table is created matching SPEC.md's data model (`id`, `name`, `telepules`, `lat`, `lon`, `countryCode`, optional `budget`/`note`)

**Given** the schema
**When** inspected
**Then** a unique constraint exists on `(name, telepules, countryCode)` (AD-5)

**Given** `src/db/client.ts`
**When** imported from two different modules
**Then** both receive the same singleton `PrismaClient` instance (AD-4)

**Given** the running server
**When** it receives `SIGINT` or `SIGTERM`
**Then** it calls `app.close()`, disconnects Prisma, and exits cleanly with no hanging process (AD-11)

**Objective:** Fix the database schema and the single-client lifecycle boundary before any HTTP or seed logic depends on it.

**Scope:** `apps/api/prisma/schema.prisma` (`Customer` model, `@@map("customers")`, `@@unique([name, telepules, countryCode])`); first migration; `src/db/client.ts` singleton (AD-4); minimal `src/app.ts` (`buildApp()`, no routes yet) / `src/server.ts` (`.listen()` + `SIGINT`/`SIGTERM` → `app.close()` → Prisma disconnect, per AD-3/AD-11).

**Dependencies:** Story 1.1 (workspace and running Postgres).

**Explicit exclusions:** No seed data loaded yet. No HTTP routes registered yet. No count/by-distance logic yet.

**Validation commands / evidence expected:** `pnpm exec prisma migrate dev --name init` succeeds; schema inspection (`\d customers` via psql, or MCP once available) shows the unique constraint; starting the server then sending it `SIGTERM` exits promptly (bounded time, exit code 0) with a logged shutdown message and no leaked Postgres connection (`select count(*) from pg_stat_activity` before/after).

---

### Story 1.3: Idempotent Seed with Offline Location Resolution

As the developer preparing demo data,
I want a dedicated seed command that loads `data/seed-customers.json` and offline-geocodes each customer without duplicating rows on re-run,
So that the database can be seeded repeatably with no external network calls.

**Acceptance Criteria:**

**Given** a clean, migrated database
**When** the seed command runs once
**Then** all 15 seed customers are present, with `lat`/`lon` populated for every resolvable settlement (FR3)

**Given** the seed has already run
**When** it is run a second time
**Then** the `customers` table still has exactly 15 rows — no duplicates

**Given** a settlement with varying case, accents, or surrounding whitespace
**When** seeded
**Then** it normalizes and matches its reference entry correctly (AD-6)

**Given** "Budapest" or one of its districts
**When** seeded
**Then** it resolves to the capital's coordinates

**Given** a settlement absent from the bundled reference
**When** seeded
**Then** `lat`/`lon` are `null`, the miss is logged, the process does not crash, and remaining rows continue processing

**Given** the seed logic
**When** the codebase is inspected
**Then** it is invoked only via its own dedicated command — never imported by or reachable through the HTTP server

**Objective:** Implement the idempotent, offline-only seed pipeline (CAP-3 / FR3), fully separated from the HTTP server.

**Scope:** `src/geo/settlement-coordinates.ts` (bundled reference covering the seed's cities + Budapest district aliases); `src/geo/normalize.ts` (`normalizeSettlementName()`, AD-6); `src/seed.ts` (reads the seed JSON, normalizes, looks up coordinates, logs-and-continues on a miss, upserts via the AD-5 unique constraint); a dedicated `nx run api:seed` (or equivalent pnpm script) target, separate from `serve`.

**Dependencies:** Story 1.2 (schema, migration, shared client).

**Explicit exclusions:** No HTTP endpoints exposed yet. `data/seed-customers.json` is read-only and must not be modified. No external geocoding API or other network call of any kind.

**Validation commands / evidence expected:** run the seed command twice consecutively; `SELECT count(*) FROM customers;` (via psql or the MCP, once configured) returns 15 both times; spot-check a known city's `lat`/`lon` and a deliberately-unresolvable settlement's `null` result; confirm the "settlement not found, skipped" log line appears without a crash.

---

### Story 1.4: Count Endpoint

As an API client,
I want to call `GET /customers/count`,
So that I get the exact number of seeded customers.

**Acceptance Criteria:**

**Given** a seeded database (15 rows)
**When** `GET /customers/count` is called
**Then** the response is `{"count": 15}` (FR1)

**Given** the database has been re-seeded (still idempotently 15 rows)
**When** the endpoint is called again
**Then** the count still matches exactly

**Given** the endpoint path
**When** any method other than `GET` is sent (`POST`/`PUT`/`PATCH`/`DELETE`)
**Then** no such method is registered — Fastify's default not-found/method-not-allowed behavior applies (NFR7)

**Objective:** Expose the first of the two required endpoints (CAP-1 / FR1), wired through the AD-3 app boundary.

**Scope:** `src/routes/customers.ts` registers `GET /customers/count`; handler calls `prisma.customer.count()`; route registered inside `buildApp()`.

**Dependencies:** Stories 1.2 (client) and 1.3 (seeded data to verify against).

**Explicit exclusions:** No by-distance logic yet. No authentication. No additional HTTP methods on this path.

**Validation commands / evidence expected:** after seeding, `curl http://localhost:<port>/customers/count` returns `{"count":15}`; a Vitest test using `buildApp()` in-process (AD-3, no real network listener) asserts the same response shape and value.

---

### Story 1.5: By-Distance Endpoint with Haversine and Deterministic Sorting

As an API client,
I want to call `GET /customers/by-distance`,
So that I get all customers ranked by how close they are to Budapest.

**Acceptance Criteria:**

**Given** seeded customers with resolved coordinates
**When** `GET /customers/by-distance` is called
**Then** all customers are returned ascending by their **raw, unrounded** Haversine distance, with `distanceKm` in the response rounded to one decimal for display only (FR2)

**Given** two customers whose raw distances differ but round to the same `distanceKm`
**When** `GET /customers/by-distance` is called
**Then** they still appear in raw-distance order, not reordered by name — proving the sort key is the raw distance, not the rounded display value (resolves readiness finding M-1)

**Given** a Budapest customer
**When** returned
**Then** its raw distance is `0`, `distanceKm` is `0`, and it appears first

**Given** a customer with unresolved coordinates
**When** returned
**Then** it appears after every customer with a calculable distance, with `distanceKm: null`

**Given** two customers with exactly equal **raw** distance
**When** returned
**Then** they are ordered by `name` ascending

**Given** `haversineKm`
**When** unit tested directly, with no Fastify instance and no Prisma client involved
**Then** it returns ≈214 km for Budapest–Vienna, `0` for Budapest-to-itself, and handles a null-coordinate input without throwing (NFR4, AD-7, AD-8)

**Objective:** Expose the second required endpoint (CAP-2 / FR2) using pure, independently-unit-tested Haversine and sorting logic that sorts by raw distance and rounds only for display (resolves readiness finding M-1).

**Scope:** `src/domain/distance.ts` (`haversineKm`, pure, returns the raw unrounded distance); `src/domain/sort.ts` (`sortByDistance`, pure, sorts by each customer's raw `haversineKm` result, null-last + name-tiebreak applied only on exact raw-distance equality); the route handler rounds each result to one decimal for the `distanceKm` field only after sorting; `distance.spec.ts` and `sort.spec.ts` covering the three mandatory cases plus a raw-vs-rounded ordering case.

**Dependencies:** Stories 1.2–1.4 (client, seeded data, app boundary already wired).

**Explicit exclusions:** No caching layer. No PostGIS or DB-side geospatial functions. No external geocoding at request time. No additional HTTP methods on this path.

**Validation commands / evidence expected:** `pnpm vitest run src/domain` — passes with no live database required, including a case with two customers whose rounded `distanceKm` values coincide but raw distances differ, to prove sort-before-round ordering (resolves M-1); `curl http://localhost:<port>/customers/by-distance` against seeded data, manually verifying ordering, null placement, and rounding.

---

### Story 1.6: PostgreSQL MCP Integration and Verification

As the developer working on this codebase,
I want the PostgreSQL MCP configured and actually used to inspect the live database,
So that development is grounded in the real schema and data, per the assignment's MCP requirement.

**Acceptance Criteria:**

**Given** a fresh clone with `.env` populated and Postgres running
**When** the MCP is launched per the committed project-scoped configuration
**Then** it connects successfully with no machine-specific manual edits beyond copying `.env.example` to `.env` (AD-10)

**Given** the MCP connection
**When** used during development
**Then** it is demonstrated inspecting the database schema, the `customers` table definition, the seeded row count (15), and sample seeded customer rows — not merely configured (NFR5)

**Given** `.mcp.json` and `.env.example`
**When** inspected
**Then** neither contains a password, token, or real credential

**Objective:** Satisfy the SPEC's MCP requirement in full — configured **and** actively used — using the architecture's chosen tool (AD-10).

**Scope:** repo-committed `.mcp.json` referencing `DATABASE_URL` from the environment (no inlined connection string); `postgres-mcp` (crystaldba) launched via `uvx postgres-mcp --access-mode=restricted`; a recorded verification pass showing the MCP inspecting schema, table, row count, and sample data.

**Dependencies:** Stories 1.2–1.3 (schema and seeded data must exist to inspect).

**Explicit exclusions:** No MCP write operations — restricted/read-only access mode only. The MCP is a dev-time tool, not part of the shipped service (not a runtime dependency of the server or seed process).

**Validation commands / evidence expected:** `uvx postgres-mcp --access-mode=restricted` connects using `DATABASE_URL` from `.env`; a recorded transcript or log excerpt showing schema, `customers` table, row-count (15), and sample-row inspection via the MCP.

---

### Story 1.7: Documentation and Clean-Checkout Validation

As a reviewer verifying the assignment,
I want a README that documents the full run sequence and a genuine fresh-clone dry run,
So that I can confirm the whole service works from nothing but the repository and the README.

**Acceptance Criteria:**

**Given** a fresh clone (or an equivalent clean-state simulation) with only the README as guidance
**When** every documented step is followed in order (Postgres start, migration, seed, server start, tests)
**Then** Postgres starts, the migration applies, the seed runs idempotently, the server starts, both endpoints respond correctly, and `pnpm vitest run` passes (NFR6)

**Given** the README
**When** inspected
**Then** it does not instruct committing the real `.env` file, and references `.env.example` instead

**Given** this branch's new commits
**When** inspected
**Then** no secrets or real `.env` file are present in git history

**Objective:** Close out the repository-quality bar: a README covering the full run sequence, verified end-to-end from a genuinely clean checkout.

**Scope:** `README.md` documenting: `docker compose up`, `.env` setup from `.env.example`, `prisma migrate deploy` (or `dev`), the seed command, server start, and the test command; one literal clean-checkout dry run exercising every documented step.

**Dependencies:** Stories 1.1–1.6 — this is the final integration and validation pass; no new functionality.

**Explicit exclusions:** No new functionality. Documentation and verification only.

**Validation commands / evidence expected:** a fresh `git clone` (or a clean working tree from a stash) followed only by the README, end to end; `pnpm vitest run` all green; manual `curl` checks of both endpoints against the freshly-seeded database.
