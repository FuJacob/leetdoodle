package com.leetdoodle.collab.canvas;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Internal request shape collab sends to canvas-service for one durable
 * structural mutation.
 */
public record StructuralOperationRequest(
    String clientOperationId,
    String actorUserId,
    String operationType,
    JsonNode payload
) {}
