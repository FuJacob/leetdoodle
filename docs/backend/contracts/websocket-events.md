# WebSocket Event Contracts (`collab`)

WebSocket endpoint:

- `ws://localhost:8080/ws`

Transport model:

- Client sends JSON messages with a `type` discriminator.
- Ephemeral events are relayed directly in-memory.
- Durable structural events are committed through `canvas-service` first, then broadcast with committed metadata.
- `crdt_op` and `sync_request` are special-cased for replay/sync.

## Join Flow

Initial client message:

```json
{
  "type": "join",
  "canvasId": "canvas-1",
  "userId": "user-123"
}
```

Server behavior:

- Adds session to room (`canvasSessions`).
- Tracks reverse indices (`sessionToCanvas`, `sessionToUserId`).
- Sends `presence_snapshot` to the newly joined session.
- Sends `canvas_bootstrap` with durable snapshot state from `canvas-service`.
- Broadcasts `user_join` to peers in the same canvas.

Presence identity model:

- `userId` is currently tab/session-scoped (one browser tab = one participant).
- Presence events represent active sessions, not deduplicated people.

## Event Types (Client -> Server)

Primary outbound events (from `frontend/src/shared/events.ts`):

- `cursor_move` (`userId`, `x`, `y`)
- `node_create` (`node`)
- `node_move` (`nodeId`, `x`, `y`)
- `node_drag_start` (`nodeIds[]`)
- `node_drag_end`
- `node_update` (`nodeId`, `patch`)
- `node_delete` (`nodeId`)
- `edge_create` (`edge`)
- `edge_delete` (`edgeId`)
- `node_select` (`userId`, `nodeId|null`)
- `crdt_op` (`docId`, `op`)
- `sync_request` (`docId`, `stateVector`)
- `draw_points` (`points`, `thickness`)
- `draw_end`

## Event Types (Server -> Client)

- `presence_snapshot` (`users[]`, each item: `{ id, color }`)
- `canvas_bootstrap` (`canvasId`, `headVersion`, `nodes[]`, `edges[]`)
- `user_join` (`user`, shape: `{ id, color }`)
- mirrored relay events for cursor/draw updates with sender `userId`
- committed structural events include:
  - `version`
  - `eventId`
  - `clientOperationId`
  - `userId`
- mirrored relay events include drag lifecycle (`node_drag_start`, `node_drag_end`)
- `user_leave` (`userId`, tab/session participant id)
- `sync_response` (`docId`, `ops[]`)

## CRDT Replay Behavior

### `crdt_op`

Example:

```json
{
  "type": "crdt_op",
  "canvasId": "canvas-1",
  "userId": "user-123",
  "docId": "node-42",
  "op": {
    "actor": "user-123",
    "seq": 14
  }
}
```

Server path:

1. Build doc key: `{canvasId}::{docId}`.
2. Build op key: `{actor}:{seq}`.
3. Dedup via `docSeenOpKeys`.
4. Append op deep-copy to `docOpLog`.
5. Relay raw payload to peers.

### `sync_request` / `sync_response`

Request example:

```json
{
  "type": "sync_request",
  "canvasId": "canvas-1",
  "docId": "node-42",
  "stateVector": {
    "user-123": 14,
    "user-456": 9
  }
}
```

Response example:

```json
{
  "type": "sync_response",
  "docId": "node-42",
  "ops": [
    { "actor": "user-123", "seq": 15 }
  ]
}
```

## Disconnect Behavior

On socket close:

- Session removed from room and reverse indices.
- `user_leave` broadcast to remaining peers.
- Empty canvas room registry entry removed.
