# ADR-0001: Transactional Outbox + Scheduled Dispatcher + RabbitMQ for Eval Dispatch

- Status: Accepted
- Date: 2026-04-03

## Context

Submission creation must persist backend state and trigger async evaluation.
A naive dual-write (`INSERT submission` + `publish Rabbit message`) can lose jobs if process crashes between writes.

## Decision

Use the transactional outbox pattern:

- `submissions` inserts into `submissions.submissions` and `submissions.outbox` in one DB transaction.
- `submissions` runs an in-process scheduled dispatcher that claims unpublished outbox rows and publishes them to RabbitMQ (`eval` exchange, routing key `eval`).
- `worker` consumes from `eval.queue`.

## Consequences

### Positive

- Eliminates dual-write inconsistency for submission creation.
- Retries/recovery come from persisted outbox rows plus dispatcher claim leases.
- Keeps submissions API latency low by avoiding synchronous evaluation.
- Removes Debezium operational overhead and Postgres logical replication requirements.

### Negative

- Dispatcher logic now lives in application code and must be maintained by us.
- Potential duplicate publication in some crash windows must be tolerated.
- Polling introduces a small dispatch delay compared with change-stream style forwarding.

## Alternatives Considered

- **Direct Rabbit publish in request transaction**: rejected due to dual-write gap.
- **Synchronous eval in submissions service**: rejected due to latency/timeouts and poor scaling.
