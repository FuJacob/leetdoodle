CREATE TABLE canvas.canvas_ops (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    canvas_id           TEXT        NOT NULL,
    version             BIGINT      NOT NULL,
    client_operation_id TEXT        NOT NULL,
    actor_user_id       TEXT        NOT NULL,
    operation_type      TEXT        NOT NULL,
    payload             JSONB       NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_canvas_ops_canvas
        FOREIGN KEY (canvas_id)
        REFERENCES canvas.canvases(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_canvas_ops_version UNIQUE (canvas_id, version),
    CONSTRAINT uq_canvas_ops_client_operation UNIQUE (canvas_id, client_operation_id)
);

CREATE INDEX idx_canvas_ops_lookup ON canvas.canvas_ops(canvas_id, version);
