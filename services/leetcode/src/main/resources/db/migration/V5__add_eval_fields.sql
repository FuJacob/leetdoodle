-- Add eval fields to problems table.
--
-- WHY ON problems AND NOT A SEPARATE TABLE?
-- prompt and entry_point are 1:1 with a problem — there's no reason to
-- normalise them into a join table. Adding columns keeps lookups simple
-- (one SELECT instead of a JOIN) and keeps the data co-located with the
-- problem it belongs to.
--
-- These columns are nullable because not every problem in the initial
-- dataset has test case metadata; problems seeded from the official API
-- without a matching JSONL entry will have NULL here.
ALTER TABLE problems ADD COLUMN prompt       TEXT;
ALTER TABLE problems ADD COLUMN entry_point  TEXT;
