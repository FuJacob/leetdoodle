# ADR-0001: Transactional Outbox + Debezium + RabbitMQ for Eval Dispatch

- Status: Accepted
- Date: 2026-03-30

## Context

Submission creation must persist backend state and trigger async evaluation.
A naive dual-write (`INSERT submission` + `publish Rabbit message`) can lose jobs if process crashes between writes.

## Decision

Use the transactional outbox pattern:

- `submissions` inserts into `submissions.submissions` and `submissions.outbox` in one DB transaction.
- Debezium tails Postgres WAL and publishes outbox payload to RabbitMQ (`eval` exchange, routing key `eval`).
- `worker` consumes from `eval.queue`.

## Consequences

### Positive

- Eliminates dual-write inconsistency for submission creation.
- Retries/recovery come from persisted outbox rows and WAL offsets.
- Keeps submissions API latency low by avoiding synchronous evaluation.

### Negative

- Adds Debezium operational complexity and another runtime component.
- Offset/slot management must be monitored.
- Potential duplicate publication in some recovery scenarios must be tolerated.

## Alternatives Considered

- **Direct Rabbit publish in request transaction**: rejected due to dual-write gap.
- **Synchronous eval in submissions service**: rejected due to latency/timeouts and poor scaling.
