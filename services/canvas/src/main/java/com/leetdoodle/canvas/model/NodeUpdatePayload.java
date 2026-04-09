package com.leetdoodle.canvas.model;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Shallow node patch that mirrors the frontend update semantics.
 *
 * <p>Geometry fields are optional. {@code data}, when present, replaces the
 * stored node payload wholesale rather than deep-merging nested fields.
 */
public record NodeUpdatePayload(
    String nodeId,
    Double width,
    Double height,
    JsonNode data
) {}
