# REST API Contracts

This document captures the backend HTTP contracts currently implemented by Spring controllers.

## Base URLs (local dev)

- `http://localhost:8084` -> `canvas-service`
- `http://localhost:8081` -> `leetcode-service`
- `http://localhost:8082` -> `submissions`

## Canvas API (`/api/canvases`)

### `GET /api/canvases/{canvasId}`

Returns the current durable materialized state for one canvas:

```json
{
  "canvasId": "canvas-1",
  "headVersion": 12,
  "nodes": [],
  "edges": []
}
```

Notes:

- New canvases return an empty snapshot with `headVersion = 0`.
- This is the durable bootstrap source of truth for structural canvas state.

### `GET /api/canvases/{canvasId}/ops?afterVersion={n}&limit={m}`

Returns committed structural ops newer than the caller's known version.

Notes:

- `afterVersion` is required and must be `>= 0`.
- `limit` is optional and defaults to `200`.
- Current ops are durable structural changes only, not cursor/presence traffic.

### `POST /api/canvases/{canvasId}/ops`

Commits one structural operation transactionally.

Request body shape:

```json
{
  "clientOperationId": "op-123",
  "actorUserId": "user-123",
  "operationType": "NODE_MOVE",
  "payload": {
    "nodeId": "node-1",
    "x": 420,
    "y": 180
  }
}
```

Notes:

- `clientOperationId` is required for idempotent retries.
- Supported durable operation types are:
  - `NODE_CREATE`
  - `NODE_MOVE`
  - `NODE_UPDATE`
  - `NODE_DELETE`
  - `EDGE_CREATE`
  - `EDGE_DELETE`
- The service reserves the next canvas version, appends the op log row, applies the materialized table mutation, and commits all of that in one DB transaction.

## Problems API (`/api/problems`)

### `GET /api/problems`

Query params:

- `difficulty` (optional, example: `Easy`)
- `tag` (optional, example: `Array`)
- `page` (default `0`)
- `size` (default `20`)

Response shape:

```json
{
  "content": [
    {
      "id": 1,
      "questionId": 1,
      "title": "Two Sum",
      "content": "<p>...</p>",
      "difficulty": "Easy",
      "likes": 123,
      "dislikes": 7,
      "category": "Algorithms",
      "isPaidOnly": false,
      "hasSolution": true,
      "hasVideoSolution": false,
      "slug": "two-sum",
      "url": "https://leetcode.com/problems/two-sum/",
      "solutionContent": null,
      "similarQuestions": "[]",
      "stats": "{...}",
      "companyTags": null,
      "prompt": null,
      "entryPoint": null,
      "starterCode": null,
      "hints": [],
      "tags": [{ "id": 1, "name": "Array" }]
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 100,
  "totalPages": 5
}
```

### `GET /api/problems/slug/{slug}`

- Returns one `Problem`.
- Returns `404` when slug does not exist.

### `GET /api/problems/{id}/test-cases`

- Returns `TestCase[]` for evaluation.
- This endpoint still exists but is no longer used by worker in the hot path
  (worker now uses internal gRPC to leetcode-service).
- Shape:

```json
[
  {
    "id": 10,
    "problemId": 1,
    "input": "2,7,11,15\n9",
    "output": "[0,1]"
  }
]
```

## Submissions API (`/api/submissions`)

### `POST /api/submissions`

Request body:

```json
{
  "questionId": 1,
  "userId": "user-123",
  "language": "javascript",
  "code": "function twoSum(...) { ... }"
}
```

Response body:

```json
{
  "submissionId": "8d9f2b09-1478-42e7-9584-96918987e8cd"
}
```

Notes:

- Submission creation is synchronous; evaluation is asynchronous.
- Client must poll by ID for completion.

### `GET /api/submissions/{id}`

Returns a polling status envelope:

```json
{
  "status": "PENDING",
  "result": null
}
```

`status` transitions:

- `PENDING`
- terminal statuses from worker: `ACCEPTED`, `WRONG_ANSWER`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`

`result` notes:

- `result` is a JSON string written by worker (or `null` while pending).
- Typical shape after terminal states:
  - `cases[]` with per-case pass/fail and actual/expected
  - optional `errorMessage` for runtime failures

## Error Contract Notes

- Controllers currently rely on Spring defaults (`ResponseStatusException` for not-found cases).
- No unified error envelope yet; clients should handle standard Spring Boot error payloads.
