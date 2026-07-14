# Story 1.1: Workspace and PostgreSQL Foundation

Status: ready-for-dev

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

- [ ] Task 1: Initialize pnpm + Nx workspace (AC: 1, 3)
  - [ ] Initialize the pnpm workspace at the repo root
  - [ ] Create an Nx workspace with a single application project named `api` under `apps/api` — no additional generated e2e app, no additional libs (AD-2)
  - [ ] Confirm `nx show projects` (or the Nx equivalent generated) lists exactly one project
- [ ] Task 2: Configure TypeScript strict mode (AC: 4)
  - [ ] Set `"strict": true` in the base/root `tsconfig` (and confirm no project-level override disables it)
  - [ ] Confirm `pnpm exec tsc --noEmit` runs clean against the initial skeleton
- [ ] Task 3: Docker Compose PostgreSQL 16 service (AC: 2)
  - [ ] Create a root `docker-compose.yml` with exactly one service, `postgres`, image `postgres:16-alpine` (AD-9 — a frozen version requirement, not "latest")
  - [ ] Add a named volume for data persistence
  - [ ] Add a healthcheck (e.g. `pg_isready`) so `docker compose ps` reports the service as healthy, not merely running
  - [ ] Source port/db name/credentials from environment variables — no hardcoded values in `docker-compose.yml`
- [ ] Task 4: Environment configuration (AC: 2)
  - [ ] Create `.env.example` at the repo root with placeholder values only (e.g. `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `DATABASE_URL`)
  - [ ] Add `.env` to `.gitignore` — the real file must never be committed
  - [ ] Add `node_modules`, Nx/TS build output (e.g. `dist/`, `.nx/cache`) to `.gitignore`
- [ ] Task 5: Verify the whole foundation end-to-end (AC: 1–4)
  - [ ] Run every command in Validation Commands below and confirm each stated result

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

- [ ] All 4 acceptance criteria verified against the running implementation
- [ ] All Validation Commands above pass with the stated result
- [ ] No excluded item (Prisma, Fastify routes, seed, MCP, business logic, extra Nx projects) was added
- [ ] Lands as its own small, focused commit
- [ ] Passed code review before being marked done

## Evidence Expected Before Review

- Terminal output (or transcript) of `pnpm install`, `docker compose up -d`, `docker compose ps`, `nx show projects`, and `pnpm exec tsc --noEmit`, each showing the expected result above
- Confirmation that `.env` is git-ignored and only `.env.example` (placeholders only) is present in the diff

## Dev Agent Record

### Agent Model Used

(to be filled in by the implementing dev agent)

### Debug Log References

### Completion Notes List

### File List
