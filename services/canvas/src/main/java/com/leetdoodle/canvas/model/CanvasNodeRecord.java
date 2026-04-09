package com.leetdoodle.canvas.model;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

/**
 * Materialized durable node row owned by the canvas service.
 *
 * <p>The top-level geometry fields are explicit columns because they are queried
 * and updated frequently. Type-specific payload lives in {@code data} so the
 * service can evolve node variants without prematurely over-normalizing the
 * schema.
 */
public record CanvasNodeRecord(
    String canvasId,
    String nodeId,
    String nodeType,
    double x,
    double y,
    double width,
    double height,
    JsonNode data,
    long createdVersion,
    long updatedVersion,
    Instant createdAt,
    Instant updatedAt
) {}
