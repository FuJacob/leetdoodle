package com.leetcanvas.worker.db;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetcanvas.worker.docker.EvalRunner.EvalResult;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Writes evaluation results back to the submissions schema.
 *
 * The worker writes directly to the submissions DB — same reason as TestCaseReader:
 * fewer hops, lower latency in the critical eval path.
 */
@Component
public class SubmissionResultWriter {

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SubmissionResultWriter(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void write(String submissionId, EvalResult result) {
        try {
            // Serialize only the fields the frontend needs. status goes in its own
            // column; having it here too would be redundant. Jackson serializes
            // CaseResult records directly — field names come from record component names.
            var payload = new java.util.HashMap<String, Object>();
            payload.put("cases",        result.cases());
            payload.put("errorMessage", result.errorMessage());
            String resultJson = objectMapper.writeValueAsString(payload);

            String sql = """
                UPDATE submissions.submissions
                SET status       = :status,
                    result       = :result::jsonb,
                    completed_at = now()
                WHERE id = :id
                """;

            jdbc.update(sql, Map.of(
                "id",     UUID.fromString(submissionId),
                "status", result.status(),
                "result", resultJson
            ));
        } catch (Exception e) {
            throw new RuntimeException("Failed to write submission result", e);
        }
    }
}
