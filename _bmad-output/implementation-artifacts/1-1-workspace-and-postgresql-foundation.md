---
baseline_commit: d11120a5ecd3df7c211afb2ec1b4691e113ec282
---

# Story 1.1: Workspace and PostgreSQL Foundation

Status: done

## Story

As the developer setting up this project,
I want a working Nx/pnpm workspace and a local PostgreSQL 16 instance running via Docker Compose,
so that every later story has a real database and a strict-TypeScript project to build against.

## Acceptance Criteria

(Verbatim from `_bmad-output/planning-artifacts/epics.md`, Story 1.1 — do not reinterpret or broaden.)

1. Given a fresh clone, when `pnpm install` is run, then dependencies install cleanly with no errors.
2. Given `.env` created from a committed `.env.example`, when `docker compose up -d` is run, then a `postgres:16-alpine` container starts and is reachable on the configured port (AD-9).
3. Given the Nx workspace, when its projects are listed, then exactly one project (`api`) exists (AD-2).
4. Given the base `tsconfig`, when inspected, then strict mode is enabled.

## Tasks / Subtasks

- [x] Task 1: Initialize pnpm + Nx workspace (AC: 1, 3)
  - [x] Initialize the pnpm workspace at the repo root
  - [x] Create an Nx workspace with a single application project named `api` under `apps/api` — no additional generated e2e app, no additional libs (AD-2)
  - [x] Confirm `nx show projects` (or the Nx equivalent generated) lists exactly one project
- [x] Task 2: Configure TypeScript strict mode (AC: 4)
  - [x] Set `"strict": true` in the base/root `tsconfig` (and confirm no project-level override disables it)
  - [x] Confirm `pnpm exec tsc --noEmit` runs clean against the initial skeleton
- [x] Task 3: Docker Compose PostgreSQL 16 service (AC: 2)
  - [x] Create a root `docker-compose.yml` with exactly one service, `postgres`, image `postgres:16-alpine` (AD-9 — a frozen version requirement, not "latest")
  - [x] Add a named volume for data persistence
  - [x] Add a healthcheck (e.g. `pg_isready`) so `docker compose ps` reports the service as healthy, not merely running
  - [x] Source port/db name/credentials from environment variables — no hardcoded values in `docker-compose.yml`
- [x] Task 4: Environment configuration (AC: 2)
  - [x] Create `.env.example` at the repo root with placeholder values only (e.g. `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`)
  - [x] Add `.env` to `.gitignore` — the real file must never be committed
  - [x] Add `node_modules`, Nx/TS build output (e.g. `dist/`, `.nx/cache`) to `.gitignore`
- [x] Task 5: Verify the whole foundation end-to-end (AC: 1–4)
  - [x] Run every command in Validation Commands below and confirm each stated result

### Review Findings

- [x] [Review][Patch] Add required/default fallbacks on Compose env vars — missing `.env` currently yields blank credentials or a broken `":5432"` port mapping instead of a clean failure [docker-compose.yml:5-12] — **APPLIED**: `${VAR:?message}` required-variable syntax added to all four vars; re-verified live by temporarily removing `.env` — `docker compose config` now fails immediately with `POSTGRES_USER is required — copy .env.example to .env` instead of silently producing blank values.
- [x] [Review][Patch] `.env.example`'s `DATABASE_URL` duplicates the `POSTGRES_*` values with no note that they must be kept in sync — already bit this session's own validation when the port was changed to 5434 [.env.example] — **APPLIED**: one-line note added above `DATABASE_URL` stating it is not derived automatically and must be updated to match if the values above change.
- [x] [Review][Patch] Add `start_period` to the Postgres healthcheck to avoid transient unhealthy flapping during first-boot init [docker-compose.yml:13-17] — **APPLIED**: `start_period: 10s` added; re-verified live — container showed `health: starting` immediately after `up -d`, then `healthy` once ready, rather than a premature unhealthy state.
- [ ] [Review][Patch] Quote `${POSTGRES_USER}`/`${POSTGRES_DB}` inside the healthcheck `CMD-SHELL` string (defense-in-depth, zero cost) [docker-compose.yml:14] — **DECLINED** (explicit user decision): not required for the approved env-var validation to work — that validation lives in the `environment:`/`ports:` keys, which already fail the whole `docker compose` invocation before the healthcheck line is ever evaluated. Healthcheck quoting left unchanged.
- [ ] [Review][Patch] Add an explicit Compose `name:` key so container/volume naming doesn't depend on the checkout directory name — relevant to Story 1.7's fresh-clone determinism [docker-compose.yml] — **DECLINED** (explicit user decision, out of this round's approved scope).
- [x] [Review][Patch] Pin `@nx/node` to the exact `23.0.2` to match the other `@nx/*`/`nx` exact pins, avoiding future silent plugin/core version drift [package.json] — **APPLIED**: `package.json` changed `^23.0.2` → `23.0.2`; `pnpm install` re-run, lockfile resynced, `pnpm list @nx/node` confirms `23.0.2` resolved.
- [ ] [Review][Patch] Drop unused `"dom"` from `tsconfig.base.json` `lib` and drop `emitDecoratorMetadata`/`experimentalDecorators` — pure Node backend, nothing in this stack uses decorators or DOM types [tsconfig.base.json] — **DECLINED** (explicit user decision, out of this round's approved scope).
- [ ] [Review][Patch] Add a one-line comment in `pnpm-workspace.yaml` explaining why `esbuild`/`nx`/`unrs-resolver` postinstall scripts are approved, for auditability [pnpm-workspace.yaml] — **DECLINED** (explicit user decision, out of this round's approved scope).
- [x] [Review][Patch] Add trailing newline to `apps/api/src/main.ts` and `.prettierignore` — both currently missing one, contradicting this same diff's own `.editorconfig` (`insert_final_newline = true`) [apps/api/src/main.ts, .prettierignore] — **APPLIED**: both files now end with a newline (verified byte-level).
- [ ] [Review][Patch] Replace Nx's generic marketing boilerplate in `README.md` with a minimal one-line placeholder noting the real README arrives in Story 1.7 [README.md] — **DECLINED** (explicit user decision, out of this round's approved scope; README.md remains the generated Nx placeholder pending Story 1.7).
- [x] [Review][Patch] Correct Debug Log Reference wording that could imply this diff added the `.env` gitignore rule — that rule predates this diff; this diff only added the Node/Nx build-artifact ignore lines [this file, Debug Log References] — **APPLIED**: wording corrected below to state the `.env` rule predates this diff.
- [x] [Review][Defer] No CI workflow / empty root `package.json` scripts — deferred, out of approved scope (CI/lint infrastructure was never part of the approved epics/stories plan or the assignment's technical constraints; adding it now would be scope creep)
- [x] [Review][Defer] `.gitignore`'s unanchored `dist`/`tmp`/`out-tsc` patterns — deferred, this is Nx's own official generator default convention used verbatim by nearly every Nx workspace; negligible real risk in this specific small repo
- [x] [Review][Defer] `pnpm-workspace.yaml` missing a `packages:` key for future multi-package workspace membership — deferred, speculative future-proofing against a multi-project shape AD-2 explicitly rejected for this project
- [x] [Review][Defer] `apps/api/tsconfig.app.json` `outDir` vs. the esbuild executor's `outputPath` divergence — deferred, no current consequence since only `--noEmit` is ever invoked; premature to fix a build-pipeline shape not yet decided

### Final Review Verdict

**PASS — Story 1.1 satisfies all four acceptance criteria, stays within its approved scope and exclusions, passes every required validation gate, and has no remaining blocking review finding.**

Re-verified at this final pass (all consistent with the fixes applied in the prior round):
- **Acceptance criteria:** `pnpm install` clean; `docker compose config` resolves with `.env` present (`start_period: 10s`, required-var validation intact); `nx show projects` → exactly `api`; `tsc -p apps/api/tsconfig.app.json --noEmit` → exit 0 with `strict: true` confirmed in `tsconfig.base.json`.
- **Scope and exclusions:** no `fastify`/`prisma` reference anywhere in `package.json`, `nx.json`, `apps/`, or `docker-compose.yml`; still exactly one Nx project; no seed or MCP configuration present.
- **Secret hygiene:** `.env` is not and has never been tracked (`git ls-files` confirms); `.gitignore:6` ignores it.
- **Blocking findings:** none. Of the 11 original patch findings, 6 were applied and re-verified working (including a live negative test proving the required-env-var validation actually fails clearly), and 5 were explicitly declined by the user this round — a deliberate, informed disposition, not an open gap. The 4 deferred items (`deferred-work.md`) are pre-existing conventions or explicitly out of this project's approved scope (no CI/lint infrastructure was ever part of the epics/stories plan; the multi-package workspace concern is moot given AD-2's single-project decision) — none of them are contradicted or made worse by the current implementation.
- **Definition of Done:** all items satisfied except "lands as its own focused commit," which is the next step following this review, not a gate this review itself can close.

Code review is complete. Story 1.1 is marked **done**. Commit/staging is the next, separate step.

## Dev Notes

- **Architecture governance:** AD-2 (single Nx project — no separate lib for domain logic; internal folders provide separation in later stories) and AD-9 (Docker Compose Postgres — `postgres:16-alpine` is a *frozen* version requirement, corrected from an earlier draft that mis-picked 18; do not use `latest` or any other tag) are the two invariants this story exists to satisfy. [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-2, #AD-9]
- **Do not jump ahead:** No Prisma schema, no Fastify app/routes, no seed logic belongs in this story — those are Stories 1.2, 1.4/1.5, and 1.3 respectively. This story only needs the workspace and the database container to exist. [Source: planning-artifacts/epics.md, Story 1.2 "Explicit exclusions"]
- **Stack versions:** Node.js LTS, TypeScript strict, pnpm, and Nx are technology choices fixed by `technical-constraints.md`; their exact minor/patch versions are an implementation-time choice recorded via the lockfile — do not hunt for or hardcode a specific patch version. PostgreSQL is the one exception: it MUST be exactly 16 (`postgres:16-alpine`), never "whatever is latest." [Source: ARCHITECTURE-SPINE.md#Stack]
- **Why exactly one Nx project, not app+lib:** the architecture explicitly rejected a second Nx lib for domain logic — there is only one consumer app in this whole system, so a project boundary would be unnecessary Nx ceremony ("avoid unnecessary layers," `technical-constraints.md`). Do not generate an e2e test app or any lib scaffold Nx offers by default — a single `apps/api` project is the target end-state, now and after every later story. [Source: ARCHITECTURE-SPINE.md#AD-2, #Deferred]
- **Docker Compose scope:** only PostgreSQL runs in Docker Compose. The Fastify API itself runs directly via pnpm/node against the Dockerized Postgres — this is a documented SPEC assumption, not a decision this story revisits. [Source: spec-geocustomer-backend/SPEC.md#Assumptions]
- **Secrets discipline:** `.env.example` must contain placeholders only; the real `.env` must never be committed. This is checked again at Story 1.7 (fresh-clone validation) but must be correct starting from this story. [Source: spec-geocustomer-backend/repo-and-docs-quality.md]

### Project Structure Notes

Greenfield repository — no Nx workspace, `package.json`, or `docker-compose.yml` exists yet at the repo root (only `docs/`, `data/`, `.claude/`, `_bmad/`, `_bmad-output/` currently exist). This story creates the project structure for the first time; there is no existing application code to preserve.

Expected structure after this story (only what this story creates — later stories add the rest):

```text
{repo-root}/
  apps/
    api/
      project.json          # Nx project config; targets: build, test (serve/seed added by later stories)
      tsconfig.json          # strict: true
  tsconfig.base.json         # or equivalent root strict baseline, per the Nx generator's default layout
  nx.json
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml        # if required by the chosen Nx layout
  docker-compose.yml         # one postgres:16-alpine service
  .env.example
  .gitignore
```

No `prisma/`, no `src/app.ts`/`server.ts`/`seed.ts`, no `README.md` yet — those belong to Stories 1.2 and 1.7.

### References

- [Source: planning-artifacts/epics.md, Story 1.1] — approved scope, acceptance criteria, objective, dependencies, exclusions, validation commands
- [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-2] — single Nx project rule
- [Source: ARCHITECTURE-SPINE.md#AD-9] — `postgres:16-alpine`, frozen version
- [Source: ARCHITECTURE-SPINE.md#Stack] — frozen vs. implementation-time version distinction
- [Source: spec-geocustomer-backend/technical-stack.md] — Node LTS, TypeScript strict, pnpm, Nx, no frontend
- [Source: spec-geocustomer-backend/repo-and-docs-quality.md] — secrets/.env discipline
- [Source: docs/technical-constraints.md] — "Do not commit the real `.env` file. Provide an `.env.example`"; "avoid unnecessary packages, layers, abstractions"

## Dependencies and Exclusions

**Dependencies:** None — this is the first story in Epic 1.

**Explicitly excluded from this story** (reserved for later stories):

- Prisma schema, client, or migrations (Story 1.2)
- Fastify application, routes, or `server.ts`/`app.ts` (Stories 1.2–1.5)
- Seed script or seed logic (Story 1.3)
- PostgreSQL MCP configuration (Story 1.6)
- Any application or business logic
- Any additional Nx library, second project, or infrastructure beyond the single `postgres` Docker Compose service

## Validation Commands

Run all of the following and confirm the stated result before moving this story to review:

- `pnpm install` → completes with no errors
- `docker compose up -d` → starts the `postgres:16-alpine` container
- `docker compose ps` → shows the `postgres` service as `healthy` (not merely `Up`)
- `nx show projects` (or the Nx equivalent available in the generated workspace) → lists exactly one project: `api`
- `pnpm exec tsc --noEmit` → succeeds with no errors against the workspace skeleton
- Manual inspection / `git status` → confirms no real `.env` file is tracked, only `.env.example`

## Definition of Done

- [x] All 4 acceptance criteria verified against the running implementation
- [x] All Validation Commands above pass with the stated result
- [x] No excluded item (Prisma, Fastify routes, seed, MCP, business logic, extra Nx projects) was added
- [ ] Lands as its own small, focused commit (pending: staging/commit is the next, separate approval step)
- [x] Passed code review before being marked done — see "Final Review Verdict" below

## Evidence Expected Before Review

- Terminal output (or transcript) of `pnpm install`, `docker compose up -d`, `docker compose ps`, `nx show projects`, and `pnpm exec tsc --noEmit`, each showing the expected result above
- Confirmation that `.env` is git-ignored and only `.env.example` (placeholders only) is present in the diff

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`

### Debug Log References

- `pnpm install` → clean, `Done in 370ms` (final run). One environment warning surfaced honestly, not suppressed: `[WARN] Unsupported engine: wanted: {"node":">=24 <25"} (current: {"node":"v26.4.0", ...})` — see Completion Notes, "Execution-environment deviation."
- `docker compose up -d` / `docker compose ps` → `bmad-postgres-1`, image `postgres:16-alpine`, `Up ... (healthy)`, port mapping `0.0.0.0:5434->5432/tcp` (host port 5434 only, from the local git-ignored `.env` — see Completion Notes).
- `docker compose exec -T postgres pg_isready -U changeme -d geocustomer` → `accepting connections` (extra confirmation beyond the story's own validation list).
- `pnpm exec nx show projects` → `api` (exactly one line/project).
- `pnpm exec tsc -p apps/api/tsconfig.app.json --noEmit` → exit 0, no output.
- Strict-mode sanity check (not a story requirement, self-imposed verification): a scratch file with an untyped parameter was compiled and correctly rejected with `TS7006: Parameter 'x' implicitly has an 'any' type`, then deleted — proves `strict: true` is actually enforced, not just present in the config.
- `git status --short` / `git check-ignore -v .env` → `.env` confirmed ignored (`.gitignore:6:.env`, a rule that predates this diff — this story's own `.gitignore` change only appended the Node/Nx build-artifact lines below it); only `.env.example` is untracked-and-intended-for-commit.
- **Post-validation teardown:** `docker compose down` → `bmad-postgres-1` and `bmad_default` network removed cleanly. Verified afterward: `docker compose ps` in the repo returns empty (no Story 1.1 container running); `docker volume ls` still lists `bmad_postgres-data` (named volume preserved — `down` was run without `-v`, and this story does not require volume removal); `docker ps -a` confirms `superpowers-db-1` and `plantbase-pg` remained untouched throughout (still running, still healthy, still on their own ports 5432/5433) — this story's container never shared state with either. No source or configuration file changed as a result of stopping the container; only Docker runtime state changed.
- **Code-review fix round (approved patches 1, 2, 3, 4, 5, 6 applied):** `docker compose config` with `.env` present resolved cleanly, showing `start_period: 10s` in the healthcheck. `.env` was then temporarily removed and `docker compose config` re-run — it failed immediately with `error while interpolating services.postgres.environment.POSTGRES_USER: required variable POSTGRES_USER is missing a value: POSTGRES_USER is required — copy .env.example to .env` (exit 1), proving the new `${VAR:?message}` validation actually works; `.env` was restored immediately after. `docker compose up -d` then showed `health: starting` immediately (the new `start_period`), followed by `healthy` once ready. `nx show projects` still returns exactly `api`; `tsc -p apps/api/tsconfig.app.json --noEmit` still exits 0. `pnpm install` re-run after pinning `@nx/node` to the exact `23.0.2`; `pnpm list @nx/node` confirms `23.0.2` resolved. Container stopped again via `docker compose down` after this validation pass — not left running.

### Completion Notes List

- Scaffolded via Nx's `create-nx-workspace` (preset `apps`, pnpm) in a scratch directory, then copied only the generated artifacts into the repo root and merged `.gitignore` by hand — `create-nx-workspace` refuses to run in a non-empty directory (repo root already has `docs/`, `data/`, `.claude/`, `_bmad/`, `_bmad-output/`), confirmed by a throwaway test before touching the real repo.
- Generated exactly one Nx project, `apps/api`, via `@nx/node:application` with `--framework=none --e2eTestRunner=none --unitTestRunner=none --linter=none` — no Fastify wiring, no e2e app, no test runner, no lint config were added, per this story's exclusions. `nx show projects` confirms exactly one project.
- Added `"strict": true` to the generated `tsconfig.base.json` (not on by default in Nx's output) and verified it is genuinely enforced (see Debug Log).
- **Execution-environment deviation (approved, recorded honestly):** this environment's only available `node` is v26.4.0, a non-LTS "Current" release, with no `nvm`/`fnm`/`volta` present to switch to Node 24 LTS. Per explicit approval: targeted Node 24 LTS via `.nvmrc` (`24`) and `package.json` `engines.node: ">=24 <25"`; used the available Node 26 runtime only to perform this scaffold and local validation, because no version manager exists here. Running under Node 26 does **not** prove Node 24 LTS compatibility — `pnpm install` itself now surfaces this honestly as an engine-mismatch warning (see Debug Log) rather than silently passing. Authoritative Node 24 verification is explicitly deferred to Story 1.7's fresh-clone validation, as directed.
- `docker-compose.yml`'s `postgres` service uses `${POSTGRES_PORT}` (not hardcoded `5432`) specifically because host port 5432 was already bound by another running container (`superpowers-db-1`, unrelated to this work) discovered during validation. Port `5434` was used **only** in the local, git-ignored `.env` for this validation session — the committed `.env.example` default remains, and still reads, `5432` (the sensible default for a genuinely fresh machine). The Superpowers branch/container was not touched, stopped, or used as a source for anything in this implementation. Once validation evidence was captured, the Story 1.1 container was stopped via `docker compose down` (see Debug Log, "Post-validation teardown") — it is not left running.
- `README.md` in the File List below is Nx's own generic scaffold boilerplate (an automatic side effect of `create-nx-workspace`), not authored project documentation — the real run-instructions README is Story 1.7's job and will replace it.
- No Prisma, Fastify routes, seed logic, or MCP configuration was added — confirmed by direct inspection of every file created (see File List).

### File List

**Created:**
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `nx.json`
- `tsconfig.base.json`
- `.editorconfig`
- `.prettierrc`
- `.prettierignore`
- `.vscode/extensions.json`
- `.vscode/launch.json`
- `README.md` (Nx scaffold placeholder — see Completion Notes)
- `apps/api/project.json`
- `apps/api/tsconfig.json`
- `apps/api/tsconfig.app.json`
- `apps/api/src/main.ts` (placeholder `console.log`, no business logic)
- `apps/api/src/assets/.gitkeep`
- `docker-compose.yml`
- `.env.example`
- `.nvmrc`

**Modified:**
- `.gitignore` (appended `node_modules`, `dist`, `tmp`, `out-tsc`, `.nx/cache`, `.nx/workspace-data`, `.nx/migrate-runs` — existing BMAD/env/OS rules preserved unchanged)

**Not created/modified (local only, correctly git-ignored):**
- `.env` (created locally from `.env.example` to run validation; confirmed git-ignored, never staged)

## Change Log

- 2026-07-13: Story 1.1 implemented — pnpm/Nx workspace (single `api` project), TypeScript strict mode, `docker-compose.yml` (`postgres:16-alpine`, named volume, healthcheck, env-var config), `.env.example`, `.nvmrc` + `engines.node` for the Node 24 LTS target. All acceptance criteria and validation commands verified. Status moved to `review`.
- 2026-07-13: Code review completed (Blind Hunter, Edge Case Hunter, Acceptance Auditor). 6 of 11 patch findings applied (required Compose env-var validation, healthcheck `start_period`, `.env.example` sync note, `@nx/node` exact pin, trailing newlines, Debug Log wording); 5 explicitly declined by the user for this round (Compose `name:` key, `tsconfig` lib/decorator trim, `pnpm-workspace.yaml` comment, README replacement, healthcheck quoting); 4 pre-existing/out-of-scope items deferred to `deferred-work.md`. All acceptance criteria and validation commands re-verified after the fixes, including a live test proving the new required-env-var validation fails clearly when `.env` is missing. Status remains `review` — not yet marked `done`.
- 2026-07-13: Code review resumed and finalized. Re-verified all 4 ACs, scope/exclusions, secret hygiene, and all validation gates hold after the applied fixes; no blocking finding remains — the 5 declined and 4 deferred items are confirmed non-blocking. Final Review Verdict: **PASS**. Status moved to `done`. Focused commit is the next step.
