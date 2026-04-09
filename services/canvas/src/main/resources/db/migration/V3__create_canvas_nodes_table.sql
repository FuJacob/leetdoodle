CREATE TABLE canvas.canvas_nodes (
    canvas_id        TEXT        NOT NULL,
    node_id          TEXT        NOT NULL,
    node_type        TEXT        NOT NULL,
    x                DOUBLE PRECISION NOT NULL,
    y                DOUBLE PRECISION NOT NULL,
    width            DOUBLE PRECISION NOT NULL,
    height           DOUBLE PRECISION NOT NULL,
    data             JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_version  BIGINT      NOT NULL,
    updated_version  BIGINT      NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (canvas_id, node_id),
    CONSTRAINT fk_canvas_nodes_canvas
        FOREIGN KEY (canvas_id)
        REFERENCES canvas.canvases(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_canvas_nodes_canvas_id ON canvas.canvas_nodes(canvas_id);
CREATE INDEX idx_canvas_nodes_type ON canvas.canvas_nodes(canvas_id, node_type);
