package com.leetdoodle.canvas.model;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/**
 * One committed structural change in the ordered per-canvas operation log.
 *
 * <p>The materialized node/edge tables remain the current-state source of truth.
 * This record exists so joins, reconnects, retries, and debug traces can reason
 * about what changed after version {@code N}.
 */
public record CommittedCanvasOperation(
    UUID id,
    String canvasId,
    long version,
    String clientOperationId,
    String actorUserId,
    CanvasOperationType operationType,
    JsonNode payload,
    Instant createdAt
) {}
