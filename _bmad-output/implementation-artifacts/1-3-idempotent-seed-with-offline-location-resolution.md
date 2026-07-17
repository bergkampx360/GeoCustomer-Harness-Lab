---
baseline_commit: e0f8bb9bfec5fcb3118c2d89214705a5a1e7b11c
---

# Story 1.3: Idempotent Seed with Offline Location Resolution

Status: done

## Story

As the developer preparing demo data,
I want a dedicated seed command that loads `data/seed-customers.json` and offline-geocodes each customer without duplicating rows on re-run,
so that the database can be seeded repeatably with no external network calls.

## Acceptance Criteria

(Verbatim from `_bmad-output/planning-artifacts/epics.md`, Story 1.3 — do not reinterpret or broaden.)

1. Given a clean, migrated database, when the seed command runs once, then all 15 seed customers are present, with `lat`/`lon` populated for every resolvable settlement (FR3).
2. Given the seed has already run, when it is run a second time, then the `customers` table still has exactly 15 rows — no duplicates.
3. Given a settlement with varying case, accents, or surrounding whitespace, when seeded, then it normalizes and matches its reference entry correctly (AD-6).
4. Given "Budapest" or one of its districts, when seeded, then it resolves to the capital's coordinates.
5. Given a settlement absent from the bundled reference, when seeded, then `lat`/`lon` are `null`, the miss is logged, the process does not crash, and remaining rows continue processing.
6. Given the seed logic, when the codebase is inspected, then it is invoked only via its own dedicated command — never imported by or reachable through the HTTP server.

## Tasks / Subtasks

- [x] Task 1: Build the offline settlement-coordinate reference (AC: 1, 3, 4)
  - [x] Create `apps/api/src/geo/settlement-coordinates.ts` exporting a plain map keyed by a **normalized** settlement name → `{ lat: number; lon: number }` (AD-6 — "plain exported map, not a DB table")
  - [x] Cover exactly the 15 distinct cities present in `data/seed-customers.json` (see the reference table in Dev Notes below — do not invent extra cities, do not omit any)
  - [x] Add Budapest district/`kerület` aliases (e.g. "I. kerület" … "XXIII. kerület", and/or "Budapest I" style variants) resolving to the same Budapest coordinates — AC4's "optional" clause; include at least a couple of common forms since AD-6 explicitly calls for this
  - [x] Keys in the map must already be in normalized form so lookups are a direct match against `normalizeSettlementName()`'s output (Task 2)
- [x] Task 2: Implement settlement-name normalization (AC: 3, 4)
  - [x] Create `apps/api/src/geo/normalize.ts` exporting `normalizeSettlementName(input: string): string`
  - [x] Implementation per AD-6: Unicode NFD-normalize, strip diacritics (`.normalize('NFD').replace(/[̀-ͯ]/g, '')`), lowercase, trim — in that order so accents are stripped before case-folding
  - [x] Must be pure — no Prisma, no Fastify, no I/O (AD-7/AD-8 pattern applied consistently to `src/geo` as well as `src/domain`)
  - [x] Recommended (not AC-gating, but cheap and valuable per `testing-requirements.md`'s "additional focused tests... when they provide clear value"): co-located `apps/api/src/geo/normalize.spec.ts` covering an accented/mixed-case/whitespace-padded input and a plain-ASCII input
- [x] Task 3: Implement the seed script (AC: 1, 2, 3, 4, 5)
  - [x] Create `apps/api/src/seed.ts`
  - [x] Read `data/seed-customers.json` (repo-root `data/`, **read-only — must not be modified**) using a path resolution strategy that is correct for however the script is actually invoked (see the critical pitfall in Dev Notes — verify this empirically, do not assume)
  - [x] For each of the 15 entries: normalize `location.city` via `normalizeSettlementName()`, look it up in `settlement-coordinates.ts`
  - [x] On a hit: use the resolved `{ lat, lon }`
  - [x] On a miss: `lat`/`lon` = `null`; log a clear line identifying the unresolved settlement (e.g. `console.warn('[seed] settlement not found, skipping geocode: "<original city>"')`); do **not** throw; continue to the next row (AC5)
  - [x] Store `telepules` as the seed's original, verbatim `location.city` string (not the normalized form) — normalization is a matching aid only, per `data-and-seed.md`; the normalized form is never persisted
  - [x] Persist via `prisma.customer.upsert()` keyed on the exact `(name, telepules, countryCode)` combination — the AD-5 unique constraint Story 1.2 created — never truncate-and-reinsert
  - [x] Import the shared client from `src/db/client.ts` (`import { prisma } from './db/client'`) — do not instantiate a second `PrismaClient`
  - [x] After processing all rows, `await prisma.$disconnect()` and let the process exit cleanly (this is a one-shot script, not a long-running server — no Fastify, no `app.ts`/`server.ts` import of any kind, per AC6)
- [x] Task 4: Wire a dedicated seed command, separate from `serve` (AC: 6)
  - [x] Add a `seed` target to `apps/api/project.json`, invocable as `nx run api:seed` (or `pnpm exec nx run api:seed`), distinct from the existing `build`/`serve`/`prune*` targets
  - [x] Choose and disclose a concrete execution mechanism for running the TypeScript seed script directly (e.g. an `nx:run-commands` target invoking a TS runner such as `tsx`, or building `seed.ts` via a small esbuild target then running the output with `node`) — no such runner is currently a project dependency (see `package.json` in Dev Notes); adding one is in-scope for this story and should be disclosed the same way Story 1.2 disclosed adding `dotenv`
  - [x] Confirm `nx show projects` still shows a single project (`api`) — this story adds a *target*, not a new Nx project (AD-2 still applies)
- [x] Task 5: Verify the whole story end-to-end (AC: 1–6)
  - [x] Run `docker compose up -d`, apply the existing migration if needed, then run the seed command once — confirm 15 rows, spot-check Budapest's and at least one other known city's `lat`/`lon`
  - [x] Run the seed command a second time — confirm still exactly 15 rows, no duplicates (`SELECT count(*) FROM customers;`)
  - [x] Verify AC5 (unresolvable-settlement handling) **without modifying `data/seed-customers.json`** — since all 15 real seed cities resolve successfully, exercise the miss-and-continue path directly against the resolution logic (e.g. a throwaway script/REPL call, or the recommended `normalize`/lookup-level test) rather than via the untouched seed file; document how this was verified
  - [x] `grep -rn "seed" apps/api/src/app.ts apps/api/src/server.ts` (or equivalent inspection) confirms neither imports `seed.ts` (AC6)
  - [x] `pnpm exec tsc --noEmit` (workspace-wide or scoped to `apps/api`) succeeds

## Dev Notes

- **Architecture governance:** AD-4 (single shared Prisma client — reuse `src/db/client.ts` from Story 1.2, do not instantiate a second `PrismaClient`), AD-5 (seed lives only in `src/seed.ts`, own dedicated command, upsert on the `(name, telepules, countryCode)` unique constraint, disconnect-and-exit when done), AD-6 (one settlement reference file, one normalization function, Budapest district aliases) are the three invariants this story exists to satisfy. [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-4, #AD-5, #AD-6]
- **Critical — AC5 cannot be exercised via the real seed data as-is.** All 15 cities in `data/seed-customers.json` (Budapest, Vienna, Munich, Milan, Barcelona, Lyon, Kraków, Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest, Dublin, Copenhagen) are major capitals/cities that this story's own reference must cover — so a real seed run will never naturally hit the "not found" branch. `data/seed-customers.json` **must not be modified** (explicit exclusion). Verify the miss-and-continue behavior by exercising the resolution/lookup logic directly with a fabricated unknown settlement name, not by editing the seed file. This is the single biggest way this story could be "completed" with an untested code path.
- **`telepules` stores the original city string, not the normalized one.** `data-and-seed.md` defines `telepules` as "the settlement/city" with no normalization requirement on the stored value; normalization exists solely so lookups are robust to case/accent/whitespace variance. Storing the raw `location.city` value keeps the persisted data faithful to the seed input.
- **Path-resolution pitfall (empirically verify, do not assume):** `data/seed-customers.json` lives at the **repo root**, three directories above `apps/api/src/seed.ts` (`src` → `api` → `apps` → repo root). Whatever mechanism Task 4 chooses to execute `seed.ts` (tsx, ts-node, or a build step) changes what `__dirname`/`import.meta.url` resolves to at runtime — a path relative to the *source* file position is not guaranteed to also be correct relative to a *built/dist* file position. Story 1.2's Debug Log recorded an analogous surprise with `import.meta` under this project's esbuild/CJS output — confirm the resolved path actually works for the chosen runner before considering this done, the same way that story empirically verified its own build-tooling mismatch.
- **Known coordinates for the reference file** (public, well-known values; ~4 decimal places is sufficient precision for this project's scope). Table below reflects the values actually implemented in `settlement-coordinates.ts`: Munich, Milan, Barcelona, Lyon, and Kraków use the `geodatos.net`-verified figures recorded in the Debug Log (differing from an earlier draft by up to ~0.015°, i.e. normal city-centre reference-point variance) — independently re-checked and accepted as-is during code review; all other rows were already consistent with `time-ok.com`:

  | City | Country | lat | lon |
  |---|---|---|---|
  | Budapest | HU | 47.4979 | 19.0402 |
  | Vienna | AT | 48.2082 | 16.3738 |
  | Munich | DE | 48.1374 | 11.5755 |
  | Milan | IT | 45.4643 | 9.1895 |
  | Barcelona | ES | 41.3888 | 2.1590 |
  | Lyon | FR | 45.7491 | 4.8479 |
  | Kraków | PL | 50.0614 | 19.9366 |
  | Prague | CZ | 50.0755 | 14.4378 |
  | Lisbon | PT | 38.7223 | -9.1393 |
  | Amsterdam | NL | 52.3676 | 4.9041 |
  | Stockholm | SE | 59.3293 | 18.0686 |
  | Ljubljana | SI | 46.0569 | 14.5058 |
  | Bucharest | RO | 44.4268 | 26.1025 |
  | Dublin | IE | 53.3498 | -6.2603 |
  | Copenhagen | DK | 55.6761 | 12.5683 |

  This is exactly the 15-city closed set found in `data/seed-customers.json` — one settlement per customer, no duplicates, so no city needs more than one entry in the reference map.
- **`countryCode` is persisted but never leaks into any response** — this story only writes it as part of the upsert key; it is not read back or transformed here. No action needed beyond using the seed's own `location.countryCode` verbatim (already carried in `data-and-seed.md`'s frozen decision, enforced by Story 1.2's schema). [Source: spec-geocustomer-backend/data-and-seed.md, api-contract.md]
- **Do not jump ahead:** no HTTP routes registered yet (Stories 1.4/1.5), no Haversine/sorting logic yet (Story 1.5), no MCP configuration yet (Story 1.6, though `SELECT count(*) FROM customers;` may be run manually via `psql` for this story's own verification).
- **Existing `apps/api/src/db/client.ts` (read, do not duplicate):** already exports a single lazily-created `prisma` singleton wired to `@prisma/adapter-pg`, and already throws a clear error if `DATABASE_URL` is unset. Import it as-is; do not add a second Prisma instantiation path.
- **Existing `apps/api/prisma/schema.prisma` (read, do not modify):** the `Customer` model already has the exact fields this story needs (`id`, `name`, `telepules`, `lat` nullable, `lon` nullable, `countryCode`, `budget` nullable, `note` nullable) and the `@@unique([name, telepules, countryCode])` constraint this story's upsert keys on. No schema change is needed or in scope for this story.
- **No `seed` target exists yet in `apps/api/project.json`** — current targets are `build`, `prune-lockfile`, `copy-workspace-modules`, `prune`, `serve`. This story adds the first one that runs `seed.ts`; there is no existing pattern in this repo to copy for running a bare `.ts` script outside the esbuild/`@nx/js:node` pipeline, so the execution mechanism (Task 4) is a genuine implementation decision — disclose whatever is chosen and why, consistent with how Story 1.2 disclosed its own necessary small additions (`dotenv`, `moduleFormat = "cjs"`).

### Previous Story Intelligence (from Story 1.2)

- **Nx/pnpm invocation:** this shell environment sets `CLAUDECODE`/`OPENCODE`, switching Nx's CLI into an agent-oriented NDJSON output mode. Prefix plain `nx`/`pnpm` generator or exec commands with `env -u CLAUDECODE -u OPENCODE` for standard, parseable output.
- **pnpm build-script approval:** new native/postinstall packages may trigger `[ERR_PNPM_IGNORED_BUILDS]`. Run `pnpm approve-builds --all` if this recurs when adding whatever TS-runner dependency Task 4 needs.
- **Port collisions are environment-specific:** `docker-compose.yml` sources the Postgres port from `${POSTGRES_PORT}` specifically because host port 5432 was already bound by an unrelated container in this dev environment. If it recurs, adjust only the local, git-ignored `.env` — never `docker-compose.yml` or `.env.example`'s default. Never stop or touch a container not created by this project's own `docker-compose.yml`.
- **Node LTS deviation still applies:** this environment's only available `node` is a non-LTS release with no version manager available. This is an approved, disclosed deviation carried from Story 1.1/1.2 — do not re-litigate it; authoritative Node 24 LTS verification remains deferred to Story 1.7.
- **Docker Compose discipline:** validate against a running container, then `docker compose down` afterward (volume preserved, unrelated containers — `superpowers-db-1`, `plantbase-pg` — untouched). Established in Stories 1.1/1.2, expected to continue.
- **`DATABASE_URL` must be present in the shell/`.env` for the seed to run** — `db/client.ts` throws immediately if it's unset; this is existing behavior from Story 1.2, not something to change here.

### Project Structure Notes

Builds directly on Story 1.2's foundation (`apps/api/prisma/schema.prisma`, `src/db/client.ts`, `src/app.ts`/`server.ts`). Expected structure after this story (only what this story adds — later stories add the rest):

```text
{repo-root}/
  data/
    seed-customers.json        # UNCHANGED, read-only input — do not modify
  apps/
    api/
      project.json              # + new "seed" target
      src/
        seed.ts                 # NEW — dedicated seed entrypoint; never imported by app.ts/server.ts
        geo/
          settlement-coordinates.ts  # NEW — bundled telepules -> lat/lon reference + Budapest district aliases
          normalize.ts               # NEW — normalizeSettlementName(), pure
          normalize.spec.ts          # NEW, recommended (not AC-gating)
        db/
          client.ts               # UNCHANGED — reused as-is (Story 1.2)
        app.ts, server.ts, main.ts # UNCHANGED — no routes, no seed import (Stories 1.2/1.4/1.5)
```

No `src/routes/`, no `src/domain/` yet — those belong to Stories 1.4 and 1.5.

### References

- [Source: planning-artifacts/epics.md, Story 1.3] — approved scope, acceptance criteria, objective, dependencies, exclusions, validation commands
- [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-4] — shared Prisma client reuse
- [Source: ARCHITECTURE-SPINE.md#AD-5] — seed separation, dedicated command, upsert idempotency mechanism
- [Source: ARCHITECTURE-SPINE.md#AD-6] — settlement reference placement and normalization rule
- [Source: ARCHITECTURE-SPINE.md#AD-8] — pure-function test co-location convention, applied here to `src/geo`
- [Source: spec-geocustomer-backend/data-and-seed.md] — seed input shape, data model fields, idempotency and offline-geocoding requirements verbatim
- [Source: spec-geocustomer-backend/SPEC.md#CAP-3] — capability success criteria
- [Source: _bmad-output/implementation-artifacts/1-2-prisma-schema-migration-and-database-lifecycle.md] — established conventions (Nx/pnpm invocation, Docker Compose discipline, Node LTS deviation, existing `db/client.ts`/schema to reuse verbatim)
- [Source: data/seed-customers.json] — the 15 customers and their `location.city`/`countryCode` values this story's reference must cover

## Dependencies and Exclusions

**Dependencies:** Story 1.2 (schema, migration, shared client singleton).

**Explicitly excluded from this story** (reserved for later stories):

- No HTTP endpoints exposed yet (Stories 1.4/1.5)
- `data/seed-customers.json` is read-only and must not be modified
- No external geocoding API or other network call of any kind
- No Haversine/distance/sorting logic (Story 1.5)
- No PostgreSQL MCP configuration (Story 1.6)

## Validation Commands

Run all of the following and confirm the stated result before moving this story to review:

- Run the seed command once (`nx run api:seed` or equivalent) → `SELECT count(*) FROM customers;` (via `psql` or MCP once available) returns 15
- Run the seed command a second time, consecutively → `SELECT count(*) FROM customers;` still returns 15, no duplicates
- Spot-check a known city's `lat`/`lon` (e.g. Budapest ≈ `47.4979, 19.0402`) and confirm the miss-and-continue path is verified for a deliberately-unresolvable settlement without touching `data/seed-customers.json`
- Confirm the "settlement not found, skipped" log line appears for that unresolvable case, with no crash and no thrown error escaping the process
- `grep` or direct inspection confirms `src/seed.ts` is never imported by `src/app.ts` or `src/server.ts`
- `pnpm exec tsc --noEmit` succeeds

## Definition of Done

- [x] All 6 acceptance criteria verified against the running implementation
- [x] All Validation Commands above pass with the stated result
- [x] No excluded item (HTTP endpoints, Haversine/sorting, MCP, seed-file modification) was added
- [ ] Lands as its own small, focused commit (pending: staging/commit is the next, separate approval step)
- [x] Passed code review before being marked done

## Evidence Expected Before Review

- Terminal output (or transcript) of two consecutive seed runs, each showing the row count
- Terminal output showing the unresolvable-settlement miss-and-continue path exercised without modifying `data/seed-customers.json`
- Confirmation (via `grep` or direct inspection) that `seed.ts` is not imported by `app.ts`/`server.ts`

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`

### Debug Log References

- **Coordinate verification (constraint: do not silently trust story-artifact coordinates):** cross-checked all 15 cities against `time-ok.com/coordinates/europe` (Budapest, Vienna, Prague, Lisbon, Amsterdam, Stockholm, Ljubljana, Bucharest, Dublin, Copenhagen — all matched the story table within normal rounding) and `geodatos.net` per-city pages (Munich, Milan, Barcelona, Lyon, Kraków). The five geodatos-verified values differed from the story's table by up to ~0.015° (≈1.5 km — normal "city center" reference-point variance, not an error); used the geodatos-verified values in `settlement-coordinates.ts` since they came from a source fetched and confirmed during this session. No sign errors, swapped lat/lon, or wrong-country values found in any of the 15.
- **`ROMAN_NUMERALS_I_TO_XXIII` temporal-dead-zone bug caught on first live seed run:** `nx run api:seed` initially threw `ReferenceError: Cannot access 'ROMAN_NUMERALS_I_TO_XXIII' before initialization` — the `SETTLEMENT_COORDINATES` map literal called `budapestDistrictAliases()` (which reads the `const` array) before that `const` declaration was reached at module-eval time. Fixed by reordering so `BUDAPEST`, `ROMAN_NUMERALS_I_TO_XXIII`, and `budapestDistrictAliases()` are all declared before `SETTLEMENT_COORDINATES` is constructed. `tsc --noEmit` had not caught this (it's a runtime evaluation-order issue, not a type error) — confirms the story's own guidance to empirically verify rather than assume.
- **Path-resolution pitfall, verified empirically as instructed:** confirmed `path.resolve(__dirname, '../../../data/seed-customers.json')` in `seed.ts` (at `apps/api/src/seed.ts`) resolves correctly under the chosen `tsx`-based execution mechanism, since `tsx` runs the source file in place (not from a `dist/` build directory), so `__dirname` == `apps/api/src` and three `..` segments reach the repo root.
- **Execution-mechanism decision, disclosed as required:** tried Node's native TypeScript type-stripping first (`node apps/api/src/seed.ts`, Node v26.4.0 supports this with no flags) to avoid adding any dependency at all. It failed: Node's ESM resolver requires explicit `.ts` extensions on relative imports once a file is detected as ESM (confirmed via a throwaway `/tmp` repro), which would require rewriting every relative import across `src/geo`/`src/db` with explicit extensions and is incompatible with this repo's `moduleResolution: "node"` (classic) `tsconfig.base.json` without further config changes. Added `tsx` (^4.23.1) as a devDependency instead — it resolves extensionless imports normally (matching the rest of the codebase's import style) and needed zero other config changes. Wired via an `nx:run-commands` target (`tsx apps/api/src/seed.ts`, `cwd: "{workspaceRoot}"`) so `dotenv/config` inside `seed.ts` finds `.env` at the repo root.
- **`vitest` added as a devDependency** (^4.1.10) — `testing-requirements.md` mandates Vitest as the test framework but no test runner existed in the repo yet; this is the first story to add automated tests.
- **Root `vitest.config.ts` added:** an un-scoped `pnpm exec vitest run` picked up stale compiled `.spec.js` files under `.nx/cache/.../dist/...` (leftover Nx build-cache artifacts) and failed trying to `require()` the ESM-only `vitest` package from those CJS-compiled files. Scoped `test.include` to `apps/**/src/**/*.spec.ts` and excluded `node_modules`/`dist`/`.nx` to fix; confirmed both the scoped (`vitest run apps/api/src/geo`) and workspace-wide (`vitest run`) invocations now pass cleanly (2 files, 5 tests).
- `pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit` → exit 0, no errors.
- First seed run (`nx run api:seed` after `docker compose up -d` + `prisma migrate dev`, already in sync from Story 1.2) → `[seed] processed 15 customers`; `SELECT count(*) FROM customers;` → 15; spot-checked Budapest (47.4979, 19.0402) and all other 14 rows via `psql` — every row has non-null `lat`/`lon` matching the reference table, and `telepules` preserves the original accented city string (e.g. "Kraków").
- Second consecutive seed run → `[seed] processed 15 customers`; `SELECT count(*) FROM customers;` → still 15; `GROUP BY (name, telepules, "countryCode") HAVING count(*) > 1` → 0 rows (no duplicates).
- AC5 (miss-and-continue) verified directly against the resolution logic with a fabricated unknown settlement (`tsx -e` one-liner, no edit to `data/seed-customers.json`): `normalizeSettlementName('Atlantis-on-Sea')` → `SETTLEMENT_COORDINATES.get(...)` → `undefined`; reproduced the exact seed log line (`[seed] settlement not found, skipping geocode: "Atlantis-on-Sea"`); also automated as `settlement-coordinates.spec.ts`'s "miss-and-continue branch" test. Same throwaway call also confirmed a Budapest district alias (`XI. kerület`) resolves to the capital's coordinates.
- `grep -rn "seed" apps/api/src/app.ts apps/api/src/server.ts apps/api/src/main.ts` → no matches (AC6).
- Built (`nx run api:build`) and ran `dist/apps/api/main.js` directly with the seeded database still up: server started, listened, responded 404 to `GET /` (no routes registered — expected, Stories 1.4/1.5 add them); `SELECT count(*) FROM customers;` immediately after → still 15, confirming starting the HTTP server does not seed. Process killed afterward.
- Teardown: `docker compose down` — `bmad-postgres-1` container/network removed, `bmad_postgres-data` volume preserved; `superpowers-db-1` and `plantbase-pg` confirmed untouched and still healthy throughout (`docker ps`).

### Post-Review Fix Verification (re-run after applying review dispositions)

- `pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit` → exit 0.
- `pnpm exec vitest run apps/api/src/geo` → 2 files, 5 tests, all passed (includes the Budapest-district-alias and miss-and-continue tests, confirming the alias dedup didn't regress AC3/AC4).
- `pnpm exec nx run api:build` → succeeded.
- `docker compose up -d` + `prisma migrate deploy` (no pending migrations) → first `nx run api:seed` run → `[seed] processed 15 customers`; `SELECT count(*) FROM customers;` → 15; `SELECT count(*) FROM customers WHERE lat IS NULL OR lon IS NULL;` → 0.
- Second consecutive `nx run api:seed` run → `[seed] processed 15 customers`; `SELECT count(*) FROM customers;` → still 15; `GROUP BY (name, telepules, "countryCode") HAVING count(*) > 1` → 0 rows.
- Alias-dedup sanity check (`tsx -e`, no seed-file edit): `SETTLEMENT_COORDINATES.get(normalizeSettlementName('XI. kerület'))` and `...('XI. kerulet')` both resolve to `{ lat: 47.4979, lon: 19.0402 }`; `SETTLEMENT_COORDINATES.get(normalizeSettlementName('Atlantis-on-Sea'))` → `undefined` (miss-and-continue still correct); `SETTLEMENT_COORDINATES.size` → 61 (15 cities + 23 numerals × 2 alias forms — confirms the removed duplicate actually shrank the map, not just left dead code).
- Built `dist/apps/api/main.js` run directly against the seeded DB: server started, `GET /` → 404 (no routes registered, expected); `SELECT count(*) FROM customers;` immediately after → still 15, confirming HTTP startup does not seed.
- Disconnect-error path: a throwaway repro (`apps/api/src/__disconnect-repro.ts`, deleted immediately after the run — not part of the File List) monkeypatched `prisma.$disconnect` to reject and drove the same `.catch()` chain now in `seed.ts`. Output confirmed both the rejected disconnect is caught and logged (`[seed] error disconnecting Prisma client Error: simulated disconnect failure`) and the process exits non-zero (`EXIT:1`).
- Teardown: `docker compose down` — container/network removed, volume preserved; `superpowers-db-1`/`plantbase-pg` unaffected.

### Completion Notes List

- All 6 acceptance criteria verified against the running implementation (see Debug Log References).
- `data/seed-customers.json` was never modified — confirmed via `git status --short` showing no change to that path.
- No HTTP endpoints, Haversine logic, sorting, or MCP configuration were added — confirmed by direct inspection of every file in the File List below.
- Seed is reachable only via `nx run api:seed` (`nx:run-commands` → `tsx apps/api/src/seed.ts`); `app.ts`/`server.ts`/`main.ts` do not import `seed.ts` in any form.
- Two new devDependencies disclosed and justified above: `tsx` (TS execution for the seed script) and `vitest` (test framework mandated by `testing-requirements.md`, not previously present in the repo).

### File List

- `apps/api/src/geo/normalize.ts` (new)
- `apps/api/src/geo/normalize.spec.ts` (new)
- `apps/api/src/geo/settlement-coordinates.ts` (new)
- `apps/api/src/geo/settlement-coordinates.spec.ts` (new)
- `apps/api/src/seed.ts` (new)
- `apps/api/project.json` (modified — added `seed` target)
- `vitest.config.ts` (new, repo root)
- `package.json` (modified — added `tsx` and `vitest` devDependencies)
- `pnpm-lock.yaml` (modified — lockfile update for the above)

## Change Log

- 2026-07-17: Story drafted from `epics.md` Story 1.3 and the approved architecture spine. Status set to `ready-for-dev`.
- 2026-07-17: Implemented offline settlement normalization/reference, the idempotent seed script, and the dedicated `nx run api:seed` target; added `tsx`/`vitest` devDependencies and a root `vitest.config.ts`. All 6 ACs verified end-to-end (two consecutive seed runs at 15 rows, no duplicates; miss-and-continue path exercised without touching the seed JSON; server-start does not seed). Status set to `review`.
- 2026-07-17: Consolidated code review completed; findings and dispositions recorded below. Fixes applied for the two actionable findings; story remains in `review` pending final commit.
- 2026-07-17: Final closure review (`bmad-code-review`) re-verified all 4 prior dispositions against the current diff and independently re-ran all 6 acceptance criteria end-to-end (two consecutive seed runs at 15 rows/no duplicates against a live `bmad-postgres-1` container, direct resolution-logic checks for normalization/Budapest-district-alias/miss-and-continue, `grep` confirming no `app.ts`/`server.ts`/`main.ts` import of `seed.ts`, a built-server run confirming HTTP startup does not seed, `tsc --noEmit` and `vitest run` both green). No new findings. **Final verdict: PASS.** Status set to `done`; commit remains a separate, later step.

## Code Review Findings and Dispositions

1. **Coordinate values for Munich, Milan, Barcelona, Lyon, Kraków differ from the original Dev Notes table.** Disposition: **Accepted, no code change.** The implemented values are valid city-centre reference coordinates (geodatos.net-verified, differing from the original draft table by ≤~0.015°/~1.5 km — normal reference-point variance, not an error). The Dev Notes table above was updated to match the implemented values so the story artifact is internally consistent; `settlement-coordinates.ts` was left unchanged.
2. **Redundant duplicate Budapest district alias (`kerulet` and `kerület` both constructed per numeral).** Disposition: **Fixed.** Since `normalizeSettlementName()` strips diacritics before lookup, both spellings normalize identically — the unaccented `kerulet` entry was a no-op duplicate. Removed the redundant `.push()` in `budapestDistrictAliases()` (`apps/api/src/geo/settlement-coordinates.ts`); one alias form per Roman numeral is now constructed, and both accented/unaccented user input still resolve correctly via normalization (unchanged behavior, verified via `settlement-coordinates.spec.ts`).
3. **Unhandled rejection risk: a rejected `prisma.$disconnect()` in `.finally()` was not caught, and would not affect `process.exitCode`.** Disposition: **Fixed.** `apps/api/src/seed.ts`'s `.finally()` now chains a `.catch()` on `prisma.$disconnect()` that logs the error and sets `process.exitCode = 1`, so both a fatal seed error and a fatal disconnect error deterministically produce a non-zero exit code. Unresolved-settlement misses remain non-fatal (still a `console.warn`, no throw) — unaffected by this change. No new lifecycle/wrapper abstraction was introduced; the fix is a plain `.catch()` inline.
4. **No generic per-row malformed-data guard in the seed loop (e.g. missing `location`/`city` fields).** Disposition: **Deferred, non-blocking.** `data/seed-customers.json` is a frozen, pre-validated, read-only input (explicit exclusion in this story), and AC5 only concerns *unresolved settlements* (a valid city string absent from the offline reference), not malformed rows. Adding row-shape validation here would be speculative scope beyond this story's ACs. Revisit only if a future story relaxes the frozen-data assumption.

## Final Closure Review — PASS

Re-run via `bmad-code-review` against the current uncommitted diff (story artifact, `sprint-status.yaml`, `apps/api/project.json`, `package.json`, `pnpm-lock.yaml`, plus the untracked `apps/api/src/geo/`, `apps/api/src/seed.ts`, `vitest.config.ts`). All four prior dispositions above were checked against the current code and confirmed still accurate (no drift). All 6 acceptance criteria were independently re-verified end-to-end:

1. **AC1** — `nx run api:seed` against a fresh `bmad-postgres-1` container (migrations already applied, no pending) → `SELECT count(*) FROM customers;` = 15; `SELECT count(*) FROM customers WHERE lat IS NULL OR lon IS NULL;` = 0; spot-checked Budapest (47.4979, 19.0402) and Kraków (50.0614, 19.9366) via `psql`.
2. **AC2** — second consecutive `nx run api:seed` run → still 15 rows; `GROUP BY (name, telepules, "countryCode") HAVING count(*) > 1` → 0 rows.
3. **AC3** — `normalizeSettlementName('  KRAKÓW  ')` → `'krakow'`, confirming accent-stripping, lowercasing, and whitespace-trim/collapse.
4. **AC4** — `SETTLEMENT_COORDINATES.get(normalizeSettlementName('XI. kerület'))` and `('Budapest V')` both resolve to `{ lat: 47.4979, lon: 19.0402 }`.
5. **AC5** — `SETTLEMENT_COORDINATES.get(normalizeSettlementName('Atlantis-on-Sea'))` → `undefined`, exercised without modifying `data/seed-customers.json` (confirmed untouched via `git status --short`); `seed.ts`'s miss branch logs via `console.warn` and does not throw, matching the code read directly.
6. **AC6** — `grep -rn "seed" apps/api/src/app.ts apps/api/src/server.ts apps/api/src/main.ts` → no matches; ran the built `dist/apps/api/main.js` directly — server responded, `SELECT count(*) FROM customers;` immediately after was still 15, confirming HTTP startup does not seed.

Additionally confirmed: fatal seed and disconnect failures are both caught and set `process.exitCode = 1` (read directly in `apps/api/src/seed.ts`); the Dev Notes coordinate table matches `settlement-coordinates.ts` exactly; `pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit` exits 0; `pnpm exec vitest run` → 2 files, 5 tests, all passed; no HTTP endpoint, Haversine, sorting, MCP, or Story 1.4 scope present anywhere in the diff (`app.ts`/`server.ts`/`main.ts` have zero changes). Docker teardown (`docker compose down`) completed cleanly; `superpowers-db-1`/`plantbase-pg` unaffected throughout.

**Verdict: PASS.** No blocking findings. Story 1.3 is marked `done`.
