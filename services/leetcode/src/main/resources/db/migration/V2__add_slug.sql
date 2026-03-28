-- V2: add slug column for URL-based problem lookup
--
-- The slug is the human-readable identifier in a LeetCode URL:
--   https://leetcode.com/problems/two-sum/  →  slug = "two-sum"
--
-- For any existing rows we derive it from the url column.
-- For a fresh (empty) database the seeder will populate it on insert.

ALTER TABLE problems ADD COLUMN slug TEXT;

UPDATE problems
SET slug = split_part(rtrim(url, '/'), '/', 5)
WHERE url IS NOT NULL;

CREATE UNIQUE INDEX idx_problems_slug ON problems(slug);
