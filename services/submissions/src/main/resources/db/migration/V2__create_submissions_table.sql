CREATE TABLE submissions.submissions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    problem_id   INTEGER     NOT NULL,
    user_id      TEXT        NOT NULL,
    language     TEXT        NOT NULL,
    code         TEXT        NOT NULL,
    -- Status lifecycle: PENDING → RUNNING → ACCEPTED | WRONG_ANSWER |
    --                   TIME_LIMIT_EXCEEDED | RUNTIME_ERROR | COMPILE_ERROR
    status       TEXT        NOT NULL DEFAULT 'PENDING',
    -- JSONB result: structured output written by the worker after execution.
    -- NULL until the worker finishes. Using JSONB (not TEXT) so we can query
    -- into it later (e.g. find all submissions where result->>'passedCases' = '5').
    result       JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Fast lookup by user — needed for "my submissions" feed
CREATE INDEX idx_submissions_user_id    ON submissions.submissions(user_id);
-- Fast lookup by problem — needed for leaderboard / stats
CREATE INDEX idx_submissions_problem_id ON submissions.submissions(problem_id);
