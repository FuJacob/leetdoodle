#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
PROJECT_NAME="${PROJECT_NAME:-leetdoodle-hobby}"
IMAGES_TAR="${IMAGES_TAR:-${SCRIPT_DIR}/images/leetdoodle-app-images-amd64.tar}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed." >&2
  exit 1
fi

docker info >/dev/null
docker compose version >/dev/null

if [[ ! -f "${IMAGES_TAR}" ]]; then
  echo "App image tar not found: ${IMAGES_TAR}" >&2
  exit 1
fi

echo "Loading app images from ${IMAGES_TAR}..."
docker load -i "${IMAGES_TAR}" >/dev/null

echo "Starting stack..."
docker compose --project-name "${PROJECT_NAME}" -f "${COMPOSE_FILE}" up -d

cat <<EOF

Stack is starting under project: ${PROJECT_NAME}

Exposed services:
- Collab WebSocket: ws://<host>:18480/ws
- Leetcode API:    http://<host>:18481
- Submissions API: http://<host>:18482
- Worker HTTP:     http://<host>:18483
- RabbitMQ UI:     http://<host>:15673  (leetdoodle / leetdoodle)
- RabbitMQ AMQP:   <host>:15674         (leetdoodle / leetdoodle)
- Postgres:        <host>:15432         (leetdoodle / leetdoodle)

Next checks:
- docker compose --project-name "${PROJECT_NAME}" -f "${COMPOSE_FILE}" ps
- docker compose --project-name "${PROJECT_NAME}" -f "${COMPOSE_FILE}" logs -f

Note:
- postgres, rabbitmq, and debezium may be pulled from Docker Hub on first run.
- worker mounts /var/run/docker.sock, so this host should be dedicated to this stack.
EOF
