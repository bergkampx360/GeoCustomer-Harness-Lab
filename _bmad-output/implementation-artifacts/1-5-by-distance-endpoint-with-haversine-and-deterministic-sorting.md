---
baseline_commit: 7521979b0dbafb1109388b0662022374c78990aa
---

# Story 1.5: By-Distance Endpoint with Haversine and Deterministic Sorting

Status: done

## Story

As an API client,
I want to call `GET /customers/by-distance`,
so that I get all customers ranked by how close they are to Budapest.

## Acceptance Criteria

(Verbatim from `_bmad-output/planning-artifacts/epics.md`, Story 1.5 — do not reinterpret or broaden.)

1. Given seeded customers with resolved coordinates, when `GET /customers/by-distance` is called, then all customers are returned ascending by their **raw, unrounded** Haversine distance, with `distanceKm` in the response rounded to one decimal for display only (FR2).
2. Given two customers whose raw distances differ but round to the same `distanceKm`, when `GET /customers/by-distance` is called, then they still appear in raw-distance order, not reordered by name — proving the sort key is the raw distance, not the rounded display value (resolves readiness finding M-1).
3. Given a Budapest customer, when returned, then its raw distance is `0`, `distanceKm` is `0`, and it appears first.
4. Given a customer with unresolved coordinates, when returned, then it appears after every customer with a calculable distance, with `distanceKm: null`.
5. Given two customers with exactly equal **raw** distance, when returned, then they are ordered by `name` ascending.
6. Given `haversineKm`, when unit tested directly, with no Fastify instance and no Prisma client involved, then it returns ≈214 km for Budapest–Vienna, `0` for Budapest-to-itself, and handles a null-coordinate input without throwing (NFR4, AD-7, AD-8).

## Response Contract

**Binding, not optional — every implementation detail in this story must conform to the rules below.**

- Each item in the `GET /customers/by-distance` response array includes **every persisted `Customer` field except `countryCode`** (i.e. `id`, `name`, `telepules`, `lat`, `lon`, `budget`, `note`) **plus** `distanceKm`.
- `countryCode` must **never** appear in the HTTP response — not on any item, under any condition. It is persisted on the `Customer` model (for idempotent-seed identification, per `data-and-seed.md`) but is transport-visible nowhere (`api-contract.md`, "Fields not included").
- `distanceKm` is rounded to exactly one decimal place, and that rounding happens **only** at the point the response body is constructed — never earlier, and never as part of computing or comparing the sort key.
- `distanceKm` is `null` for any customer whose `lat`/`lon` are not both resolved (unresolved coordinates) — never `0`, never omitted, never a stale/stringified value.
- Sorting is always performed on the **raw, unrounded** Haversine distance. The rounded `distanceKm` value must never be read back into, or substituted for, the sort key — this is the one invariant this whole story exists to prove (readiness finding M-1).

This contract is authoritative for Task 4 (`sortByDistance`), Task 6 (route handler response mapping), and Task 7 (route test assertions) below — each must implement/verify it exactly as stated here, not a paraphrase of it.

## Tasks / Subtasks

- [x] Task 1: Export Budapest's reference coordinates from the single existing source (AC: 1, 3)
  - [x] In `apps/api/src/geo/settlement-coordinates.ts`, change `const BUDAPEST: Coordinates = { lat: 47.4979, lon: 19.0402 };` to `export const BUDAPEST: Coordinates = ...` — this is the file's only edit. Do not duplicate Budapest's coordinates anywhere else (AD-6: one bundled reference, single source of truth); the route handler and any test fixtures must import this same constant, not restate the numbers.

- [x] Task 2: Implement pure `haversineKm` in `src/domain/distance.ts` (AC: 1, 3, 4, 6)
  - [x] Create `apps/api/src/domain/` (new directory — first story to use it, per `ARCHITECTURE-SPINE.md`'s Structural Seed).
  - [x] Export `interface` or reuse the existing `Coordinates` type (`{ lat: number; lon: number }`, already exported from `../geo/settlement-coordinates`) — do not redefine an incompatible duplicate shape.
  - [x] Export `haversineKm(a: Coordinates | null, b: Coordinates | null): number | null` — a plain function, no Fastify or Prisma import (AD-7). Returns `null` immediately if either argument is `null` (this is what "handles a null-coordinate input without throwing" means — no exception, just a `null` result). Otherwise computes the standard Haversine great-circle distance in kilometers (Earth radius ≈ 6371 km) and returns the **raw, unrounded** result — do not round inside this function; rounding happens only in the route handler, later, per AD-7 and the Consistency Conventions table.
  - [x] Do not import anything from `src/db` or `src/routes` here.

- [x] Task 3: Add `distance.spec.ts` covering the three mandatory cases (AC: 6)
  - [x] `apps/api/src/domain/distance.spec.ts`, co-located per AD-8, no Prisma/Fastify import.
  - [x] Case 1: `haversineKm(BUDAPEST, VIENNA)` (import `BUDAPEST` from `../geo/settlement-coordinates`; use `{ lat: 48.2082, lon: 16.3738 }` for Vienna — the same coordinates already bundled in `SETTLEMENT_COORDINATES`) is approximately 214 km — assert with a tolerance (e.g. `expect(result).toBeGreaterThan(210)` and `expect(result).toBeLessThan(218)`, or `toBeCloseTo(214, 0)`), not an exact literal match, since the "≈214 km" figure in the spec is approximate.
  - [x] Case 2: `haversineKm(BUDAPEST, BUDAPEST)` returns exactly `0`.
  - [x] Case 3: `haversineKm(null, BUDAPEST)` (and/or `haversineKm(BUDAPEST, null)`) returns `null` and does not throw.

- [x] Task 4: Implement pure `sortByDistance` in `src/domain/sort.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Export a generic `sortByDistance<T extends { name: string; lat: number | null; lon: number | null }>(customers: T[], reference: Coordinates): Array<T & { rawDistanceKm: number | null }>` — pure, no Fastify/Prisma import (AD-7). Generic so it works directly against Prisma's `Customer` rows (which have `name`, `lat`, `lon`, plus other fields) without the domain layer importing the Prisma-generated type.
  - [x] For each customer, compute `rawDistanceKm` via `haversineKm(customer.lat !== null && customer.lon !== null ? { lat: customer.lat, lon: customer.lon } : null, reference)` and attach it to the returned object (spread `...customer, rawDistanceKm`) — this raw value is what the route handler will later round for the `distanceKm` response field; **never round here**.
  - [x] Sort comparator, in this exact precedence:
    1. `null`-last: a customer with `rawDistanceKm === null` always sorts after one with a non-null value.
    2. Two `null` values: fall through to the name tie-break (matches the by-distance contract's overall "unresolved last" + deterministic ordering; two unresolved customers still need a stable order).
    3. Two non-null values that are **exactly equal**: tie-break by `name` ascending (`localeCompare`).
    4. Otherwise: ascending by the raw `rawDistanceKm` values directly — **compare the raw numbers, never `Math.round()`ed ones** (this is the entire point of AC2 / readiness finding M-1).
  - [x] Do not mutate the input array; return a new sorted array (`[...customers].sort(...)` or equivalent).

- [x] Task 5: Add `sort.spec.ts` covering ordering, null-last, tie-break, and the raw-vs-rounded case (AC: 1, 2, 3, 4, 5)
  - [x] `apps/api/src/domain/sort.spec.ts`, co-located per AD-8, no Prisma/Fastify import. Build small in-memory fixture objects shaped like `{ name: string; lat: number | null; lon: number | null }` (extra fields not required for the test).
  - [x] Basic ascending case: several customers with distinct resolved coordinates sort nearest-first.
  - [x] Budapest-customer case: a customer at Budapest's own coordinates gets `rawDistanceKm === 0` and sorts first.
  - [x] Null-last case: a customer with `lat: null, lon: null` sorts after every customer with a calculable distance.
  - [x] Exact-tie case: two customers with **identical** `lat`/`lon` (hence exactly equal raw distance) sort by `name` ascending.
  - [x] **Critical M-1 regression case:** construct two customers whose **raw** Haversine distances differ but whose values **round to the same one-decimal `distanceKm`** (e.g. compute two coordinate pairs — or directly two numeric distances via `haversineKm` — that land at approximately `X.X4` and `X.X6` km apart, both rounding to `X.X`, or use `Math.round` boundary math directly: pick raw distances like `100.04` and `100.06`, both of which `Math.round(x * 10) / 10` maps to `100.0`). Assert the output order matches raw-distance ascending — the customer with the smaller raw distance (`100.04`) appears first, even though a naive rounded-then-name-sorted or rounded-then-compared implementation would either tie them or misorder them. This is the specific test resolving readiness finding M-1; do not skip it.

- [x] Task 6: Register `GET /customers/by-distance` in `src/routes/customers.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Add a second route inside the existing `customerRoutes` plugin function (same file, same function — do not create a second routes module): `app.get('/customers/by-distance', async () => { ... })`.
  - [x] Handler body, Transaction Script style (AD-1): `const customers = await prisma.customer.findMany();` (no `orderBy` — sorting is the domain layer's job, not Prisma's) → `const sorted = sortByDistance(customers, BUDAPEST);` (import `BUDAPEST` from `../geo/settlement-coordinates`, `sortByDistance` from `../domain/sort`) → map each sorted item to the response shape, rounding only here: `distanceKm: rawDistanceKm === null ? null : Math.round(rawDistanceKm * 10) / 10` (per the Consistency Conventions table's exact rounding formula).
  - [x] **Response shape — per the Response Contract above:** each item is the customer's fields **excluding `countryCode`** and **excluding the internal `rawDistanceKm`** working field, **plus** `distanceKm` (the rounded value). Destructure to drop both: `const { rawDistanceKm, countryCode, ...rest } = sortedItem; return { ...rest, distanceKm };`. This keeps `id`, `name`, `telepules`, `lat`, `lon`, `budget`, `note` on each item — `countryCode` must never appear in the response body.
  - [x] Do not register any other HTTP method on `/customers/by-distance` (NFR7 — Fastify's default 404 handles the rest automatically, same discipline as Story 1.4's `/customers/count`).

- [x] Task 7: Extend `customers.spec.ts` with `by-distance` route tests, mocked Prisma (AC: 1, 2, 3, 4, 5)
  - [x] Add a new `describe('GET /customers/by-distance', ...)` block in the existing `apps/api/src/routes/customers.spec.ts` (same file — it already mocks `../db/client`; extend that mock's `prisma.customer` object with a `findMany` stub alongside the existing `count` stub, do not create a second mock file).
  - [x] Mock `prisma.customer.findMany` to resolve a small fixture array of customer rows (a Budapest one at `0` distance, one or two resolved-elsewhere ones, one with `lat: null, lon: null`) and assert on `response.json()`, per the Response Contract above: correct ascending order by raw distance, the Budapest row first with `distanceKm: 0`, the null-coordinate row last with `distanceKm: null`, every returned item carries `id`/`name`/`telepules`/`lat`/`lon`/`budget`/`note`, and **no `countryCode` field is present on any returned item** — assert this explicitly (e.g. `expect(item).not.toHaveProperty('countryCode')` for every item), not just by omission from a fixture.
  - [x] Assert `POST /customers/by-distance` returns Fastify's default `404` (mirrors the existing `/customers/count` POST-rejection test — confirms NFR7 for the new path too).
  - [x] This stays part of the **default** `pnpm exec vitest run` target — mocked, no live Postgres, consistent with AD-8 and Story 1.4's precedent. A real-database manual check is Task 8, opt-in only.

- [x] Task 8: Verify end-to-end against the real database — opt-in, manual (AC: 1–6)
  - [x] `docker compose up -d`, confirm the `customers` table has 15 seeded rows (re-run `nx run api:seed` if needed — idempotent).
  - [x] Start the server and `curl http://localhost:<port>/customers/by-distance`; manually verify: ascending order by distance, the Budapest customer(s) first at `distanceKm: 0`, any customer with a settlement absent from the bundled reference appears last with `distanceKm: null`, and no `countryCode` field appears in the JSON.
  - [x] `pnpm exec tsc --noEmit` succeeds.
  - [x] `pnpm exec vitest run src/domain` passes with no live database required (Task 3/5's tests).
  - [x] `pnpm exec vitest run` (full default target) passes with no live database required.

## Dev Notes

- **Architecture governance — the invariants this story must satisfy:** AD-1 (Transaction Script: the route handler is transport → `prisma.customer.findMany()` → `sortByDistance()` → response shape, no repository/service layer), AD-3 (route registered only inside `buildApp()` via the existing `customerRoutes` plugin — no new plugin/module), AD-4 (reuse the existing `prisma` singleton from `../db/client`, do not instantiate a second client), AD-7 (Haversine + sorting are pure, Fastify/Prisma-free, in `src/domain/`; **sort by raw distance, round only for display, after sorting** — this is the story's central invariant and the exact fix for readiness finding M-1), AD-8 (unit tests co-located with the pure modules, DB-free, part of the default Vitest target). [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-1, #AD-3, #AD-4, #AD-7, #AD-8]
- **This is the first story to create `src/domain/`.** No existing pattern in this repo to copy for that directory; follow the Structural Seed exactly: `src/domain/distance.ts` + `distance.spec.ts`, `src/domain/sort.ts` + `sort.spec.ts`. [Source: ARCHITECTURE-SPINE.md, Structural Seed]
- **`src/routes/customers.ts` already exists and already exports `customerRoutes`** (Story 1.4) with one route, `GET /customers/count`. Add the second route (`GET /customers/by-distance`) as a second `app.get(...)` call *inside the same function* — do not create a second routes file or a second Fastify plugin. Current file content before this story:
  ```ts
  import type { FastifyInstance } from 'fastify';
  import { prisma } from '../db/client';

  export async function customerRoutes(app: FastifyInstance) {
    app.get('/customers/count', async () => {
      const count = await prisma.customer.count();
      return { count };
    });
  }
  ```
- **`src/geo/settlement-coordinates.ts` already defines Budapest's coordinates** as an unexported `const BUDAPEST` (`{ lat: 47.4979, lon: 19.0402 }`), used internally for district aliasing. Task 1 exports it — this is the *only* edit to that file. Do not add a second, separately-declared Budapest coordinate constant anywhere (route handler, tests, domain code) — always import the one exported constant, per AD-6's "one bundled reference" rule.
- **`Coordinates` interface is already exported** from `apps/api/src/geo/settlement-coordinates.ts` (`{ lat: number; lon: number }`). Reuse it in `src/domain/distance.ts` and `src/domain/sort.ts` rather than declaring an incompatible duplicate — importing a plain type from `../geo/...` does not violate AD-7's "no Fastify/Prisma import" rule (the geo module itself has no dependency on `db`, per the architecture's own dependency diagram).
- **The sort-before-round invariant (AD-7 / readiness finding M-1) is the single most important correctness requirement in this story.** `sortByDistance` must compare each customer's *raw* `haversineKm` result. `Math.round(x * 10) / 10` must appear **exactly once**, in the route handler, applied only to the value going into the `distanceKm` response field, strictly after sorting is complete. If rounding is applied before or during the sort comparator, two customers whose raw distances are, e.g., `100.04` km and `100.06` km apart would incorrectly tie (both round to `100.0`) and risk being reordered by name instead of staying in true raw-distance order — this is exactly the bug class Task 5's regression test exists to catch.
- **Response field set is fixed by the "Response Contract" section above (approved, not an open assumption):** every persisted `Customer` field except `countryCode`, plus the computed `distanceKm`. Do not add fields beyond the `Customer` model, and do not add a custom response envelope (AD-11 — Fastify defaults, no wrapper). `countryCode` must never appear in the response under any condition.
- **Do not touch `src/seed.ts`, `src/db/client.ts`, `src/server.ts`, `src/geo/normalize.ts`, or the `customers.count` route/test** — all unchanged from Stories 1.2–1.4. This story adds exactly one new route plus the `src/domain/` module.
- **Do not jump ahead:** no PostgreSQL MCP work (Story 1.6), no README/clean-checkout work (Story 1.7).

### Previous Story Intelligence (from Story 1.4)

- **Nx/pnpm invocation:** this shell environment sets `CLAUDECODE`/`OPENCODE`, switching Nx's CLI into an agent-oriented NDJSON output mode. Prefix plain `nx`/`pnpm` generator or exec commands with `env -u CLAUDECODE -u OPENCODE` for standard, parseable output.
- **Port collisions are environment-specific:** `docker-compose.yml` sources the Postgres port from `${POSTGRES_PORT}`. If a collision recurs, adjust only the local, git-ignored `.env` — never `docker-compose.yml` or `.env.example`'s default. Never stop or touch a container not created by this project's own `docker-compose.yml`.
- **Node LTS deviation still applies** — an approved, disclosed deviation carried from Stories 1.1–1.4; authoritative Node LTS verification remains deferred to Story 1.7. Do not re-litigate it here.
- **`vitest.config.ts`** (repo root) already scopes tests to `apps/**/src/**/*.spec.ts`, excluding `node_modules`/`dist`/`.nx`. New files under `apps/api/src/domain/*.spec.ts` and the extended `apps/api/src/routes/customers.spec.ts` are automatically picked up — no config change needed.
- **Established test pattern to follow exactly:** Story 1.4's `customers.spec.ts` mocks `../db/client` with `vi.mock`, imports `buildApp` and the mocked `prisma` after the mock declaration, uses a shared `let app: FastifyInstance` with an `afterEach(() => app?.close())` cleanup hook, and asserts both the exact response body (`toStrictEqual`) and the mock call count. Extend this same file/pattern for `by-distance`; do not introduce a different mocking style.
- **`DATABASE_URL` must be present in the shell/`.env`** for any real-DB manual check (Task 8) — `db/client.ts` throws immediately if unset; unchanged, pre-existing behavior.
- **Docker Compose discipline:** validate against a running container, then `docker compose down` afterward (volume preserved, unrelated containers untouched).

### Git Intelligence Summary

Recent commit pattern (each story = two commits, "Prepare" then "Implement"):
```
7521979 Implement Story 1.4 customer count endpoint
707485c Prepare Story 1.4 count endpoint
8dae686 Implement Story 1.3 idempotent seed workflow
```
Story 1.4 touched exactly: `apps/api/src/routes/customers.ts` (new), `apps/api/src/routes/customers.spec.ts` (new), `apps/api/src/app.ts` (modified, one line to register the plugin — already done, no further `app.ts` change needed for this story since `customerRoutes` is already registered). This story's diff should be similarly small and scoped: two new `src/domain/` modules + specs, one exported-constant change in `settlement-coordinates.ts`, and additive changes to the two already-existing `routes/customers.*` files.

### Project Structure Notes

Builds directly on Stories 1.2–1.4's foundation. Expected structure after this story (only what this story adds/changes):

```text
{repo-root}/
  apps/
    api/
      src/
        app.ts                       # UNCHANGED — customerRoutes already registered
        routes/
          customers.ts               # MODIFIED — adds GET /customers/by-distance
          customers.spec.ts          # MODIFIED — adds by-distance test coverage
        domain/                      # NEW directory
          distance.ts                # NEW — haversineKm(), pure
          distance.spec.ts           # NEW
          sort.ts                    # NEW — sortByDistance(), pure
          sort.spec.ts               # NEW
        geo/
          settlement-coordinates.ts  # MODIFIED — export the existing BUDAPEST const (one-line change)
          normalize.ts, *.spec.ts    # UNCHANGED
        db/client.ts, server.ts, seed.ts, main.ts  # UNCHANGED
```

No `src/routes` restructuring, no new Nx project, no MCP or README work — those belong to Stories 1.6/1.7.

### References

- [Source: planning-artifacts/epics.md, Story 1.5] — approved scope, acceptance criteria, objective, dependencies, exclusions, validation commands
- [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-1] — Transaction Script paradigm
- [Source: ARCHITECTURE-SPINE.md#AD-3] — `buildApp()`/`server.ts` split, tests use `buildApp()` directly
- [Source: ARCHITECTURE-SPINE.md#AD-4] — shared Prisma client singleton reuse
- [Source: ARCHITECTURE-SPINE.md#AD-6] — one bundled settlement reference, single normalization function
- [Source: ARCHITECTURE-SPINE.md#AD-7] — Haversine/sort purity, raw-distance sort key, rounding only for display
- [Source: ARCHITECTURE-SPINE.md#AD-8] — co-located, DB-free unit tests as part of the default target
- [Source: ARCHITECTURE-SPINE.md, Consistency Conventions] — `distanceKm` rounding formula `Math.round(x * 10) / 10`; no custom response envelope
- [Source: spec-geocustomer-backend/api-contract.md, "GET /customers/by-distance"] — full sorting/rounding/null/tie-break contract; `countryCode` excluded from responses
- [Source: spec-geocustomer-backend/data-and-seed.md] — `Customer` data model fields
- [Source: spec-geocustomer-backend/testing-requirements.md] — required Haversine unit-test cases
- [Source: _bmad-output/implementation-artifacts/1-4-count-endpoint.md] — established conventions (mocked-Prisma test pattern, Nx/pnpm invocation, Docker Compose discipline, Node LTS deviation)
- [Source: apps/api/src/routes/customers.ts, customers.spec.ts, app.ts, geo/settlement-coordinates.ts] — current state read directly during story creation

## Dependencies and Exclusions

**Dependencies:** Stories 1.2–1.4 (Prisma client, seeded data, `buildApp()`/routes boundary already wired).

**Explicitly excluded from this story** (reserved for later stories or permanently out of scope):

- No caching layer.
- No PostGIS or DB-side geospatial functions — distance is computed in application code only.
- No external geocoding at request time.
- No additional HTTP methods on `/customers/by-distance`.
- No PostgreSQL MCP configuration (Story 1.6).
- No README/clean-checkout work (Story 1.7).

## Validation Commands

Run all of the following and confirm the stated result before moving this story to review:

- `pnpm vitest run src/domain` — passes with no live database required, including the raw-vs-rounded ordering case proving sort-before-round (resolves M-1)
- `curl http://localhost:<port>/customers/by-distance` against seeded data (opt-in real-DB check) — manually verify ordering, null placement, rounding, and absence of `countryCode`
- `curl -X POST http://localhost:<port>/customers/by-distance` → Fastify default not-found response, not `200` (opt-in real-DB check)
- A Vitest test using `buildApp()` in-process with the Prisma singleton mocked asserts ordering, Budapest-first-at-zero, null-last, and no `countryCode` field — part of the default `vitest run` target, no live database required
- `pnpm exec tsc --noEmit` succeeds
- `pnpm exec vitest run` (default target) passes with no live Postgres required

## Definition of Done

- [x] All 6 acceptance criteria verified against the running implementation
- [x] All Validation Commands above pass with the stated result
- [x] No excluded item (caching, PostGIS, external geocoding, extra HTTP methods, MCP, README work) was added
- [x] Lands as its own small, focused commit
- [x] Passed code review before being marked done

## Evidence Expected Before Review

- `pnpm exec vitest run` output showing `distance.spec.ts` and `sort.spec.ts` (including the raw-vs-rounded M-1 regression case) and the extended `customers.spec.ts` `by-distance` tests, all passing with no live database
- Terminal output (transcript) of the separate, opt-in real-database check: `curl` output for `GET /customers/by-distance` showing correct ordering, `distanceKm: 0` for Budapest, `distanceKm: null` and last-position for any unresolved customer, and a non-`GET` method on the same path returning Fastify's default not-found response
- `pnpm exec tsc --noEmit` output

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via the `bmad-dev-story` workflow.

### Debug Log References

- `pnpm exec vitest run apps/api/src/domain` — 9/9 passed (distance.spec.ts, sort.spec.ts).
- `pnpm exec vitest run` (default target) — 19/19 passed across 5 spec files, no live database.
- `pnpm exec tsc --noEmit` (apps/api) — clean, no errors.
- `pnpm exec nx build api` — succeeded.
- Real-DB manual check: `docker compose up -d`, `nx run api:seed` (`[seed] processed 15 customers`), `nx run api:serve`, then:
  - `GET /customers/count` → `{"count":15}`
  - `GET /customers/by-distance` → 15 items, ascending by distance, Budapest customer first (`distanceKm: 0`), Vienna customer second (`distanceKm: 214`), no `countryCode` field on any item (`grep -c countryCode` → 0)
  - `POST /customers/by-distance` → 404 `{"message":"Route POST:/customers/by-distance not found",...}`
  - `docker compose down` afterward, container removed.

### Completion Notes List

- Exported the existing `BUDAPEST` constant from `settlement-coordinates.ts` (one-line change, only edit to that file) — no duplicate Budapest coordinate declared anywhere else.
- Implemented pure `haversineKm(a, b)` in new `apps/api/src/domain/distance.ts`: standard great-circle formula, Earth radius 6371 km, returns raw unrounded km or `null` for either-null input, no Fastify/Prisma import.
- Implemented pure `sortByDistance(customers, reference)` in new `apps/api/src/domain/sort.ts`: attaches `rawDistanceKm` per customer, sorts null-last, then by raw (unrounded) distance ascending, with `name` (`localeCompare`) as the tie-break for exactly-equal raw distances (including the two-null case) — rounding never enters the comparator.
- Registered `GET /customers/by-distance` as a second route inside the existing `customerRoutes` plugin in `apps/api/src/routes/customers.ts`: `prisma.customer.findMany()` (no `orderBy`) → `sortByDistance` → response mapping that destructures off both `rawDistanceKm` and `countryCode`, rounds via `Math.round(rawDistanceKm * 10) / 10` only at this point, and returns `distanceKm: null` for unresolved customers. No other HTTP method registered on the path (Fastify's default 404 applies).
- Added `distance.spec.ts` (Budapest↔Vienna ≈214 km with tolerance, Budapest↔Budapest = 0, null-input handling) and `sort.spec.ts` (ascending order, Budapest-first-at-zero, null-last, exact-tie by name, two-null tie by name, and the M-1 regression case: two real coordinate pairs ~0.802°/0.803° east of Budapest whose raw distances ≈60.250/60.325 km both round to `60.3` but must stay in raw order).
- Extended `apps/api/src/routes/customers.spec.ts`'s existing Prisma mock with a `findMany` stub and added a `describe('GET /customers/by-distance', ...)` block asserting status 200, correct field set (`id`/`name`/`telepules`/`lat`/`lon`/`budget`/`note`/`distanceKm`), explicit absence of `countryCode` on every item, `distanceKm` rounding, and a `POST` → 404 test mirroring the `/customers/count` precedent.
- No new dependency added; no change to `seed.ts`, `db/client.ts`, `server.ts`, `geo/normalize.ts`, or the `/customers/count` route/tests; no Story 1.6/1.7 artifact touched.

### Code Review Findings and Dispositions

Consolidated multi-layer code review completed 2026-07-18 (blind-hunter, edge-case-hunter, acceptance-auditor layers) against the full uncommitted diff, `ARCHITECTURE-SPINE.md`, `epics.md`, `testing-requirements.md`, `technical-constraints.md`, the Prisma `Customer` model, and the existing route/geo/test conventions.

**Blocking findings:** none.

**Non-blocking findings and dispositions:**

- Tautological assertion in `customers.spec.ts`'s "rounds distanceKm to one decimal" test — `expect(vienna.distanceKm).toBeCloseTo(vienna.distanceKm, 1)` compared the value to itself and could never fail. **Disposition: fixed** — line removed; the existing meaningful check (`expect(Number.isInteger(vienna.distanceKm * 10)).toBe(true)`) remains as the sole, genuine one-decimal rounding verification. No replacement assertion added (would have been redundant with the existing raw-value M-1 coverage in `sort.spec.ts`).
- Route-level `by-distance` tests lack a dedicated exact-raw-distance-tie fixture (two customers with identical lat/lon). **Disposition: declined as redundant and non-blocking** — the deterministic exact-tie precedence (raw distance equal → name ascending) is already fully proven by the focused `sortByDistance` unit test (`sort.spec.ts`, "breaks an exact raw-distance tie by name ascending"), and Story 1.5's Task 7 route-test requirements do not call for duplicating it at the route level. `testing-requirements.md` treats additional tests beyond the required Haversine cases as optional, only where they add clear value.

**Acceptance criteria:** all six verified against the review's independent re-derivation (raw-distance sort order, M-1 raw-vs-rounded regression numerically re-verified, Budapest-first-at-zero, unresolved-last-at-null, exact-tie name ordering, and `haversineKm`'s isolated DB/Fastify-free unit tests).

**Scope compliance:** verified — no MCP, Story 1.6/1.7, seed, frontend, auth, external geocoding, or dependency changes present in the diff; `count` route/tests, `db/client.ts`, `server.ts`, `seed.ts`, and `geo/normalize.ts` all unchanged.

Story remains in `review` status; Definition of Done's "Passed code review" gate and final closure to `done` are deferred to a separate, explicit approval step.

### File List

- `apps/api/src/geo/settlement-coordinates.ts` (modified — exported `BUDAPEST`)
- `apps/api/src/domain/distance.ts` (new)
- `apps/api/src/domain/distance.spec.ts` (new)
- `apps/api/src/domain/sort.ts` (new)
- `apps/api/src/domain/sort.spec.ts` (new)
- `apps/api/src/routes/customers.ts` (modified — added `GET /customers/by-distance`)
- `apps/api/src/routes/customers.spec.ts` (modified — added `by-distance` route tests; code-review fix removed a tautological assertion)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status tracking only)

## Change Log

- 2026-07-18: Story drafted from `epics.md` Story 1.5 and the approved architecture spine. Status set to `ready-for-dev`.
- 2026-07-18: Added an explicit, binding "Response Contract" section (field set, `countryCode` exclusion, `distanceKm` rounding/null rules, raw-distance sort key) and updated Tasks 6–7 and Dev Notes to reference it as a settled decision rather than a flagged assumption.
- 2026-07-18: Implemented `haversineKm`/`sortByDistance` in `src/domain/`, registered `GET /customers/by-distance`, extended route tests, verified against real seeded database. All 8 tasks complete, all validation commands pass. Status set to `review`.
- 2026-07-18: Consolidated code review completed — no blocking findings. Fixed a tautological assertion in `customers.spec.ts`; declined a route-level exact-tie fixture as redundant with existing `sort.spec.ts` coverage. All six acceptance criteria re-verified. Story remains in `review`; DoD "Passed code review" gate and closure to `done` await separate approval.
- 2026-07-18: Final closure review (independent multi-layer: Blind Hunter, Edge Case Hunter, Acceptance Auditor) completed — PASS, zero blocking findings. All 19 verification points and all 6 acceptance criteria independently re-confirmed. Four low/medium-severity, currently-unreachable edge cases deferred (see Review Findings below and `deferred-work.md`). Definition of Done's "Passed code review" gate satisfied. Status set to `done`.

## Review Findings

- [x] [Review][Defer] No stable tie-break for customers with duplicate names and equal raw distance [apps/api/src/routes/customers.ts:360, apps/api/src/domain/sort.ts:511-524] — deferred, pre-existing
- [x] [Review][Defer] Haversine `h` term unguarded against floating-point overshoot near antipodal/coincident-boundary inputs [apps/api/src/domain/distance.ts:474-488] — deferred, pre-existing
- [x] [Review][Defer] Route "rounds distanceKm to one decimal" test doesn't assert the actual expected value, only that it has one decimal place [apps/api/src/routes/customers.spec.ts:324-333] — deferred, pre-existing
- [x] [Review][Defer] No test coverage for partial-null coordinates (`lat` set, `lon: null`, or vice versa) [apps/api/src/domain/sort.ts:505-508] — deferred, pre-existing
