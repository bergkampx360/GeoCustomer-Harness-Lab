#!/usr/bin/env bash
# Launches the Postgres MCP server (crystaldba/postgres-mcp) against the
# docker-compose Postgres instance. Contains no secrets: it only reads
# DATABASE_URL from the local, git-ignored .env at invocation time and
# rewrites it for container-to-host reachability.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$repo_root/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$repo_root/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "error: DATABASE_URL is not set. Copy .env.example to .env and fill it in before using the Postgres MCP server." >&2
  exit 1
fi

# The MCP server runs in its own container, so "localhost" (valid on the
# host, where Postgres's port is published) must be rewritten to Docker
# Desktop's host gateway so the container can reach it.
container_database_uri="${DATABASE_URL/localhost/host.docker.internal}"

exec docker run -i --rm \
  -e DATABASE_URI="$container_database_uri" \
  crystaldba/postgres-mcp --access-mode=restricted
