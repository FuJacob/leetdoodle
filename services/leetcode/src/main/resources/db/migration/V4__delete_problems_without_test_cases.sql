-- Delete problems that don't have any test cases.
-- This ensures we only keep problems we can actually evaluate.
DELETE FROM problems
WHERE id NOT IN (
  SELECT DISTINCT problem_id FROM test_cases
);
