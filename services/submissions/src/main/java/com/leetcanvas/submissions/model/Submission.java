package com.leetcanvas.submissions.model;

import org.immutables.value.Value;

import javax.annotation.Nullable;
import java.time.Instant;
import java.util.UUID;

/**
 * Immutable submission aggregate as persisted in the {@code submissions} table.
 *
 * <p>Immutables generates {@code ImmutableSubmission} at compile time for safe construction and
 * copy-on-write updates.
 */
@Value.Immutable
public interface Submission {
    /**
     * Database-generated submission id.
     *
     * @return submission id, or null before insert
     */
    @Nullable UUID id();

    /**
     * Problem id this submission targets.
     *
     * @return problem id
     */
    int problemId();

    /**
     * Caller-provided logical user id.
     *
     * @return submitter identity string
     */
    String userId();

    /**
     * Runtime language requested for execution.
     *
     * @return language key (for example, "python" or "javascript")
     */
    String language();

    /**
     * Raw user code sent by the client.
     *
     * @return source code text
     */
    String code();

    /**
     * Current lifecycle state.
     *
     * @return one of {@code PENDING}, {@code RUNNING}, {@code ACCEPTED}, {@code WRONG_ANSWER},
     *     or {@code RUNTIME_ERROR}
     */
    String status();

    /**
     * Serialized evaluation result payload.
     *
     * @return JSON result written by the worker, or null while processing
     */
    @Nullable String result();

    /**
     * Creation timestamp from the database.
     *
     * @return creation time, or null before insert
     */
    @Nullable Instant createdAt();

    /**
     * Completion timestamp for terminal states.
     *
     * @return completion time, or null while non-terminal
     */
    @Nullable Instant completedAt();
}
