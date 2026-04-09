package com.leetdoodle.canvas.model;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Full durable representation needed to create a new node row.
 */
public record NodeCreatePayload(
    String nodeId,
    String nodeType,
    double x,
    double y,
    double width,
    double height,
    JsonNode data
) {}
