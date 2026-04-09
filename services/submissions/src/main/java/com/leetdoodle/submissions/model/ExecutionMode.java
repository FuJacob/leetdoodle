package com.leetdoodle.submissions.model;

/**
 * Distinguishes lightweight sample runs from full submissions.
 *
 * <p>Using an enum here is better than a boolean because the wire contract stays
 * self-describing and can grow later without a breaking rename like
 * {@code isSampleRun -> executionMode}.
 */
public enum ExecutionMode {
    SAMPLE,
    SUBMIT
}
