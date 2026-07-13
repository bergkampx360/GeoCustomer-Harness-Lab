# PostgreSQL MCP Requirements

- PostgreSQL MCP must be configured **and** actively used during development — configuring it is necessary but not sufficient.
- Creating only an MCP configuration file does not count as using the MCP.
- During development, the MCP must be used to inspect:
  - the database schema;
  - the `customers` table;
  - the seeded row count;
  - sample seeded customer data.
- Secrets and local credentials used by the MCP must not be committed (cross-referenced in `repo-and-docs-quality.md`).

## Project-scoped configuration (decision)

"Project-scoped PostgreSQL MCP configuration" means:

- the MCP configuration is stored in the repository;
- it must work from a fresh clone after documented local setup;
- connection details and secrets come from environment variables;
- no password, token, or local secret may be committed;
- the MCP must be actively used during development or verification, as required above.

The concrete MCP server package, Docker image, and launch mechanism are **not** decided here — that choice belongs to the architecture phase.
