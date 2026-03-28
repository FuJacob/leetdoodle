-- V1: initial schema for the leetcode-service
--
-- Why Flyway instead of Hibernate auto-create?
-- Flyway gives you an audit trail of every schema change.
-- Each migration runs exactly once and is recorded in the
-- `flyway_schema_history` table. That means you can reproduce
-- the schema on any machine and roll forward through history —
-- critical when multiple developers or environments are involved.

-- ── tags ────────────────────────────────────────────────────────────────────
-- A tag is a skill/topic label like "Array" or "Dynamic Programming".
-- Normalised into its own table so we can query "all problems tagged X"
-- with a clean JOIN rather than array containment operators.
CREATE TABLE tags (
    id   SERIAL      PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- ── problems ─────────────────────────────────────────────────────────────────
CREATE TABLE problems (
    id                  SERIAL      PRIMARY KEY,

    -- LeetCode has two IDs:
    --   question_id    — internal DB identifier (not always sequential)
    --   frontend_id    — the number shown to users ("Problem #1 - Two Sum")
    -- Both are unique and we'll look up by frontend_id in the API.
    question_id         INTEGER     NOT NULL UNIQUE,
    frontend_id         INTEGER     NOT NULL UNIQUE,

    title               TEXT        NOT NULL,
    content             TEXT,                           -- HTML problem body
    difficulty          TEXT        NOT NULL,           -- 'Easy' | 'Medium' | 'Hard'

    likes               INTEGER     NOT NULL DEFAULT 0,
    dislikes            INTEGER     NOT NULL DEFAULT 0,

    category            TEXT,                           -- e.g. 'Algorithms', 'Database'

    is_paid_only        BOOLEAN     NOT NULL DEFAULT FALSE,
    has_solution        BOOLEAN     NOT NULL DEFAULT FALSE,
    has_video_solution  BOOLEAN     NOT NULL DEFAULT FALSE,

    url                 TEXT,
    solution_content    TEXT,                           -- editorial markdown

    -- Stored as JSONB (binary JSON) for efficient storage and potential
    -- future querying. Hints are an ordered list of strings.
    hints               JSONB,

    -- These two are opaque JSON strings in the source data — we store them
    -- as TEXT rather than JSONB to avoid double-parsing on every write.
    -- If you later want to query inside them, you can cast: stats::jsonb
    similar_questions   TEXT,
    stats               TEXT,

    company_tags        TEXT        -- null in current dataset
);

-- ── problem_tags (junction table) ────────────────────────────────────────────
-- This is the standard many-to-many join table pattern:
--   one problem has many tags, one tag belongs to many problems.
-- Using a composite primary key (problem_id, tag_id) prevents duplicate rows.
-- ON DELETE CASCADE: if a problem or tag is deleted, its join rows disappear too.
CREATE TABLE problem_tags (
    problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id)     ON DELETE CASCADE,
    PRIMARY KEY (problem_id, tag_id)
);

-- Index for the common query: "give me all problems with tag X"
CREATE INDEX idx_problem_tags_tag_id ON problem_tags(tag_id);
