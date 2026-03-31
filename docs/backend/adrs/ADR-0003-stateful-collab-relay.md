# ADR-0003: Stateful In-Memory Collab Relay with CRDT Op Log

- Status: Accepted
- Date: 2026-03-30

## Context

Real-time collaboration requires fan-out to active peers in the same canvas and lightweight replay for reconnecting clients.

## Decision

Use a stateful WebSocket relay process with in-memory maps:

- `canvasSessions` for room membership
- `sessionToCanvas` and `sessionToUserId` for O(1) cleanup on disconnect
- `docOpLog` and `docSeenOpKeys` for CRDT replay + dedup

## Consequences

### Positive

- Very low implementation and runtime complexity for single-instance deployment.
- Supports realtime fan-out plus replay (`sync_request`) without external broker.
- Keeps server mostly schema-agnostic for non-CRDT event types.

### Negative

- Not horizontally scalable without shared state/pub-sub.
- Restart loses in-memory op log history.
- Memory growth risk if retention/compaction is not introduced.

## Alternatives Considered

- **Redis-backed room registry + pub/sub**: better scale-out, higher operational complexity.
- **Kafka-backed event sourcing for collab stream**: strongest replay/audit story, too heavy for current stage.
