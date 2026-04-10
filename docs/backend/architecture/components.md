# C4 Level 3: Component View

This page zooms into each Spring service and maps internal components to their runtime responsibilities.

## canvas-service

```mermaid
flowchart LR
    CG[CanvasGrpcService]
    CS[CanvasService @Transactional]
    CAR[CanvasRepository]
    CNR[CanvasNodeRepository]
    CER[CanvasEdgeRepository]
    COR[CanvasOperationRepository]
    PG[(PostgreSQL canvas schema)]

    CG --> CS
    CS --> CAR
    CS --> CNR
    CS --> CER
    CS --> COR
    CAR --> PG
    CNR --> PG
    CER --> PG
    COR --> PG
```

- `CanvasGrpcService` is the internal service-to-service contract used by collab.
- `CanvasService.applyStructuralOperation()` reserves a new version, appends to `canvas_ops`, applies the materialized write, and commits in one transaction.
- `CanvasRepository` owns canvas-level metadata such as `head_version`.
- `CanvasNodeRepository` and `CanvasEdgeRepository` own the materialized current-state tables.
- `CanvasOperationRepository` owns the ordered recent structural-op log used for catch-up after a known version.

## leetcode-service

```mermaid
flowchart LR
    PC[ProblemController]
    PGS[ProblemGrpcService]
    PS[ProblemService]
    PR[ProblemRepository]
    TR[TestCaseRepository]
    DS[DataSeeder]
    PG[(PostgreSQL public schema)]

    PC --> PS
    PGS --> PG
    PS --> PR
    PS --> TR
    PR --> PG
    TR --> PG
    DS --> PG
```

- `ProblemController` exposes list/by-slug/test-case HTTP endpoints.
- `ProblemGrpcService` exposes internal `GetProblemEval` endpoint for worker.
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
- `OutboxRepository` stores and claims `EvalJob` payloads for the scheduler to publish.

## worker

```mermaid
flowchart LR
    EC[EvalConsumer]
    GC[LeetcodeGrpcClient]
    ER[EvalRunner]
    CP[ContainerPool]
    SRW[SubmissionResultWriter]
    RMQ[(RabbitMQ eval.queue)]
    LEE[(leetcode-service gRPC)]
    PG[(PostgreSQL)]
    DCK[(Docker Engine)]

    RMQ --> EC
    EC --> GC
    EC --> ER
    EC --> SRW
    GC --> LEE
    SRW --> PG
    ER --> CP
    CP --> DCK
```

- `EvalConsumer` orchestrates one job end-to-end from queue message to DB result write.
- `LeetcodeGrpcClient` fetches prompt/entryPoint/test-cases from leetcode-service.
- `EvalRunner` executes all test cases, handles WA/RE/TLE outcomes.
- `ContainerPool` manages pre-warmed single-use sandbox containers.
- `SubmissionResultWriter` persists terminal status/result JSON directly to submissions DB.

## collab

```mermaid
flowchart LR
    WSC[WebSocketConfig /ws]
    CWH[CanvasWebSocketHandler]
    CSC[CanvasServiceClient gRPC]
    CSR[(canvasSessions)]
    S2C[(sessionToCanvas)]
    S2U[(sessionToUserId)]
    OPL[(docOpLog)]
    SEEN[(docSeenOpKeys)]
    CAN[(canvas-service gRPC)]

    WSC --> CWH
    CWH --> CSC
    CWH --> CSR
    CWH --> S2C
    CWH --> S2U
    CWH --> OPL
    CWH --> SEEN
    CSC --> CAN
```

- Join flow registers session/user/canvas mappings and broadcasts presence.
- Durable structural events are committed through canvas-service before collab broadcasts them to peers.
- Ephemeral events are still relayed directly in-memory.
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
