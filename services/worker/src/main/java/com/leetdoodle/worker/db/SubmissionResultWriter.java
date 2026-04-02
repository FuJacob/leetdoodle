package com.leetdoodle.worker.db;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.leetdoodle.worker.docker.EvalRunner.EvalResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(SubmissionResultWriter.class);

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SubmissionResultWriter(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void write(String submissionId, EvalResult result) {
        try {
            log.info("result.write.start submission={} status={}", submissionId, result.status());

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

            int updated = jdbc.update(sql, Map.of(
                "id",     UUID.fromString(submissionId),
                "status", result.status(),
                "result", resultJson
            ));

            if (updated == 0) {
                log.warn("result.write.miss submission={} status={} (no rows updated)",
                    submissionId, result.status());
            } else {
                log.info("result.write.ok submission={} status={}", submissionId, result.status());
            }
        } catch (Exception e) {
            log.error("result.write.failed submission={} status={}", submissionId, result.status(), e);
            throw new RuntimeException("Failed to write submission result", e);
        }
    }
}
