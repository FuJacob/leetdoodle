package com.leetdoodle.canvas.model;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * API request for one structural canvas mutation.
 *
 * <p>{@code clientOperationId} makes retries idempotent. If the caller resends
 * the same operation after a timeout, the backend can return the already
 * committed version instead of duplicating the write.
 */
public record StructuralOperationRequest(
    String clientOperationId,
    String actorUserId,
    CanvasOperationType operationType,
    JsonNode payload
) {}
