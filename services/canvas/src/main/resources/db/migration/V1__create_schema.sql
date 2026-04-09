-- The canvas service owns its own schema inside the shared local Postgres
-- instance. This keeps service ownership explicit without requiring a separate
-- database server in development.
CREATE SCHEMA IF NOT EXISTS canvas;
