# Infra Layout

This directory contains shared local infrastructure used by backend services.

## Compose
- `compose/docker-compose.dev.yml`: local infra stack (Postgres, RabbitMQ, Debezium)

## Debezium
- `debezium/conf/application.properties`: Debezium Server config

## Scripts
Use repo-root scripts:
- `./scripts/dev-up.sh` — start infra stack in background
- `./scripts/dev-down.sh` — stop and remove infra containers
- `./scripts/dev-logs.sh` — follow infra logs
- `./scripts/dev-ps.sh` — list infra container status
