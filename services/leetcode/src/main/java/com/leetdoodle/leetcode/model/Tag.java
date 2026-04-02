package com.leetdoodle.leetcode.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import org.immutables.value.Value;

import javax.annotation.Nullable;

/**
 * Immutable topic tag attached to problems.
 *
 * <p>Immutables generates {@code ImmutableTag} at compile time with a builder,
 * value-based equality, and copy helpers.
 */
@Value.Immutable
@JsonSerialize(as = ImmutableTag.class)
@JsonDeserialize(as = ImmutableTag.class)
public interface Tag {
    /**
     * Database identifier.
     *
     * @return tag id, or null before persistence
     */
    @Nullable Integer id();

    /**
     * Human-readable tag label.
     *
     * @return canonical tag name (for example, "Array")
     */
    String name();
}
