# gRPC Contract: Durable Canvas State (`canvas-service`)

This document defines the internal gRPC contract used by `collab` to fetch
durable canvas state and commit structural graph mutations.

## Endpoint (local dev)

- Host: `localhost`
- Port: `9091`
- Service: `com.leetdoodle.grpc.CanvasService`

Primary code references:

- proto source: `services/grpc-api/src/main/proto/canvas_service.proto`
- server impl: `services/canvas/src/main/java/com/leetdoodle/canvas/grpc/CanvasGrpcService.java`
- client wrapper: `services/collab/src/main/java/com/leetdoodle/collab/canvas/CanvasServiceClient.java`

## RPCs

### `GetCanvasSnapshot`

Request:

```json
{
  "canvasId": "canvas-1"
}
```

Response:

```json
{
  "canvasId": "canvas-1",
  "headVersion": 12,
  "nodesJson": "[...]",
  "edgesJson": "[...]"
}
```

Notes:

- Returns the current durable materialized snapshot for one canvas.
- `nodesJson` / `edgesJson` are JSON strings because node payloads are polymorphic.

### `GetCanvasOpsAfter`

Request:

```json
{
  "canvasId": "canvas-1",
  "afterVersion": 12,
  "limit": 200
}
```

Response:

```json
{
  "ops": [
    {
      "id": "uuid",
      "canvasId": "canvas-1",
      "version": 13,
      "clientOperationId": "op-123",
      "actorUserId": "user-123",
      "operationType": "NODE_MOVE",
      "payloadJson": "{\"nodeId\":\"7\",\"x\":100,\"y\":180}"
    }
  ]
}
```

Notes:

- Used for catch-up after a known committed version.
- Current implementation exposes this contract even if the websocket join flow
  is primarily using bootstrap + short-lived in-memory buffering.

### `CommitStructuralOp`

Request:

```json
{
  "canvasId": "canvas-1",
  "clientOperationId": "op-123",
  "actorUserId": "user-123",
  "operationType": "NODE_MOVE",
  "payloadJson": "{\"nodeId\":\"7\",\"x\":100,\"y\":180}"
}
```

Response:

```json
{
  "id": "uuid",
  "canvasId": "canvas-1",
  "version": 13,
  "clientOperationId": "op-123",
  "actorUserId": "user-123",
  "operationType": "NODE_MOVE",
  "payloadJson": "{\"nodeId\":\"7\",\"x\":100,\"y\":180}"
}
```

Notes:

- This is the durable hot path for structural graph edits.
- The canvas service reserves the next version, appends `canvas_ops`, applies
  the materialized node/edge mutation, and commits all of that in one DB
  transaction before returning.

## Error Semantics

- `INVALID_ARGUMENT` for malformed canvas IDs or payloads.
- `NOT_FOUND` for missing nodes/edges targeted by an operation.
- `ALREADY_EXISTS` for structural conflicts currently surfaced as HTTP-409-style conflicts.
- `INTERNAL` for unexpected server failures.

## Operational Notes

- Transport is plaintext in local dev (`grpc.client.canvas-service.negotiation-type=plaintext`).
- `collab` uses a blocking stub because structural websocket handling already runs in a background server thread and needs the committed version synchronously before broadcasting.
