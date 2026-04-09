package com.leetdoodle.collab.canvas;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * One committed structural operation returned by canvas-service after a
 * successful durable write.
 */
public record CommittedCanvasOperationResponse(
    String id,
    String canvasId,
    long version,
    String clientOperationId,
    String actorUserId,
    String operationType,
    JsonNode payload
) {}
