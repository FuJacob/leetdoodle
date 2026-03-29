package com.leetcanvas.leetcode.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import org.immutables.value.Value;

import javax.annotation.Nullable;
import java.util.List;

@Value.Immutable
@JsonSerialize(as = ImmutableProblem.class)
@JsonDeserialize(as = ImmutableProblem.class)
public interface Problem {
    @Nullable Integer id();
    int questionId();
    String title();
    @Nullable String content();
    String difficulty();
    int likes();
    int dislikes();
    @Nullable String category();
    boolean isPaidOnly();
    boolean hasSolution();
    boolean hasVideoSolution();
    @Nullable String slug();
    @Nullable String url();
    @Nullable String solutionContent();
    @Nullable String similarQuestions();
    @Nullable String stats();
    @Nullable String companyTags();

    // List fields default to empty so the builder doesn't require them
    @Value.Default
    default List<String> hints() { return List.of(); }

    @Value.Default
    default List<Tag> tags() { return List.of(); }
}
