package com.leetcanvas.leetcode.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import org.immutables.value.Value;

import javax.annotation.Nullable;

/*
 * Immutables value type — the annotation processor generates ImmutableTag
 * at compile time with:
 *   - ImmutableTag.builder().id(1).name("Array").build()
 *   - equals/hashCode based on all fields
 *   - toString() for debugging
 *   - ImmutableTag.copyOf(tag).withName("new") for modified copies
 *
 * @Nullable means the field is optional in the builder — you can omit it.
 * Useful for id() which doesn't exist yet before a DB insert.
 */
@Value.Immutable
@JsonSerialize(as = ImmutableTag.class)
@JsonDeserialize(as = ImmutableTag.class)
public interface Tag {
    @Nullable Integer id();
    String name();
}
