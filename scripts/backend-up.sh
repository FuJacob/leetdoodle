#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
LOG_DIR="$ROOT/.logs"

SERVICES=(collab leetcode submissions worker)

mkdir -p "$RUN_DIR" "$LOG_DIR"

echo "Installing shared grpc-api module (and parent POM) into local Maven repo..."
mvn -f "$ROOT/services/pom.xml" -pl grpc-api -am install -DskipTests

echo "Starting infra..."
"$ROOT/scripts/dev-up.sh"

start_service() {
  local service="$1"
  local service_dir="$ROOT/services/$service"
  local pid_file="$RUN_DIR/$service.pid"
  local log_file="$LOG_DIR/$service.log"

  if [[ ! -d "$service_dir" ]]; then
    echo "Skipping $service (missing directory: $service_dir)"
    return
  fi

  if [[ -f "$pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" 2>/dev/null; then
      echo "$service already running (pid: $existing_pid)"
      return
    fi
    rm -f "$pid_file"
  fi

  echo "Starting $service..."
  (
    cd "$service_dir"
    nohup mvn spring-boot:run >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  local pid
  pid="$(cat "$pid_file")"
  sleep 1
  if kill -0 "$pid" 2>/dev/null; then
    echo "$service started (pid: $pid, log: $log_file)"
  else
    echo "Failed to keep $service running. Last 40 log lines:"
    tail -n 40 "$log_file" || true
    exit 1
  fi
}

for service in "${SERVICES[@]}"; do
  start_service "$service"
done

echo
echo "All backend services started."
echo "Logs: $LOG_DIR"
echo "Stop everything with: ./scripts/backend-down.sh"
