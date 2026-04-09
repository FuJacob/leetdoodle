package com.leetdoodle.collab.canvas;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Durable snapshot returned by canvas-service for join/bootstrap flows.
 *
 * <p>We keep nodes/edges as JSON trees here because collab does not own the
 * canvas schema. Its job is to transport durable state to clients, not to
 * reinterpret every node variant.
 */
public record CanvasSnapshotResponse(
    String canvasId,
    long headVersion,
    JsonNode nodes,
    JsonNode edges
) {}
