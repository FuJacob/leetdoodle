package com.leetdoodle.canvas.model;

/**
 * Structural operations that change the durable canvas graph.
 *
 * <p>These operations affect rows in {@code canvas_nodes} / {@code canvas_edges}
 * and therefore receive a committed, monotonic canvas version. Ephemeral
 * multiplayer signals like cursors or drag previews do not belong here.
 */
public enum CanvasOperationType {
    NODE_CREATE,
    NODE_MOVE,
    NODE_UPDATE,
    NODE_DELETE,
    EDGE_CREATE,
    EDGE_DELETE
}
