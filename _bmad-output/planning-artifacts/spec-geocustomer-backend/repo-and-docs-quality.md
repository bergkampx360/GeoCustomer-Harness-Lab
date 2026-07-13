# Documentation and Repository-Quality Requirements

## Development process

- Use small, focused commits, so the development process itself is visible.
- Verify each meaningful milestone before committing.
- Do not hide, ignore, or bypass failures.
- Do not weaken tests merely to make them pass.
- Do not commit secrets.
- Do not commit the real `.env` file; provide an `.env.example` file when environment variables are required.

## README

Must document how to run the project:

- starting Postgres;
- running the migration;
- running the seed;
- starting the server;
- running the tests.
