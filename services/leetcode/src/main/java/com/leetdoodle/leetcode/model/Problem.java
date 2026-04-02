package com.leetdoodle.leetcode.model;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import org.immutables.value.Value;

import javax.annotation.Nullable;
import java.util.List;

/**
 * Immutable problem aggregate served to clients and worker orchestration.
 *
 * <p>Immutables generates {@code ImmutableProblem} at compile time.
 */
@Value.Immutable
@JsonSerialize(as = ImmutableProblem.class)
@JsonDeserialize(as = ImmutableProblem.class)
public interface Problem {
    /**
     * Database identifier.
     *
     * @return id, or null before persistence
     */
    @Nullable Integer id();

    /**
     * External question identifier from source datasets.
     *
     * @return source question id
     */
    int questionId();

    /**
     * Display title shown in the problem node.
     *
     * @return problem title
     */
    String title();

    /**
     * HTML/text prompt body.
     *
     * @return problem statement content
     */
    @Nullable String content();

    /**
     * Difficulty tier.
     *
     * @return difficulty enum as text (for example, EASY/MEDIUM/HARD)
     */
    String difficulty();

    /**
     * Upvote count.
     *
     * @return likes
     */
    int likes();

    /**
     * Downvote count.
     *
     * @return dislikes
     */
    int dislikes();

    /**
     * Optional broad category value from source data.
     *
     * @return category text, or null
     */
    @Nullable String category();

    /**
     * Indicates whether the source marks this as premium-only.
     *
     * @return true when premium gated
     */
    boolean isPaidOnly();

    /**
     * Indicates whether an editorial solution exists.
     *
     * @return true when a written solution exists
     */
    boolean hasSolution();

    /**
     * Indicates whether a video solution exists.
     *
     * @return true when a video solution exists
     */
    boolean hasVideoSolution();

    /**
     * Stable slug used by REST routes.
     *
     * @return slug, or null when missing from source data
     */
    @Nullable String slug();

    /**
     * Source URL for external references.
     *
     * @return canonical problem URL, or null
     */
    @Nullable String url();

    /**
     * Raw editorial content from source.
     *
     * @return solution content, or null
     */
    @Nullable String solutionContent();

    /**
     * Serialized similar-question metadata.
     *
     * @return similar question payload, or null
     */
    @Nullable String similarQuestions();

    /**
     * Serialized stats payload.
     *
     * @return stats JSON/text, or null
     */
    @Nullable String stats();

    /**
     * Serialized company tag payload.
     *
     * @return company tags JSON/text, or null
     */
    @Nullable String companyTags();

    /**
     * Hidden evaluation boilerplate prepended before user code.
     *
     * @return language-specific scaffold (imports, helpers), or null
     */
    @Nullable String prompt();

    /**
     * Invocation expression for user implementation.
     *
     * @return entry point (for example, {@code Solution().twoSum}), or null
     */
    @Nullable String entryPoint();

    /**
     * Editor-visible starter template.
     *
     * <p>This is distinct from {@link #prompt()}, which is hidden boilerplate used only for
     * worker-side execution.
     *
     * @return starter code string, or null
     */
    @Nullable String starterCode();

    /**
     * Optional list of hints.
     *
     * @return immutable hint list, defaults to empty
     */
    @Value.Default
    default List<String> hints() { return List.of(); }

    /**
     * Topic tags attached to the problem.
     *
     * @return immutable tag list, defaults to empty
     */
    @Value.Default
    default List<Tag> tags() { return List.of(); }
}
