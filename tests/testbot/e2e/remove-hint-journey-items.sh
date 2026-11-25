#!/usr/bin/env bash
# Removes the items tests/items-hint.e2e.ts adds ("Hint journey item"): the app has no delete route for items,
# so this deletes them in the docker compose database. Exits 0 when there is nothing to remove.
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECT="${COMPOSE_PROJECT_NAME:-skyramp-sut}"
cd "$REPO_DIR"
docker compose -p "$PROJECT" exec -T db \
  psql -U app -d app -v ON_ERROR_STOP=1 -c "DELETE FROM items WHERE name = 'Hint journey item';"
