-- Each service owns its own schema — this is how we get logical separation
-- inside a single database without running separate Postgres instances.
-- The submissions service's Flyway only ever touches this schema.
CREATE SCHEMA IF NOT EXISTS submissions;
