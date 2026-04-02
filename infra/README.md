# Infra Layout

This directory contains shared local infrastructure used by backend services.

## Compose
- `compose/docker-compose.dev.yml`: local infra stack (Postgres, RabbitMQ, Debezium)
- `compose/docker-compose.hobby.yml`: single-host full backend stack
  (collab + leetcode + submissions + worker + Postgres + RabbitMQ + Debezium)
- `bundle/hobby-v1/`: source-free deployment template used to package a shareable hobby bundle

## Debezium
- `debezium/conf/application.properties`: Debezium Server config

## Scripts
Use repo-root scripts:
- `./scripts/dev-up.sh` — start infra stack in background
- `./scripts/dev-down.sh` — stop and remove infra containers
- `./scripts/dev-logs.sh` — follow infra logs
- `./scripts/dev-ps.sh` — list infra container status
- `./scripts/backend-up.sh` — start infra + all backend Spring services
- `./scripts/backend-down.sh` — stop backend Spring services + infra
  - optional: `./scripts/backend-down.sh --keep-infra`
- `./scripts/package-hobby-bundle.sh` — build a source-free `linux/amd64` deployment bundle under `.artifacts/`
