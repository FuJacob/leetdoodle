# Infra Layout

This directory contains shared local infrastructure used by backend services.

## Compose
- `compose/docker-compose.dev.yml`: local infra stack (Postgres, RabbitMQ)
- `compose/docker-compose.hobby.yml`: single-host full backend stack
  (collab + leetcode + submissions + worker + Postgres + RabbitMQ)
- `bundle/hobby-v1/`: source-free deployment template used to package a shareable hobby bundle

## Scripts
Use repo-root scripts:
- `./scripts/backend-restart.sh` — install shared backend artifacts, start infra, wait for readiness, then start all backend services
- `./scripts/backend-down.sh` — stop backend Spring services + infra
  - optional: `./scripts/backend-down.sh --keep-infra`
- `./scripts/package-hobby-bundle.sh` — build a source-free `linux/amd64` deployment bundle under `.artifacts/`
