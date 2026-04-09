CREATE TABLE canvas.canvases (
    id            TEXT        PRIMARY KEY,
    head_version  BIGINT      NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_canvases_updated_at ON canvas.canvases(updated_at DESC);
