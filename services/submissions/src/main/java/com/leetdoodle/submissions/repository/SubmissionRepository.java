package com.leetdoodle.submissions.repository;

import com.leetdoodle.submissions.model.ImmutableSubmission;
import com.leetdoodle.submissions.model.Submission;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * JDBC repository for {@code submissions.submissions}.
 *
 * <p>Encapsulates SQL for create/read/result-update operations used by both API and worker flows.
 */
@Repository
public class SubmissionRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public SubmissionRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Insert a new submission and return its generated UUID.
     *
     * RETURNING id avoids a second round-trip to fetch the generated key.
     * This is the same pattern used in ProblemRepository — Postgres evaluates
     * the INSERT and returns the new row's id in a single network call.
     */
    public UUID insert(Submission submission) {
        String sql = """
            INSERT INTO submissions.submissions
                (problem_id, user_id, language, code, status)
            VALUES
                (:problemId, :userId, :language, :code, 'PENDING')
            RETURNING id
            """;

        var params = new MapSqlParameterSource()
            .addValue("problemId", submission.problemId())
            .addValue("userId",    submission.userId())
            .addValue("language",  submission.language())
            .addValue("code",      submission.code());

        return jdbc.queryForObject(sql, params, UUID.class);
    }

    public Optional<Submission> findById(UUID id) {
        String sql = """
            SELECT id, problem_id, user_id, language, code, status,
                   result, created_at, completed_at
            FROM submissions.submissions
            WHERE id = :id
            """;
        var results = jdbc.query(sql, Map.of("id", id), (rs, n) -> mapRow(rs));
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    /**
     * Called by the worker once evaluation finishes.
     *
     * We update status + result in a single statement. The worker writes
     * directly to Postgres rather than going through this service's HTTP API —
     * that avoids an extra network hop and keeps the critical path short.
     */
    public void updateResult(UUID id, String status, String resultJson) {
        String sql = """
            UPDATE submissions.submissions
            SET status = :status,
                result = :result::jsonb,
                completed_at = now()
            WHERE id = :id
            """;
        jdbc.update(sql, Map.of("id", id, "status", status, "result", resultJson));
    }

    private Submission mapRow(ResultSet rs) throws SQLException {
        Timestamp completedAt = rs.getTimestamp("completed_at");
        return ImmutableSubmission.builder()
            .id(rs.getObject("id", UUID.class))
            .problemId(rs.getInt("problem_id"))
            .userId(Objects.requireNonNull(rs.getString("user_id")))
            .language(Objects.requireNonNull(rs.getString("language")))
            .code(Objects.requireNonNull(rs.getString("code")))
            .status(Objects.requireNonNull(rs.getString("status")))
            .result(rs.getString("result"))
            .createdAt(rs.getTimestamp("created_at").toInstant())
            .completedAt(completedAt != null ? completedAt.toInstant() : null)
            .build();
    }
}
