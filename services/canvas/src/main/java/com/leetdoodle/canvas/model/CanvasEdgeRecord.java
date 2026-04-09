package com.leetdoodle.canvas.model;

import java.time.Instant;

/**
 * Durable edge row owned by the canvas service.
 */
public record CanvasEdgeRecord(
    String canvasId,
    String edgeId,
    String fromNodeId,
    String toNodeId,
    long createdVersion,
    long updatedVersion,
    Instant createdAt,
    Instant updatedAt
) {}
