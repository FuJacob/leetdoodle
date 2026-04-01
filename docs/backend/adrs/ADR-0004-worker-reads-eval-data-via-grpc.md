# ADR-0004: Worker Reads Eval Data via gRPC from leetcode-service

- Status: Accepted
- Date: 2026-03-31

## Context

Worker previously read eval test cases directly from Postgres (`public.test_cases`),
which created two issues:

- Cross-service schema coupling (worker depended on leetcode schema details).
- Weak service boundary ownership for eval metadata (`prompt`, `entry_point`, test cases).

In parallel, leetcode-service now owns richer eval metadata and runs an internal
gRPC server (`ProblemService/GetProblemEval`) backed by a shared proto contract
module (`grpc-api`).

## Decision

Move worker eval-data reads to gRPC:

- Worker calls leetcode-service `GetProblemEval(problemId)` before execution.
- Response includes `prompt`, `entry_point`, and ordered `test_cases`.
- Worker keeps direct JDBC writes for submission status/result persistence.

## Consequences

### Positive

- Stronger ownership boundaries: leetcode-service owns eval-data projection.
- Lower schema coupling in worker (no direct reads from leetcode tables).
- Strongly typed internal contract shared through proto generation.

### Negative

- New runtime dependency: worker requires leetcode gRPC availability.
- Additional operational surface: gRPC channel config/health now matters.

## Alternatives Considered

- **Keep direct DB reads in worker**:
  - lower runtime dependency count
  - rejected due to long-term schema coupling and weaker service ownership.

- **Worker calls leetcode HTTP endpoint for test cases + metadata**:
  - simpler tooling than gRPC
  - rejected because typed contract and compact binary transport were preferred.
