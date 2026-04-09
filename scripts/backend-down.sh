#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
COMPOSE_FILE="$ROOT/infra/compose/docker-compose.dev.yml"
KEEP_INFRA=0
WIPE_DB=0

SERVICES=(canvas collab leetcode submissions worker)

usage() {
  cat <<USAGE
Usage: ./scripts/backend-down.sh [--keep-infra] [--wipe-db]

Stops tracked Spring backend services.
By default it also stops local infra containers from infra/compose/docker-compose.dev.yml.
Use --wipe-db to remove the local Postgres volume and reinitialize it on next startup.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --keep-infra)
      KEEP_INFRA=1
      ;;
    --wipe-db)
      WIPE_DB=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$KEEP_INFRA" -eq 1 && "$WIPE_DB" -eq 1 ]]; then
  echo "--keep-infra and --wipe-db cannot be used together." >&2
  usage >&2
  exit 1
fi

stop_service() {
  local service="$1"
  local pid_file="$RUN_DIR/$service.pid"

  if [[ ! -f "$pid_file" ]]; then
    echo "$service not tracked (no pid file)"
    return
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  rm -f "$pid_file"

  if [[ -z "$pid" ]]; then
    echo "$service had empty pid file"
    return
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "$service already stopped (pid: $pid)"
    return
  fi

  echo "Stopping $service (pid: $pid)..."
  kill "$pid" 2>/dev/null || true

  for _ in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "$service stopped"
      return
    fi
    sleep 0.5
  done

  echo "$service did not stop in time; forcing kill"
  kill -9 "$pid" 2>/dev/null || true
}

for service in "${SERVICES[@]}"; do
  stop_service "$service"
done

if [[ "$KEEP_INFRA" -eq 1 ]]; then
  echo "Keeping infra running (--keep-infra set)."
else
  echo "Stopping infra..."
  if [[ "$WIPE_DB" -eq 1 ]]; then
    echo "Removing local infra volumes (--wipe-db set)..."
    docker compose -f "$COMPOSE_FILE" down -v
  else
    docker compose -f "$COMPOSE_FILE" down
  fi
fi

echo "Done."
