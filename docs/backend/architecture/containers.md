# C4 Level 2: Container View

This view decomposes the backend system into deployable runtime containers/processes.

```mermaid
flowchart TB
    FE[Frontend\nReact/Vite]

    subgraph APP[Spring Boot Services]
      COL[collab\n:8080]
      LEE[leetcode-service\n:8081]
      SUB[submissions\n:8082]
      WRK[worker\n:8083]
    end

    subgraph DATA[Data and Messaging]
      PG[(PostgreSQL\nleetcanvas)]
      RMQ[(RabbitMQ\neval exchange)]
      DBZ[Debezium Server\nOutbox Router]
    end

    DCK[(Docker Engine)]

    FE <-->|WebSocket /ws| COL
    FE <-->|HTTP /api/problems| LEE
    FE <-->|HTTP /api/submissions| SUB

    LEE --> PG
    SUB --> PG
    SUB -->|outbox row in same tx| PG
    DBZ -->|CDC from submissions.outbox| PG
    DBZ -->|EvalJob JSON| RMQ
    WRK -->|consume eval.queue| RMQ
    WRK -->|read test_cases + write results| PG
    WRK --> DCK
```

## Container Responsibilities

- **collab**: Room/session registry, fan-out relay, in-memory CRDT op-log for replay.
- **leetcode-service**: Paginated/filterable problem APIs and test-case fetch API.
- **submissions**: Accepts code submissions, persists row, persists outbox event in same transaction.
- **worker**: Pulls eval jobs, runs code in sandbox containers, writes status/result JSON back.
- **Debezium**: Bridges DB outbox rows to RabbitMQ messages.

## Submission Evaluation Sequence

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant SUB as submissions
    participant PG as PostgreSQL
    participant DBZ as Debezium
    participant RMQ as RabbitMQ
    participant WRK as worker
    participant DCK as Docker

    FE->>SUB: POST /api/submissions
    SUB->>PG: INSERT submission + INSERT outbox (same tx)
    PG-->>SUB: commit
    SUB-->>FE: { submissionId }

    DBZ->>PG: read WAL (submissions.outbox)
    DBZ->>RMQ: publish EvalJob (routing key: eval)
    WRK->>RMQ: consume eval.queue
    WRK->>PG: read test_cases
    WRK->>DCK: execute code in container
    WRK->>PG: UPDATE submissions.submissions (status/result)
    FE->>SUB: GET /api/submissions/{id} (poll)
    SUB-->>FE: status + result
```
