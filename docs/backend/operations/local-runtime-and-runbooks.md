# Local Runtime and Runbooks

## Local Runtime Topology

Infrastructure stack (`infra/compose/docker-compose.dev.yml`):

- PostgreSQL 16 (`localhost:5432`)
- RabbitMQ management image (`localhost:5672`, UI `localhost:15672`)
- Debezium Server (`debezium/server:2.7.3.Final`)

Service ports:

- collab: `8080`
- leetcode-service HTTP: `8081`
- leetcode-service gRPC: `9090`
- submissions: `8082`
- worker: `8083`

Helper scripts:

- `./scripts/dev-up.sh`
- `./scripts/dev-down.sh`
- `./scripts/dev-logs.sh`
- `./scripts/backend-up.sh`
- `./scripts/backend-down.sh`

## Core Operational Dependencies

- Debezium requires Postgres logical replication (`wal_level=logical`).
- Debezium Postgres connector uses `pgoutput` logical decoding plugin.
- Debezium offset file persists in `debezium-data` volume.
- Rabbit queue `eval.queue` should exist before worker consumes (both services declare topology).
- Worker requires Docker socket access (`worker.docker.host`).
- Worker requires healthy gRPC channel to leetcode-service (`grpc.client.leetcode-service.*`).

## Runbook: Submission Stuck in `PENDING`

1. Check `submissions.outbox` has a row for the submission.
2. Check Debezium container logs for connector or sink errors.
3. Check RabbitMQ queue depth for `eval.queue`.
4. Check worker logs for consume/runtime failures.
5. Confirm worker can write to `submissions.submissions`.

## Runbook: Worker Throughput Drops

1. Inspect Docker host health and container creation latency.
2. Confirm pool refill is functioning (`worker.pool.size` behavior).
3. Check Rabbit prefetch and queue backlog.
4. Check leetcode-service gRPC latency/errors (`GetProblemEval`) and submission-result DB write latency.

## Runbook: Terminal `RUNTIME_ERROR` with "No eval data for problem_id=..."

1. Verify `problems.prompt` and `problems.entry_point` are populated for that `problem_id`.
2. Verify `test_cases` rows exist for that `problem_id`.
3. Check leetcode-service logs for `grpc.getProblemEval.not_found`.
4. If data is missing, re-run/repair seed pipeline for eval metadata inputs.

## Runbook: Collab Sync Inconsistency

1. Confirm clients send `join` before other events.
2. Inspect collab logs for invalid `crdt_op` payload warnings.
3. Verify `sync_request` includes correct `canvasId` and `docId`.
4. Validate state-vector logic in client CRDT integration.

## Known Current Constraints

- Collab op log is in-memory; process restarts lose replay history.
- No DLQ configured for eval pipeline.
- No unified backend error envelope standard yet.
