# Javadoc and Teaching Style Guide

This guide defines how backend code should document **what it does**, **why it exists**, and **which tradeoffs were chosen**.

## Goals

- Keep runtime behavior understandable without reading every call site.
- Make distributed-systems decisions explicit (ordering, idempotency, back pressure, retries).
- Help new contributors learn architecture through code comments and doc links.

## Scope

Apply this guide to all Java modules under `services/`:

- `collab`
- `leetcode`
- `submissions`
- `worker`
- shared gRPC contracts in `grpc-api` when Java sources are added there

## Baseline Requirements

### Type-Level Javadoc (required)

Every top-level class/interface/record must include a short Javadoc block that states:

1. Responsibility in one sentence.
2. Placement in architecture (controller/service/repository/consumer/runner).
3. Any non-obvious system boundary (DB, RabbitMQ, gRPC, Docker, WebSocket).

### Public Method Javadoc (required for entry points)

Required for public methods that are externally invoked or architecturally important:

- Spring entry points (`@RestController`, `@RabbitListener`, `ApplicationRunner`, WebSocket handlers)
- Service methods that define domain behavior
- Repository methods that encode SQL semantics
- Runtime orchestration methods in worker execution paths

For these methods, document:

1. Inputs/outputs in domain terms.
2. Failure behavior (throws, terminal states, retries, nacks, HTTP status).
3. Consistency implications (atomicity, idempotency, ordering assumptions).

### Field/Accessor Javadoc (required for domain models)

Domain model contracts (`Problem`, `Submission`, `EvalJob`, etc.) should document fields that are:

- persisted,
- externally serialized,
- or interpreted by another service.

This prevents schema drift and semantic ambiguity.

## Service-Specific Guidance

### `collab`

- Call out session-vs-user semantics clearly.
- Document fan-out behavior and single-instance state assumptions.
- Describe replay/dedup strategy for CRDT operations where relevant.

### `leetcode`

- Clarify source-of-truth fields from external datasets.
- Document pagination/filter semantics in controllers and repositories.
- Explain seeder idempotency and batch tradeoffs.

### `submissions`

- Emphasize transactional outbox guarantees.
- Document async lifecycle states and polling expectations.
- Note exactly when rows are considered terminal.

### `worker`

- Document execution isolation boundaries (container pool, timeouts, language/runtime limits).
- Explain status mapping from runner outcomes to persisted submission status.
- Call out back-pressure controls (`prefetch`, queue behavior, retry implications).

## Teaching Notes Pattern

For non-trivial behavior, include short “teaching notes” in Javadocs/comments using this structure:

- **What:** concrete behavior.
- **Why:** reason this design was chosen.
- **Tradeoff:** what was given up.

Keep notes concise and colocated with the code they describe.

## Documentation Update Workflow

When backend behavior changes in a PR:

1. Update Java Javadocs in touched files.
2. Update one or more docs under `docs/backend/` (contracts, architecture, ops, ADRs) if behavior changed.
3. If the decision changes architecture constraints, add/update an ADR.

## Review Checklist

Before merging backend changes, verify:

1. Every new top-level Java type has type-level Javadoc.
2. New entry-point methods include behavior + failure semantics.
3. Distributed-system assumptions are explicit where relevant.
4. `docs/backend/README.md` links remain current.
5. Docs and implementation describe the same behavior.
