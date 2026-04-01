#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-leetcanvas}"
DB_USER="${DB_USER:-leetcanvas}"
DB_PASSWORD="${DB_PASSWORD:-leetcanvas}"

ASSUME_YES="${1:-}"

echo "About to reset database schemas in ${DB_NAME} on ${DB_HOST}:${DB_PORT}."
echo "This will DROP and recreate: public, submissions."

if [[ "$ASSUME_YES" != "--yes" ]]; then
  read -r -p "Type 'reset' to continue: " confirm
  if [[ "$confirm" != "reset" ]]; then
    echo "Aborted."
    exit 1
  fi
fi

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 <<SQL
DROP SCHEMA IF EXISTS submissions CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public AUTHORIZATION ${DB_USER};
CREATE SCHEMA submissions AUTHORIZATION ${DB_USER};
SQL

echo
echo "Database reset complete."
echo "Next step: ${ROOT}/scripts/backend-restart.sh"
