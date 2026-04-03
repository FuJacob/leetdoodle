#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
LOG_DIR="$ROOT/.logs"
COMPOSE_FILE="$ROOT/infra/compose/docker-compose.dev.yml"
SERVICES=(collab leetcode submissions worker)
WAIT_HEALTH_SERVICES=(postgres rabbitmq)

CLEAN_BUILD=1
KEEP_INFRA=0

usage() {
  cat <<USAGE
Usage: ./scripts/backend-restart.sh [--keep-infra] [--clean|--no-clean]

Core workflow:
- installs shared Maven artifacts needed by backend services
- starts local infra (postgres, rabbitmq)
- waits for required infra readiness
- starts Spring backend services and tracks PIDs/logs
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --keep-infra)
      KEEP_INFRA=1
      ;;
    --clean)
      CLEAN_BUILD=1
      ;;
    --no-clean)
      CLEAN_BUILD=0
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

mkdir -p "$RUN_DIR" "$LOG_DIR"

if [[ "$KEEP_INFRA" -eq 1 ]]; then
  "$ROOT/scripts/backend-down.sh" --keep-infra
else
  "$ROOT/scripts/backend-down.sh"
fi

if [[ "$CLEAN_BUILD" -eq 1 ]]; then
  echo "Installing shared backend artifacts with a clean Maven build..."
  mvn -f "$ROOT/services/pom.xml" -pl grpc-api -am clean install -DskipTests
else
  echo "Installing shared backend artifacts..."
  mvn -f "$ROOT/services/pom.xml" -pl grpc-api -am install -DskipTests
fi

echo "Starting infra stack..."
docker compose -f "$COMPOSE_FILE" up -d

container_id_for() {
  docker compose -f "$COMPOSE_FILE" ps -q "$1"
}

wait_for_container_state() {
  local service="$1"
  local target_state="$2"
  local timeout_seconds="$3"

  local container_id
  container_id="$(container_id_for "$service")"
  if [[ -z "$container_id" ]]; then
    echo "Failed to resolve container ID for infra service: $service" >&2
    exit 1
  fi

  local started_at
  started_at="$(date +%s)"

  while true; do
    local current_state
    current_state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id")"

    if [[ "$current_state" == "$target_state" ]]; then
      echo "$service is $target_state"
      return
    fi

    if [[ "$current_state" == "exited" || "$current_state" == "dead" ]]; then
      echo "$service entered state '$current_state' while waiting for '$target_state'." >&2
      docker compose -f "$COMPOSE_FILE" logs --tail=80 "$service" || true
      exit 1
    fi

    if (( $(date +%s) - started_at >= timeout_seconds )); then
      echo "Timed out waiting for $service to become $target_state (last state: $current_state)." >&2
      docker compose -f "$COMPOSE_FILE" logs --tail=80 "$service" || true
      exit 1
    fi

    sleep 2
  done
}

for service in "${WAIT_HEALTH_SERVICES[@]}"; do
  wait_for_container_state "$service" healthy 90
done

start_service() {
  local service="$1"
  local service_dir="$ROOT/services/$service"
  local pid_file="$RUN_DIR/$service.pid"
  local log_file="$LOG_DIR/$service.log"

  if [[ ! -d "$service_dir" ]]; then
    echo "Skipping $service (missing directory: $service_dir)"
    return
  fi

  rm -f "$pid_file"

  echo "Starting $service..."
  (
    cd "$service_dir"
    if [[ "$CLEAN_BUILD" -eq 1 ]]; then
      nohup mvn clean spring-boot:run -DskipTests >"$log_file" 2>&1 &
    else
      nohup mvn spring-boot:run -DskipTests >"$log_file" 2>&1 &
    fi
    echo $! >"$pid_file"
  )

  local pid
  pid="$(cat "$pid_file")"
  sleep 2
  if kill -0 "$pid" 2>/dev/null; then
    echo "$service started (pid: $pid, log: $log_file)"
  else
    echo "Failed to keep $service running. Last 60 log lines:" >&2
    tail -n 60 "$log_file" || true
    exit 1
  fi
}

for service in "${SERVICES[@]}"; do
  start_service "$service"
done

echo
echo "Backend restart complete."
echo "Logs: $LOG_DIR"
echo "Stop everything with: ./scripts/backend-down.sh"
