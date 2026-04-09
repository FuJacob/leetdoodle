package com.leetdoodle.canvas.model;

/**
 * Targeted position update for one node.
 */
public record NodeMovePayload(
    String nodeId,
    double x,
    double y
) {}
