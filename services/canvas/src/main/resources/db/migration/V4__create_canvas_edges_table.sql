CREATE TABLE canvas.canvas_edges (
    canvas_id        TEXT        NOT NULL,
    edge_id          TEXT        NOT NULL,
    from_node_id     TEXT        NOT NULL,
    to_node_id       TEXT        NOT NULL,
    created_version  BIGINT      NOT NULL,
    updated_version  BIGINT      NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (canvas_id, edge_id),
    CONSTRAINT fk_canvas_edges_canvas
        FOREIGN KEY (canvas_id)
        REFERENCES canvas.canvases(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_canvas_edges_from_node
        FOREIGN KEY (canvas_id, from_node_id)
        REFERENCES canvas.canvas_nodes(canvas_id, node_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_canvas_edges_to_node
        FOREIGN KEY (canvas_id, to_node_id)
        REFERENCES canvas.canvas_nodes(canvas_id, node_id)
        ON DELETE CASCADE
);

CREATE INDEX idx_canvas_edges_canvas_id ON canvas.canvas_edges(canvas_id);
CREATE INDEX idx_canvas_edges_from_node ON canvas.canvas_edges(canvas_id, from_node_id);
CREATE INDEX idx_canvas_edges_to_node ON canvas.canvas_edges(canvas_id, to_node_id);
