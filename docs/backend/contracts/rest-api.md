# REST API Contracts

This document captures the backend HTTP contracts currently implemented by Spring controllers.

## Base URLs (local dev)

- `http://localhost:8081` -> `leetcode-service`
- `http://localhost:8082` -> `submissions`

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

Returns a `Submission` record:

```json
{
  "id": "8d9f2b09-1478-42e7-9584-96918987e8cd",
  "problemId": 1,
  "userId": "user-123",
  "language": "javascript",
  "code": "function twoSum(...) { ... }",
  "status": "PENDING",
  "result": null,
  "createdAt": "2026-03-30T23:43:09.216Z",
  "completedAt": null
}
```

`status` transitions:

- `PENDING`
- terminal statuses from worker: `ACCEPTED`, `WRONG_ANSWER`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`

## Error Contract Notes

- Controllers currently rely on Spring defaults (`ResponseStatusException` for not-found cases).
- No unified error envelope yet; clients should handle standard Spring Boot error payloads.
