# WebSocket Event Contracts (`collab`)

WebSocket endpoint:

- `ws://localhost:8080/ws`

Transport model:

- Client sends JSON messages with a `type` discriminator.
- Server relays most events opaquely to peers in the same canvas room.
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
- Broadcasts join envelope to peers in the same canvas.

## Event Types (Client -> Server)

Primary outbound events (from `frontend/src/shared/events.ts`):

- `cursor_move` (`userId`, `x`, `y`)
- `node_create` (`node`)
- `node_move` (`nodeId`, `x`, `y`)
- `node_update` (`nodeId`, `patch`)
- `node_delete` (`nodeId`)
- `edge_create` (`edge`)
- `edge_delete` (`edgeId`)
- `node_select` (`userId`, `nodeId|null`)
- `crdt_op` (`docId`, `op`)
- `sync_request` (`docId`, `stateVector`)
- `draw_points` (`points`)
- `draw_end`

## Event Types (Server -> Client)

- `presence_snapshot` (`userIds[]`)
- `user_join` (`userId`)
- mirrored relay events for cursor/node/edge/draw updates with sender `userId`
- `user_leave` (`userId`)
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
