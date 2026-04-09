package com.leetdoodle.canvas.model;

/**
 * Full durable representation needed to create a new edge row.
 */
public record EdgeCreatePayload(
    String edgeId,
    String fromNodeId,
    String toNodeId
) {}
