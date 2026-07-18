---
baseline_commit: 8561b49
---

# Story 1.6: PostgreSQL MCP Integration and Verification

Status: ready-for-dev

## Story

As the developer working on this codebase,
I want the PostgreSQL MCP configured and actually used to inspect the live database,
so that development is grounded in the real schema and data, per the assignment's MCP requirement.

## Acceptance Criteria

(Verbatim from `_bmad-output/planning-artifacts/epics.md`, Story 1.6 — do not reinterpret or broaden.)

1. Given a fresh clone with `.env` populated and Postgres running, when the MCP is launched per the committed project-scoped configuration, then it connects successfully with no machine-specific manual edits beyond copying `.env.example` to `.env` (AD-10).
2. Given the MCP connection, when used during development, then it is demonstrated inspecting the database schema, the `customers` table definition, the seeded row count (15), and sample seeded customer rows — not merely configured (NFR5).
3. Given `.mcp.json` and `.env.example`, when inspected, then neither contains a password, token, or real credential.

## Tasks / Subtasks

- [ ] Task 1: Add project-scoped `.mcp.json` at repo root (AC: 1, 3)
  - [ ] Create `.mcp.json` in the repo root (sibling to `docker-compose.yml`, `.env.example`) declaring one MCP server entry launching `postgres-mcp` (crystaldba, PyPI) via `uvx postgres-mcp --access-mode=restricted`.
  - [ ] The server's connection argument must read `DATABASE_URL` from the process environment (e.g. `"env": { "DATABASE_URL": "${DATABASE_URL}" }` or the equivalent env-passthrough form for whichever MCP client config schema is used) — never an inlined `postgresql://user:pass@host/db` literal. Verify the exact `.mcp.json` schema/shape expected by the MCP-client tooling in use (Claude Code project-scoped MCP config) before writing the file, since the concrete JSON keys are client-specific and not fixed by the architecture spine.
  - [ ] `--access-mode=restricted` is mandatory (read-only) — per AD-10 and the story's exclusion of MCP write operations.
  - [ ] Do not add a database name, user, password, or port literal anywhere in this file — `DATABASE_URL` (already defined in `.env`/`.env.example` per Stories 1.1–1.2) is the only source of connection details.

- [ ] Task 2: Verify `.env.example` still contains no real credential (AC: 3)
  - [ ] Confirm `.env.example`'s existing `POSTGRES_USER=changeme` / `POSTGRES_PASSWORD=changeme` / `DATABASE_URL=postgresql://changeme:changeme@localhost:5432/geocustomer` placeholders (already established in Story 1.1, unchanged since) remain placeholder-only — no edit expected unless this story's review finds a regression.
  - [ ] Do not touch the real, git-ignored `.env` file's committed status (it is already `.gitignore`d — confirm, don't re-verify by inspecting its contents beyond confirming it stays untracked).

- [ ] Task 3: Launch the MCP against the running database and record a verification transcript (AC: 1, 2)
  - [ ] Ensure `.env` is populated (already true from prior stories) and `docker compose up -d` has a healthy `postgres:16-alpine` container running.
  - [ ] Ensure the `customers` table is seeded (re-run `nx run api:seed` if needed; must show 15 rows, idempotent per Story 1.3).
  - [ ] Launch the MCP per the committed `.mcp.json` (e.g. via the Claude Code client picking up the project-scoped config, or directly via `uvx postgres-mcp --access-mode=restricted --dsn "$DATABASE_URL"` for a manual smoke check) and confirm it connects with **no machine-specific manual edit** beyond the already-documented `.env.example` → `.env` copy step.
  - [ ] Using the connected MCP (not `psql` or Prisma directly — the MCP tool itself must be the one used and recorded), inspect and capture output for all four of: (a) the database schema (list of tables/schemas), (b) the `customers` table definition (columns/types/constraints), (c) the seeded row count (must read 15), (d) a sample of seeded customer rows (a handful of actual `SELECT` results).
  - [ ] Save this as a recorded transcript or log excerpt (e.g. pasted into this story's Dev Agent Record / Debug Log References, or a committed transcript file if the team convention prefers a file) — per `mcp-requirements.md`, "configuring the MCP without this recorded evidence does not satisfy this gate."
  - [ ] `docker compose down` afterward, per established Docker Compose discipline from prior stories (volume preserved, unrelated containers untouched).

- [ ] Task 4: Confirm no secrets are committed (AC: 3)
  - [ ] `git grep` (or manual read) of `.mcp.json` and `.env.example` for anything resembling a real password, token, or connection string with real credentials — must find none.
  - [ ] Confirm `.env` (the real file) is not staged and remains `.gitignore`d.

## Dev Notes

- **Architecture governance:** AD-10 (`ARCHITECTURE-SPINE.md#AD-10`) is the sole authority on the MCP tool choice and its configuration shape: MCP server is `postgres-mcp` (crystaldba, PyPI — the actively maintained replacement for Anthropic's archived, vulnerable `@modelcontextprotocol/server-postgres`), launched via `uvx postgres-mcp --access-mode=restricted`. Configuration is a repo-committed `.mcp.json` that references `DATABASE_URL` from the environment and never inlines a connection string. It must work after `docker compose up` plus copying `.env.example` to `.env` on a fresh clone — no other manual step. Restricted/read-only access mode matches the SPEC's inspect-only MCP usage. [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-10]
- **This is a dev-workflow/config story, not a feature story** — there is no application code to write. The "implementation" is: (1) author `.mcp.json`, (2) actually use the MCP to inspect the live DB, (3) record that usage as evidence. Per `mcp-requirements.md`: "Creating only an MCP configuration file does not count as using the MCP" — Task 3's recorded transcript is not optional polish, it is the acceptance criterion itself (AC2, NFR5). [Source: spec-geocustomer-backend/mcp-requirements.md]
- **`.mcp.json` does not yet exist in this repo** (confirmed absent at repo root as of this story's creation) — this story creates it for the first time. Nothing else in the repo references or expects it yet.
- **Existing `.env` / `.env.example` are already correct and complete** from Stories 1.1–1.2: `.env.example` has `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, and an assembled `DATABASE_URL`, all placeholder values (`changeme`/`localhost:5432/geocustomer`). No new environment variable is needed for the MCP — it reuses the existing `DATABASE_URL`. Do not introduce a second/parallel connection-string variable for the MCP.
- **PostgreSQL MCP client-config schema is not fixed by the architecture spine** — the spine states *what* must be true (references `DATABASE_URL` from environment, no inlined secret, launched via `uvx postgres-mcp --access-mode=restricted`) but not the exact JSON keys, since that is determined by whichever MCP-client tooling reads project-scoped `.mcp.json` files (Claude Code's own convention). Confirm the current expected schema before writing the file (Task 1) rather than guessing a shape that may not be picked up by the client.
- **Access mode is restricted/read-only, not a suggestion.** This story's explicit exclusion is: "No MCP write operations — restricted/read-only access mode only. The MCP is a dev-time tool, not part of the shipped service (not a runtime dependency of the server or seed process)." Do not launch or configure the MCP in an unrestricted/write-capable mode at any point, even transiently for convenience.
- **Do not touch** `apps/api/src/**` (no application code changes in this story — it is purely `.mcp.json` + verification evidence), `docker-compose.yml`, or `seed.ts`. This story adds exactly one new repo-root file (`.mcp.json`) plus recorded verification evidence; everything else stays as Story 1.5 left it.
- **Do not jump ahead:** no README/clean-checkout work (Story 1.7) — that story's `docker compose up`, `.env` setup, migration, seed, server-start, and test-run documentation sequence is out of scope here; this story is MCP-only.

### Previous Story Intelligence (from Story 1.5)

- **Docker Compose discipline established across all prior stories:** `docker compose up -d`, verify healthy/seeded, do the work, then `docker compose down` afterward — volume preserved, no unrelated containers touched. Apply the same discipline to Task 3's verification pass.
- **`DATABASE_URL` must be present in the shell/`.env`** for any real-DB check — unchanged, pre-existing requirement from `db/client.ts` (Story 1.2), which throws immediately if unset. The MCP has the identical dependency.
- **Nx/pnpm invocation note (only relevant if re-running the seed):** this shell environment sets `CLAUDECODE`/`OPENCODE`, switching Nx's CLI into an agent-oriented NDJSON output mode. Prefix plain `nx`/`pnpm` commands with `env -u CLAUDECODE -u OPENCODE` for standard, parseable output.
- **Commit pattern established across Stories 1.2–1.5:** two commits per story, "Prepare Story X.Y ..." then "Implement Story X.Y ...". This story should follow the same pattern when it reaches implementation.
- **Seeded row count is 15** — established and stable since Story 1.3, re-verified in Story 1.4 and 1.5. Task 3's MCP-observed row count must match this.

### Git Intelligence Summary

Recent commit pattern (each story = two commits, "Prepare" then "Implement"):
```
8561b49 Implement Story 1.5 distance endpoint
baa135b Prepare Story 1.5 distance endpoint
7521979 Implement Story 1.4 customer count endpoint
707485c Prepare Story 1.4 count endpoint
8dae686 Implement Story 1.3 idempotent seed workflow
```
No `.mcp.json`, MCP tooling, or MCP-adjacent files have been touched in any prior commit — this story is the first to introduce MCP configuration. Expected diff: one new repo-root file (`.mcp.json`) plus this story file's own updates (transcript/evidence recorded in Dev Agent Record) — no `apps/api/**` changes.

### Project Structure Notes

Builds directly on Stories 1.1–1.5's foundation; adds exactly one new repo-root file. Expected structure after this story (only what this story adds):

```text
{repo-root}/
  .mcp.json                  # NEW — project-scoped MCP config, reads DATABASE_URL from env, --access-mode=restricted
  .env.example                # UNCHANGED — already placeholder-only, already has DATABASE_URL
  docker-compose.yml          # UNCHANGED
  apps/
    api/
      src/                    # UNCHANGED — no application code in this story
```

No `apps/api/src` changes, no new Nx target, no README work — those belong to Story 1.7.

### References

- [Source: planning-artifacts/epics.md, Story 1.6] — approved scope, acceptance criteria, objective, dependencies, exclusions, validation commands
- [Source: architecture/architecture-GeoCustomer-Harness-Lab-2026-07-13/ARCHITECTURE-SPINE.md#AD-10] — MCP tool choice (`postgres-mcp`/crystaldba), launch command, `.mcp.json` shape constraints, restricted/read-only mode, fresh-clone reproducibility requirement
- [Source: ARCHITECTURE-SPINE.md, Structural Seed] — `.mcp.json` repo-root placement
- [Source: ARCHITECTURE-SPINE.md, Stack, "Architecture-level compatibility requirements"] — `postgres-mcp` must support connecting to PostgreSQL 16
- [Source: spec-geocustomer-backend/mcp-requirements.md] — full MCP requirement: configured AND actively used; what "actively used" means (schema, table, row count, sample rows); project-scoped configuration decision; no committed secrets
- [Source: spec-geocustomer-backend/repo-and-docs-quality.md] — no committed secrets, no committed real `.env`, `.env.example` convention
- [Source: _bmad-output/implementation-artifacts/1-5-by-distance-endpoint-with-haversine-and-deterministic-sorting.md] — established Docker Compose discipline, commit pattern, Nx/pnpm invocation note
- [Source: .env.example, docker-compose.yml] — current state read directly during story creation; confirmed no `.mcp.json` exists yet at repo root

## Dependencies and Exclusions

**Dependencies:** Stories 1.2–1.3 (schema and seeded data must exist to inspect).

**Explicitly excluded from this story** (reserved for later stories or permanently out of scope):

- No MCP write operations — restricted/read-only access mode only.
- The MCP is a dev-time tool, not part of the shipped service (not a runtime dependency of the server or seed process).
- No README/clean-checkout work (Story 1.7).
- No application code changes under `apps/api/src`.

## Validation Commands

Run all of the following and confirm the stated result before moving this story to review:

- `uvx postgres-mcp --access-mode=restricted` (or the equivalent client-driven launch reading the committed `.mcp.json`) connects using `DATABASE_URL` from `.env` — no machine-specific manual edit beyond the `.env.example` → `.env` copy.
- A recorded transcript or log excerpt, captured via the connected MCP, showing: the database schema, the `customers` table definition, the seeded row count (15), and sample seeded customer rows.
- Manual/`git grep` inspection of `.mcp.json` and `.env.example` confirming neither contains a password, token, or real credential.

## Definition of Done

- [ ] All 3 acceptance criteria verified against the running implementation
- [ ] All Validation Commands above pass with the stated result
- [ ] No excluded item (MCP write operations, README/clean-checkout work, application code changes) was added
- [ ] Lands as its own small, focused commit
- [ ] Passed code review before being marked done

## Evidence Expected Before Review

- The committed `.mcp.json` file content
- A recorded transcript or log excerpt of the MCP inspecting: schema, `customers` table definition, row count (15), and sample rows
- Confirmation (e.g. `git grep` output or explicit statement) that no secret/credential is present in `.mcp.json` or `.env.example`

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-07-18: Story drafted from `epics.md` Story 1.6 and the approved architecture spine (AD-10). Status set to `ready-for-dev`.
