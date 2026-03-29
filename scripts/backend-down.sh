#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
KEEP_INFRA="${1:-}"

SERVICES=(collab leetcode submissions worker)

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

if [[ "$KEEP_INFRA" == "--keep-infra" ]]; then
  echo "Keeping infra running (--keep-infra set)."
else
  echo "Stopping infra..."
  "$ROOT/scripts/dev-down.sh"
fi

echo "Done."
