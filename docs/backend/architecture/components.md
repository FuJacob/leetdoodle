# C4 Level 3: Component View

This page zooms into each Spring service and maps internal components to their runtime responsibilities.

## leetcode-service

```mermaid
flowchart LR
    PC[ProblemController]
    PS[ProblemService]
    PR[ProblemRepository]
    TR[TestCaseRepository]
    DS[DataSeeder]
    PG[(PostgreSQL public schema)]

    PC --> PS
    PS --> PR
    PS --> TR
    PR --> PG
    TR --> PG
    DS --> PG
```

- `ProblemController` exposes list/by-slug/test-case endpoints.
- `ProblemService` centralizes retrieval and not-found handling.
- Repositories use SQL via JDBC templates (no ORM).
- `DataSeeder` loads problem/test-case datasets on startup when enabled.

## submissions

```mermaid
flowchart LR
    SC[SubmissionController]
    SS[SubmissionService @Transactional]
    SR[SubmissionRepository]
    OR[OutboxRepository]
    PG[(PostgreSQL submissions schema)]

    SC --> SS
    SS --> SR
    SS --> OR
    SR --> PG
    OR --> PG
```

- `SubmissionController` handles submit + polling endpoints.
- `SubmissionService.submit()` performs submission insert and outbox insert in one transaction.
- `OutboxRepository` stores `EvalJob` payload for Debezium to publish.

## worker

```mermaid
flowchart LR
    EC[EvalConsumer]
    TCR[TestCaseReader]
    ER[EvalRunner]
    CP[ContainerPool]
    SRW[SubmissionResultWriter]
    RMQ[(RabbitMQ eval.queue)]
    PG[(PostgreSQL)]
    DCK[(Docker Engine)]

    RMQ --> EC
    EC --> TCR
    EC --> ER
    EC --> SRW
    TCR --> PG
    SRW --> PG
    ER --> CP
    CP --> DCK
```

- `EvalConsumer` orchestrates one job end-to-end from queue message to DB result write.
- `EvalRunner` executes all test cases, handles WA/RE/TLE outcomes.
- `ContainerPool` manages pre-warmed single-use sandbox containers.
- Reader/writer components perform direct SQL reads/writes for eval-path latency.

## collab

```mermaid
flowchart LR
    WSC[WebSocketConfig /ws]
    CWH[CanvasWebSocketHandler]
    CSR[(canvasSessions)]
    S2C[(sessionToCanvas)]
    S2U[(sessionToUserId)]
    OPL[(docOpLog)]
    SEEN[(docSeenOpKeys)]

    WSC --> CWH
    CWH --> CSR
    CWH --> S2C
    CWH --> S2U
    CWH --> OPL
    CWH --> SEEN
```

- Join flow registers session/user/canvas mappings and broadcasts presence.
- Generic events are relayed as opaque payloads to peers in canvas room.
- `crdt_op` path does dedup + op-log append + broadcast.
- `sync_request` path returns missing ops by state vector.

## Collab Sync Sequence

```mermaid
sequenceDiagram
    participant A as Client A
    participant S as collab
    participant B as Client B

    A->>S: join(canvasId,userId)
    S-->>B: user_join / presence updates

    A->>S: crdt_op(docId, op{actor,seq,...})
    S->>S: dedup + append to docOpLog
    S-->>B: crdt_op

    B->>S: sync_request(docId,stateVector)
    S->>S: filter missing ops (seq > seenSeq)
    S-->>B: sync_response(ops[])
```
