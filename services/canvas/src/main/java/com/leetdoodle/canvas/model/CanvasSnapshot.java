package com.leetdoodle.canvas.model;

import java.util.List;

/**
 * Current durable materialized state for one canvas at a specific committed
 * version.
 */
public record CanvasSnapshot(
    String canvasId,
    long headVersion,
    List<CanvasNodeRecord> nodes,
    List<CanvasEdgeRecord> edges
) {}
