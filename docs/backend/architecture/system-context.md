# C4 Level 1: System Context

This view shows LeetDoodle backend interactions with users and supporting infrastructure.

```mermaid
flowchart LR
    U["Developer / Learner\n(Frontend User)"]
    FE[LeetDoodle Frontend\n(Vite + React)]

    subgraph LC[LeetDoodle Backend System]
      COL[Collab Service\nWebSocket relay]
      LEE[Leetcode Service\nProblems + test cases API]
      SUB[Submissions Service\nSubmission intake API]
      WRK[Worker Service\nCode evaluator]
    end

    subgraph INFRA[Local/Runtime Infrastructure]
      PG[(PostgreSQL)]
      RMQ[(RabbitMQ)]
      DBZ[Debezium Server]
      DCK[(Docker Engine)]
    end

    U --> FE
    FE <-->|/ws realtime| COL
    FE <-->|/api/problems| LEE
    FE <-->|/api/submissions| SUB
    WRK <-->|gRPC :9090| LEE

    LEE <--> PG
    SUB <--> PG
    SUB -->|writes outbox row| PG
    DBZ -->|publishes eval job| RMQ
    DBZ <-->|CDC WAL| PG
    WRK <-->|consumes eval jobs| RMQ
    WRK <--> PG
    WRK -->|exec sandbox| DCK
```

## External Actors and Systems

- **Frontend users** interact only through the frontend client.
- **Frontend app** is the sole direct consumer of HTTP/WebSocket backend APIs.
- **Infrastructure dependencies** are PostgreSQL, RabbitMQ, Debezium, and Docker.

## Key Responsibility Boundaries

- `collab` owns low-latency multi-user event relay.
- `leetcode-service` owns problem catalog and internal eval-data serving (gRPC).
- `submissions` owns submission creation lifecycle and outbox write.
- `worker` owns async evaluation execution and result persistence.
