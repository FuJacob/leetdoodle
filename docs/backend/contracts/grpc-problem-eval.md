# gRPC Contract: Problem Eval Data (`leetcode-service`)

This document defines the internal gRPC contract used by `worker` to fetch
evaluation metadata and test cases.

## Endpoint (local dev)

- Host: `localhost`
- Port: `9090`
- Service: `com.leetdoodle.grpc.ProblemService`
- Method: `GetProblemEval`

Primary code references:

- proto source: `services/grpc-api/src/main/proto/leetcode_service.proto`
- server impl: `services/leetcode/src/main/java/com/leetdoodle/leetcode/grpc/ProblemGrpcService.java`
- client wrapper: `services/worker/src/main/java/com/leetdoodle/worker/grpc/LeetcodeGrpcClient.java`

## Request

`GetProblemEvalRequest`

```json
{
  "problemId": 1
}
```

Notes:

- `problemId` is the internal `problems.id` (not LeetCode `question_id`).

## Response

`GetProblemEvalResponse`

```json
{
  "prompt": "# hidden python boilerplate ...",
  "entryPoint": "Solution().twoSum",
  "testCases": [
    {
      "input": "nums = [2,7,11,15], target = 9",
      "expectedOutput": "[0, 1]"
    }
  ]
}
```

Field semantics:

- `prompt`: hidden eval boilerplate prepended to every execution script.
- `entryPoint`: how to invoke user code (for example `Solution().twoSum`).
- `testCases`: ordered cases from `test_cases` table.

## Error Semantics

- `NOT_FOUND` when eval data is missing for a problem (missing row, or null
  `prompt`/`entry_point`).
- Worker maps this to a submission `RUNTIME_ERROR` result with the gRPC error
  description.

## Operational Notes

- Transport is plaintext in local dev (`grpc.client.leetcode-service.negotiation-type=plaintext`).
- Calls are synchronous in the Rabbit listener thread via blocking stub.
