# ADR-0002: Worker Uses Direct DB Access for Eval Critical Path

- Status: Superseded (read path) by ADR-0004; write path still applies
- Date: 2026-03-30

## Context

At the time of this decision, worker needed to:

- fetch test cases by `problemId`
- write status/result by `submissionId`

This can be done either through service-to-service HTTP APIs or direct SQL access.

## Decision

Use direct JDBC access from worker to Postgres for both reads and writes.

Update:

- Read path has moved to internal gRPC (`leetcode-service` `GetProblemEval`) in ADR-0004.
- Write path remains direct JDBC (`SubmissionResultWriter`).

## Consequences

### Positive

- Lower latency and fewer network hops in eval path.
- Fewer moving parts during execution (no dependency on upstream API availability).
- Simpler consumer orchestration code.

### Negative

- Tighter coupling to table/schema contracts across services.
- Schema changes require coordinated updates in worker.
- Service boundaries are less strict at data layer.

## Alternatives Considered

- **Worker calls `leetcode-service` and `submissions` over HTTP**:
  - cleaner ownership boundaries
  - rejected for now due to increased runtime dependencies and latency in hot path
