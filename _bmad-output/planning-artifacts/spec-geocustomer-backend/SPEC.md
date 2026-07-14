---
id: SPEC-geocustomer-backend
companions:
  - data-and-seed.md
  - api-contract.md
  - testing-requirements.md
  - mcp-requirements.md
  - technical-stack.md
  - repo-and-docs-quality.md
  - excluded-scope.md
sources:
  - ../../../docs/assignment.md
  - ../../../docs/technical-constraints.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. `docs/assignment.md` and `docs/technical-constraints.md` remain the authoritative, frozen, unmodified originals; this SPEC is a lossless distillation of them, not a replacement. Consult the originals only for narrative/prose color this contract intentionally omits.

# GeoCustomer Backend Service

## Why

A mandate to meet: build a small, self-contained, offline REST service over PostgreSQL that exposes the seeded customer list with each customer's distance from Budapest. The service must run without any external API or LLM call at runtime, using only a locally bundled settlement-to-coordinate reference. The same frozen specification governs an independent, parallel implementation on another branch, so this contract must preserve the source requirements exactly, without broadening or reinterpreting them.

## Capabilities

Functional requirements, expressed as capabilities:

- **CAP-1**
  - **intent:** A client can retrieve the total number of seeded customers via `GET /customers/count`.
  - **success:** The response body's `count` field exactly equals the current row count in the `customers` table.

- **CAP-2**
  - **intent:** A client can retrieve all customers ordered by ascending distance from Budapest via `GET /customers/by-distance`, each annotated with its distance.
  - **success:** Sorting is by each customer's raw, unrounded Haversine distance; `distanceKm` in the response is that same raw distance rounded to one decimal, for display only. Budapest-located customers appear first, each with `distanceKm: 0`. Customers with unresolved coordinates appear after every customer with a calculable distance, each with `distanceKm: null`. Ties are broken by ascending `name`, applied only when two customers' raw distances are exactly equal. See `api-contract.md` for the full contract and `data-and-seed.md` for how distance is calculated.

- **CAP-3**
  - **intent:** The system can idempotently load the fixed seed file and offline-geocode each customer's settlement to `lat`/`lon` using a bundled local reference, with no external network calls.
  - **success:** Running the seed command twice against the same database leaves exactly one row per seed customer (no duplicates). Every customer whose settlement matches the bundled reference gets non-null `lat`/`lon`. Any settlement absent from the reference yields `lat`/`lon = null`, is logged, and does not stop processing of the remaining rows. See `data-and-seed.md`.

## Constraints

- TypeScript strict mode, pnpm, Node.js LTS, Nx monorepo kept minimal — see `technical-stack.md`.
- Fastify exposes exactly `GET /customers/count` and `GET /customers/by-distance`; no `POST`/`PUT`/`PATCH`/`DELETE` endpoints of any kind — see `api-contract.md`.
- PostgreSQL runs locally via Docker Compose; Prisma is used for schema, migrations, seed, and typed access — see `technical-stack.md`.
- No runtime LLM calls and no external geocoding API calls — the service runs fully offline.
- The seed process runs through a dedicated command, separate from the HTTP API, and is never exposed as an endpoint.
- Vitest is the test framework; the Haversine distance calculation must have unit tests — see `testing-requirements.md`.
- The original seed file `data/seed-customers.json` must not be modified.
- PostgreSQL MCP must be configured (project-scoped, per the definition in `mcp-requirements.md`) and actively used during development, not merely configured.
- Small, focused, verified commits; no secrets or the real `.env` file may be committed — see `repo-and-docs-quality.md`.
- `location.countryCode` is persisted on the `customers` data model but is not exposed in any API response — see `data-and-seed.md` and `api-contract.md`.

## Non-goals

No frontend, no authentication or authorization, no CRUD endpoints beyond the two specified GETs, and no message queues, event sourcing, CQRS, Kubernetes, cloud deployment, PostGIS, or runtime AI integration. Full exclusion list in `excluded-scope.md`.

## Success signal

Following the README end to end — starting Postgres via Docker Compose, running the migration, running the seed command twice, starting the server, and running the test suite — produces: no duplicate rows after the second seed run; `GET /customers/count` returning the exact row count; `GET /customers/by-distance` returning all customers ascending by raw distance (displayed as `distanceKm`, rounded to one decimal) with Budapest customers first at `0`, unresolved-location customers last with `null`, ties broken by `name` only when raw distances are exactly equal; and passing Haversine unit tests covering the Budapest–Vienna case (~214 km), the zero-distance case, and the null-coordinate case.

## Assumptions

- Only PostgreSQL itself is required to run via Docker Compose. Neither source document states that the Fastify API process itself must be containerized, so the API is assumed to run directly (via pnpm/node) against the Dockerized Postgres instance.
- "Node.js LTS" is treated as whichever LTS release is current at implementation time, since neither document pins an exact version.
