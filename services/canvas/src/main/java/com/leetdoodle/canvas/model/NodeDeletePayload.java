package com.leetdoodle.canvas.model;

/**
 * Delete one node and any dependent edges via foreign-key cascade.
 */
public record NodeDeletePayload(String nodeId) {}
