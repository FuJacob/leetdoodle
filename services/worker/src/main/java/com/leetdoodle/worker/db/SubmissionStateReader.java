package com.leetdoodle.worker.db;

import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Reads submission lifecycle state from the submissions schema.
 *
 * <p>The worker uses this as a cheap idempotency guard. If a duplicate queue
 * delivery arrives after a submission has already finished, we can skip the
 * expensive Docker execution path.
 */
@Component
public class SubmissionStateReader {

    private static final Set<String> TERMINAL_STATUSES = Set.of(
        "ACCEPTED",
        "WRONG_ANSWER",
        "TIME_LIMIT_EXCEEDED",
        "RUNTIME_ERROR",
        "COMPILE_ERROR"
    );

    private final NamedParameterJdbcTemplate jdbc;

    public SubmissionStateReader(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<String> findStatus(String submissionId) {
        String sql = """
            SELECT status
            FROM submissions.submissions
            WHERE id = :id
            """;

        return jdbc.query(sql, Map.of("id", UUID.fromString(submissionId)),
                (rs, rowNum) -> rs.getString("status"))
            .stream()
            .findFirst();
    }

    public boolean isTerminalStatus(String status) {
        return TERMINAL_STATUSES.contains(status);
    }
}
