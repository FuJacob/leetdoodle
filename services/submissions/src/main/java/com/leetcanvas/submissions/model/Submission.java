package com.leetcanvas.submissions.model;

import org.immutables.value.Value;

import javax.annotation.Nullable;
import java.time.Instant;
import java.util.UUID;

@Value.Immutable
public interface Submission {
    @Nullable UUID    id();          // set by DB on insert
    int               problemId();
    String            userId();
    String            language();
    String            code();
    String            status();      // PENDING | RUNNING | ACCEPTED | WRONG_ANSWER | ...
    @Nullable String  result();      // JSON written by worker; null until complete
    @Nullable Instant createdAt();
    @Nullable Instant completedAt();
}
