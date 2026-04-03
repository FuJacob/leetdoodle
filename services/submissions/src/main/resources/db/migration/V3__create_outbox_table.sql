-- Transactional outbox table.
--
-- WHY OUTBOX?
-- Writing a submission row and publishing a RabbitMQ message are two separate
-- operations. If the app crashes between them, the submission is stuck at PENDING
-- forever — the worker never gets the job. This is the classic "dual-write problem".
--
-- The fix: write the job into this table *in the same DB transaction* as the
-- submission row. Either both commit or neither does. A background dispatcher
-- later reads committed outbox rows and publishes them to RabbitMQ — so the
-- message is only sent if the DB commit actually happened.
--
-- COLUMNS:
--   id           — PK for the outbox row itself (not the submission ID)
--   aggregate_id — the business entity ID this event is about (submission UUID).
--                  Useful for correlating dispatch attempts with the submission.
--   event_type   — maps to the RabbitMQ routing key ("eval" → eval.queue)
--   payload      — the full EvalJob JSON; the dispatcher forwards this as the message body
--   created_at   — audit/debugging; also useful for a sweeper job that cleans old rows

CREATE TABLE submissions.outbox (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID        NOT NULL,
    event_type   TEXT        NOT NULL,
    payload      JSONB       NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
