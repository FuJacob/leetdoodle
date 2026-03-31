# Backend Documentation

This folder is the backend living documentation for LeetCanvas.

## Docs-As-Code Rules

- Docs live in the same repo as backend code.
- Any architecture, contract, or operational behavior change must update docs in the same PR.
- Treat stale docs as a bug: if implementation and docs diverge, fix docs before merge.

## Service Inventory

- `collab` (port `8080`): WebSocket relay for real-time canvas collaboration.
- `leetcode-service` (port `8081`): problem catalog + test-case read APIs.
- `submissions` (port `8082`): submission intake and retrieval; writes transactional outbox.
- `worker` (port `8083`): Rabbit consumer + Docker sandbox evaluator; writes results.

## Quick Links

### C4 Architecture
- [System Context](./architecture/system-context.md)
- [Container View](./architecture/containers.md)
- [Component View](./architecture/components.md)

### Contracts
- [REST API Contracts](./contracts/rest-api.md)
- [WebSocket Event Contracts](./contracts/websocket-events.md)
- [Eval Messaging Contract (Outbox + Rabbit)](./contracts/eval-messaging.md)

### Data and Ops
- [Storage and Migration Timeline](./data/storage-and-migrations.md)
- [Local Runtime and Runbooks](./operations/local-runtime-and-runbooks.md)

### ADRs
- [ADR-0001: Transactional Outbox + Debezium + RabbitMQ](./adrs/ADR-0001-transactional-outbox-debezium-rabbitmq.md)
- [ADR-0002: Worker Direct DB Access](./adrs/ADR-0002-worker-direct-db-access.md)
- [ADR-0003: Stateful In-Memory Collab Relay](./adrs/ADR-0003-stateful-collab-relay.md)

## Ownership and Update Checklist

When changing backend behavior, confirm:

1. Relevant contract docs are updated.
2. C4 component diagram remains accurate.
3. Data docs reflect schema/migration changes.
4. If design tradeoffs changed, add or update an ADR.
